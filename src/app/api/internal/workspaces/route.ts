import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceRole } from "@prisma/client";
import { getAuthContext, canManageWorkspace, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WORKFLOW_STATUSES } from "@/lib/default-statuses";
import { slugify } from "@/lib/types";

const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Nama workspace minimal 2 karakter").max(80),
  projectName: z.string().min(2).max(60).optional(),
  projectKey: z
    .string()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .optional(),
});

const patchWorkspaceSchema = z.object({
  name: z.string().min(2, "Nama workspace minimal 2 karakter").max(80).optional(),
  issuePrefix: z
    .string()
    .min(2, "Kode tiket minimal 2 huruf/angka")
    .max(10, "Kode tiket maksimal 10 huruf/angka")
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .refine((v) => v.length >= 2, "Kode tiket minimal 2 karakter alfanumerik")
    .optional(),
  renameExistingIssues: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: ctx.user.id },
    include: {
      workspace: { select: { id: true, name: true, slug: true, createdAt: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      isCurrent: m.workspace.id === ctx.workspace.id,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const baseSlug = slugify(parsed.data.name) || "workspace";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const projKey = parsed.data.projectKey && parsed.data.projectKey.length >= 2 ? parsed.data.projectKey : "CORE";
    const projName = parsed.data.projectName?.trim() || "Core Platform";

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name.trim(),
        slug,
        issuePrefix: projKey,
        members: {
          create: { userId: ctx.user.id, role: WorkspaceRole.OWNER },
        },
        statuses: {
          create: DEFAULT_WORKFLOW_STATUSES,
        },
        projects: {
          create: {
            name: projName,
            key: projKey,
            description: "Default project",
            color: "#6366f1",
          },
        },
        labels: {
          create: [
            { name: "Platform Core", color: "#6366f1" },
            { name: "Feature", color: "#10b981" },
            { name: "Bug", color: "#ef4444" },
          ],
        },
      },
      select: { id: true, name: true, slug: true },
    });

    await setSessionCookie({ userId: ctx.user.id, workspaceId: workspace.id });

    return NextResponse.json({ workspace, role: WorkspaceRole.OWNER }, { status: 201 });
  } catch (err) {
    console.error("[Create Workspace Error]", err);
    return NextResponse.json({ error: "Gagal membuat workspace baru" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json(
      { error: "Hanya Owner/Admin yang dapat mengubah pengaturan workspace" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = patchWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Input tidak valid" },
      { status: 400 }
    );
  }

  const { name, issuePrefix, renameExistingIssues } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: { name?: string; issuePrefix?: string; issueCounter?: number } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (issuePrefix !== undefined) updateData.issuePrefix = issuePrefix;

    if (issuePrefix !== undefined && renameExistingIssues !== false) {
      const existingIssues = await tx.issue.findMany({
        where: { workspaceId: ctx.workspace.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });

      // Step 1: Temporary identifiers to avoid unique constraint collisions
      for (const iss of existingIssues) {
        await tx.issue.update({
          where: { id: iss.id },
          data: { identifier: `__TMP__${iss.id}` },
        });
      }

      // Step 2: Assign clean unified sequential identifiers (e.g. SDG-1, SDG-2, ...)
      for (let i = 0; i < existingIssues.length; i++) {
        const num = i + 1;
        await tx.issue.update({
          where: { id: existingIssues[i].id },
          data: {
            number: num,
            identifier: `${issuePrefix}-${num}`,
          },
        });
      }

      updateData.issueCounter = existingIssues.length;
    }

    return tx.workspace.update({
      where: { id: ctx.workspace.id },
      data: updateData,
      select: { id: true, name: true, slug: true, issuePrefix: true, issueCounter: true },
    });
  });

  return NextResponse.json({ workspace: updated });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetId = new URL(req.url).searchParams.get("id") || ctx.workspace.id;

  const targetMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: targetId, userId: ctx.user.id },
    },
  });

  if (!targetMembership || targetMembership.role !== WorkspaceRole.OWNER) {
    return NextResponse.json(
      { error: "Hanya OWNER yang dapat menghapus workspace ini" },
      { status: 403 }
    );
  }

  const otherMembership = await prisma.workspaceMember.findFirst({
    where: {
      userId: ctx.user.id,
      workspaceId: { not: targetId },
    },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!otherMembership) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus satu-satunya workspace Anda. Buat workspace lain terlebih dahulu." },
      { status: 400 }
    );
  }

  await prisma.workspace.delete({ where: { id: targetId } });

  if (targetId === ctx.workspace.id) {
    await setSessionCookie({ userId: ctx.user.id, workspaceId: otherMembership.workspaceId });
  }

  return NextResponse.json({
    ok: true,
    switchedTo: otherMembership.workspace,
  });
}
