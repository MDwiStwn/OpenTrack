import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Priority, StatusCategory } from "@prisma/client";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createProjectSchema = z.object({
  name: z.string().min(2, "Nama proyek minimal 2 karakter").max(80),
  key: z
    .string()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  summary: z.string().max(300).optional(),
  description: z.string().max(50000).optional(),
  color: z.string().optional(),
  status: z.enum(["BACKLOG", "PLANNED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELED"]).optional(),
  priority: z.nativeEnum(Priority).optional(),
  leadId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      lead: { select: { id: true, name: true, email: true, avatarColor: true } },
      milestones: {
        orderBy: { position: "asc" },
        include: {
          issues: {
            select: { id: true, status: { select: { category: true } } },
          },
        },
      },
      issues: {
        select: {
          id: true,
          estimate: true,
          status: { select: { category: true } },
        },
      },
      updates: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, health: true, body: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const formatted = projects.map((p) => {
    const totalIssues = p.issues.length;
    const completedIssues = p.issues.filter((i) => i.status.category === StatusCategory.COMPLETED).length;
    const totalPoints = p.issues.reduce((sum, i) => sum + (i.estimate ?? 0), 0);
    const progressPercent = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      key: p.key,
      summary: p.summary,
      description: p.description,
      color: p.color,
      status: p.status,
      health: p.health,
      priority: p.priority,
      leadId: p.leadId,
      lead: p.lead,
      startDate: p.startDate,
      targetDate: p.targetDate,
      resources: p.resources,
      issueCounter: p.issueCounter,
      latestUpdate: p.updates[0] ?? null,
      milestones: p.milestones.map((m) => {
        const mTotal = m.issues.length;
        const mDone = m.issues.filter((i) => i.status.category === StatusCategory.COMPLETED).length;
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          targetDate: m.targetDate,
          totalIssues: mTotal,
          completedIssues: mDone,
          progressPercent: mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0,
        };
      }),
      _count: { issues: totalIssues },
      stats: { totalIssues, completedIssues, totalPoints, progressPercent },
    };
  });

  return NextResponse.json({ projects: formatted });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Hanya Owner/Admin yang dapat membuat proyek" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success || parsed.data.key.length < 2) {
    return NextResponse.json(
      { error: "Nama dan Project Key (2-10 huruf/angka) wajib valid" },
      { status: 400 }
    );
  }

  const existing = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: ctx.workspace.id, key: parsed.data.key } },
  });
  if (existing) {
    return NextResponse.json({ error: `Project Key "${parsed.data.key}" sudah digunakan` }, { status: 409 });
  }

  const project = await prisma.project.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name.trim(),
      key: parsed.data.key,
      summary: parsed.data.summary?.trim() ?? "",
      description: parsed.data.description ?? "",
      color: parsed.data.color ?? "#6366f1",
      status: parsed.data.status ?? "IN_PROGRESS",
      priority: parsed.data.priority ?? Priority.MEDIUM,
      leadId: parsed.data.leadId || ctx.user.id,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
      milestones: {
        create: [
          { name: "Stabilization", description: "Bug fix & regression test issue lama", position: 0 },
          { name: "Feature Request", description: "Permintaan fitur baru dari pengguna", position: 1 },
          { name: "Maintenance", description: "Perbaikan rutin/minor, non-urgent", position: 2 },
        ],
      },
    },
    include: {
      lead: { select: { id: true, name: true, email: true, avatarColor: true } },
      milestones: { orderBy: { position: "asc" } },
      _count: { select: { issues: true } },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.project.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
