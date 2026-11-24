import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Priority, StatusCategory, type Prisma } from "@prisma/client";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchProjectSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  summary: z.string().max(300).optional(),
  description: z.string().max(50000).optional(),
  color: z.string().optional(),
  status: z.enum(["BACKLOG", "PLANNED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELED"]).optional(),
  health: z.enum(["NO_UPDATES", "ON_TRACK", "AT_RISK", "OFF_TRACK"]).optional(),
  priority: z.nativeEnum(Priority).optional(),
  leadId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  resources: z
    .array(z.object({ id: z.string(), title: z.string(), url: z.string() }))
    .optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
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
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true, avatarColor: true } },
        },
        take: 30,
      },
      issues: {
        select: {
          id: true,
          estimate: true,
          status: { select: { category: true } },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  // Recent issue activities across this project
  const issueActivities = await prisma.activityLog.findMany({
    where: {
      issue: { projectId: project.id, workspaceId: ctx.workspace.id },
    },
    include: {
      issue: { select: { id: true, identifier: true, title: true } },
      actor: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalIssues = project.issues.length;
  const completedIssues = project.issues.filter(
    (i) => i.status.category === StatusCategory.COMPLETED
  ).length;
  const totalPoints = project.issues.reduce((s, i) => s + (i.estimate ?? 0), 0);

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      key: project.key,
      summary: project.summary,
      description: project.description,
      color: project.color,
      status: project.status,
      health: project.health,
      priority: project.priority,
      leadId: project.leadId,
      lead: project.lead,
      startDate: project.startDate,
      targetDate: project.targetDate,
      resources: project.resources,
      issueCounter: project.issueCounter,
      createdAt: project.createdAt,
      milestones: project.milestones.map((m) => {
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
      updates: project.updates,
      activities: issueActivities,
      stats: {
        totalIssues,
        completedIssues,
        totalPoints,
        progressPercent: totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0,
      },
    },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const existing = await prisma.project.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name?.trim(),
      summary: parsed.data.summary,
      description: parsed.data.description,
      color: parsed.data.color,
      status: parsed.data.status,
      health: parsed.data.health,
      priority: parsed.data.priority,
      leadId: parsed.data.leadId,
      startDate:
        parsed.data.startDate === undefined
          ? undefined
          : parsed.data.startDate
            ? new Date(parsed.data.startDate)
            : null,
      targetDate:
        parsed.data.targetDate === undefined
          ? undefined
          : parsed.data.targetDate
            ? new Date(parsed.data.targetDate)
            : null,
      resources: parsed.data.resources as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  await prisma.project.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
