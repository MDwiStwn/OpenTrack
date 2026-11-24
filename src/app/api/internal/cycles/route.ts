import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CycleStatus, StatusCategory } from "@prisma/client";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeCycleMetrics } from "@/lib/cycle-metrics";

const createCycleSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.nativeEnum(CycleStatus).default(CycleStatus.UPCOMING),
});

const patchCycleSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.nativeEnum(CycleStatus).optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycles = await prisma.cycle.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      issues: {
        select: {
          id: true,
          estimate: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          status: { select: { category: true, name: true } },
        },
      },
    },
    orderBy: [{ startDate: "desc" }],
  });

  const formatted = cycles.map((c) => {
    const metrics = computeCycleMetrics(c, c.issues);
    const totalIssues = c.issues.length;
    const completedIssues = c.issues.filter((i) => i.status.category === StatusCategory.COMPLETED).length;
    const totalPoints = c.issues.reduce((sum, i) => sum + (i.estimate ?? 0), 0);
    const completedPoints = c.issues
      .filter((i) => i.status.category === StatusCategory.COMPLETED)
      .reduce((sum, i) => sum + (i.estimate ?? 0), 0);

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      stats: {
        totalIssues,
        completedIssues,
        totalPoints,
        completedPoints,
        issueProgress: totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0,
        pointProgress: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
      },
      metrics: {
        scopePoints: metrics.scopePoints,
        startedPoints: metrics.startedPoints,
        completedPoints: metrics.completedPoints,
        startedPercent: metrics.startedPercent,
        completedPercent: metrics.completedPercent,
        capacityPercent: metrics.capacityPercent,
        daysToStart: metrics.daysToStart,
        series: metrics.series,
      },
    };
  });

  return NextResponse.json({ cycles: formatted });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Hanya Owner/Admin yang dapat membuat cycle" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input cycle tidak valid" }, { status: 400 });
  }

  const cycle = await prisma.cycle.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      status: parsed.data.status,
    },
  });

  return NextResponse.json({ cycle }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchCycleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

  const cycle = await prisma.cycle.updateMany({
    where: { id: parsed.data.id, workspaceId: ctx.workspace.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      status: parsed.data.status,
    },
  });

  return NextResponse.json({ cycle });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.cycle.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
