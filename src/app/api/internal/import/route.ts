import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Priority } from "@prisma/client";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createIssueWithSequence } from "@/lib/issues";

const importItemSchema = z.object({
  sourceId: z.string().max(60).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(50000).optional(),
  status: z.string().max(100).optional(),
  priority: z.string().max(40).optional(),
  estimate: z.number().int().min(0).max(100).nullable().optional(),
  labels: z.array(z.string().max(60)).max(20).optional(),
  assignee: z.string().max(120).optional(),
});

const importRequestSchema = z.object({
  projectId: z.string().min(1, "Pilih project tujuan"),
  defaultStatusId: z.string().optional(),
  source: z.enum(["linear", "jira", "generic"]).default("generic"),
  createMissingLabels: z.boolean().default(true),
  items: z
    .array(importItemSchema)
    .min(1, "Minimal 1 tiket untuk diimpor")
    .max(500, "Maksimal 500 tiket per sekali import"),
});

function mapPriority(raw?: string): Priority {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return Priority.NONE;
  if (v.includes("urgent") || v.includes("highest") || v.includes("blocker") || v.includes("critical") || v === "p0" || v === "1") {
    return Priority.URGENT;
  }
  if (v.includes("high") || v === "p1" || v === "2") return Priority.HIGH;
  if (v.includes("med") || v.includes("normal") || v === "p2" || v === "3") return Priority.MEDIUM;
  if (v.includes("low") || v.includes("minor") || v.includes("trivial") || v === "p3" || v === "4") {
    return Priority.LOW;
  }
  return Priority.NONE;
}

const LABEL_PALETTE = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json(
      { error: "Hanya Owner atau Admin yang dapat melakukan migrasi/import tiket" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = importRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Format data import tidak valid" },
        { status: 400 }
      );
    }

    const { projectId, defaultStatusId, source, createMissingLabels, items } = parsed.data;
    const workspaceId = ctx.workspace.id;

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project tidak ditemukan di workspace ini" }, { status: 404 });
    }

    const [statuses, existingLabels, members] = await Promise.all([
      prisma.workflowStatus.findMany({ where: { workspaceId }, orderBy: { position: "asc" } }),
      prisma.label.findMany({ where: { workspaceId } }),
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    if (statuses.length === 0) {
      return NextResponse.json({ error: "Workspace belum memiliki workflow status" }, { status: 400 });
    }

    const fallbackStatusId =
      (defaultStatusId && statuses.some((s) => s.id === defaultStatusId) ? defaultStatusId : null) ||
      statuses[0].id;

    function resolveStatusId(rawStatus?: string): string {
      const q = (rawStatus || "").trim().toLowerCase();
      if (!q) return fallbackStatusId;

      const exact = statuses.find(
        (s) => s.name.toLowerCase() === q || s.slug.toLowerCase() === q
      );
      if (exact) return exact.id;

      const partial = statuses.find(
        (s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())
      );
      if (partial) return partial.id;

      // Category fallback mapping for common Jira/Linear status names
      if (q.includes("done") || q.includes("closed") || q.includes("resolved") || q.includes("released") || q.includes("complete")) {
        const comp = statuses.find((s) => s.category === "COMPLETED");
        if (comp) return comp.id;
      }
      if (q.includes("progress") || q.includes("dev") || q.includes("review") || q.includes("qc") || q.includes("test")) {
        const started = statuses.find((s) => s.category === "STARTED");
        if (started) return started.id;
      }
      if (q.includes("todo") || q.includes("to do") || q.includes("sprint") || q.includes("ready")) {
        const unstarted = statuses.find((s) => s.category === "UNSTARTED");
        if (unstarted) return unstarted.id;
      }
      if (q.includes("backlog") || q.includes("triage") || q.includes("open")) {
        const backlog = statuses.find((s) => s.category === "BACKLOG");
        if (backlog) return backlog.id;
      }
      return fallbackStatusId;
    }

    function resolveAssigneeId(rawAssignee?: string): string | null {
      const q = (rawAssignee || "").trim().toLowerCase();
      if (!q) return null;
      const found = members.find(
        (m) =>
          m.user.email.toLowerCase() === q ||
          m.user.name.toLowerCase() === q ||
          m.user.name.toLowerCase().includes(q)
      );
      return found?.user.id ?? null;
    }

    const labelMap = new Map<string, string>();
    for (const l of existingLabels) {
      labelMap.set(l.name.toLowerCase(), l.id);
    }

    let createdCount = 0;
    const createdIdentifiers: string[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      try {
        const labelIds: string[] = [];
        if (item.labels && item.labels.length > 0) {
          for (const rawName of item.labels) {
            const cleaned = rawName.trim();
            if (!cleaned) continue;
            const key = cleaned.toLowerCase();
            let lblId = labelMap.get(key);
            if (!lblId && createMissingLabels) {
              const color = LABEL_PALETTE[labelMap.size % LABEL_PALETTE.length];
              const createdLbl = await prisma.label.create({
                data: { workspaceId, name: cleaned.slice(0, 50), color },
              });
              lblId = createdLbl.id;
              labelMap.set(key, lblId);
            }
            if (lblId && !labelIds.includes(lblId)) {
              labelIds.push(lblId);
            }
          }
        }

        const extraFields = item.sourceId
          ? [
              {
                id: `mig-${Date.now()}-${idx}`,
                label: `Migrated (${source.toUpperCase()})`,
                value: item.sourceId,
              },
            ]
          : [];

        const created = await createIssueWithSequence({
          workspaceId,
          projectId: project.id,
          title: item.title.trim(),
          description: item.description ?? "",
          statusId: resolveStatusId(item.status),
          priority: mapPriority(item.priority),
          estimate: item.estimate ?? null,
          assigneeId: resolveAssigneeId(item.assignee),
          reporterId: ctx.user.id,
          actorName: ctx.user.name,
          labelIds,
          customFields: extraFields.length > 0 ? { extraFields } : {},
        });

        createdCount += 1;
        createdIdentifiers.push(created.identifier);
      } catch (rowErr) {
        errors.push(`Baris ${idx + 1} (${item.title.slice(0, 40)}): ${rowErr instanceof Error ? rowErr.message : "gagal"}`);
      }
    }

    return NextResponse.json(
      {
        importedCount: createdCount,
        totalRows: items.length,
        identifiers: createdIdentifiers.slice(0, 20),
        errors: errors.slice(0, 10),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Import Issues Error]", err);
    return NextResponse.json({ error: "Gagal memproses import data" }, { status: 500 });
  }
}
