import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_INCLUDE, serializeIssue } from "@/lib/issues";
import { computeCycleMetrics } from "@/lib/cycle-metrics";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const cycle = await prisma.cycle.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
    include: {
      issues: {
        include: ISSUE_INCLUDE,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!cycle) {
    return NextResponse.json({ error: "Cycle tidak ditemukan" }, { status: 404 });
  }

  const metrics = computeCycleMetrics(cycle, cycle.issues);

  return NextResponse.json({
    cycle: {
      id: cycle.id,
      name: cycle.name,
      description: cycle.description,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: cycle.status,
    },
    metrics,
    issues: cycle.issues.map(serializeIssue),
  });
}
