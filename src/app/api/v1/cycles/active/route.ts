import { NextRequest, NextResponse } from "next/server";
import { CycleStatus, StatusCategory } from "@prisma/client";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_INCLUDE, serializeIssue } from "@/lib/issues";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeCycle = await prisma.cycle.findFirst({
    where: {
      workspaceId: auth.workspaceId,
      status: CycleStatus.ACTIVE,
    },
    orderBy: { startDate: "desc" },
  });

  if (!activeCycle) {
    return NextResponse.json({ data: null, message: "No active cycle found" });
  }

  const issues = await prisma.issue.findMany({
    where: {
      workspaceId: auth.workspaceId,
      cycleId: activeCycle.id,
    },
    include: ISSUE_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const totalIssues = issues.length;
  const completedIssues = issues.filter((i) => i.status.category === StatusCategory.COMPLETED).length;
  const totalPoints = issues.reduce((sum, i) => sum + (i.estimate ?? 0), 0);
  const completedPoints = issues
    .filter((i) => i.status.category === StatusCategory.COMPLETED)
    .reduce((sum, i) => sum + (i.estimate ?? 0), 0);

  return NextResponse.json({
    data: {
      cycle: {
        id: activeCycle.id,
        name: activeCycle.name,
        description: activeCycle.description,
        startDate: activeCycle.startDate,
        endDate: activeCycle.endDate,
        status: activeCycle.status,
      },
      stats: {
        totalIssues,
        completedIssues,
        totalPoints,
        completedPoints,
        issueProgress: totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0,
        pointProgress: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
      },
      issues: issues.map(serializeIssue),
    },
  });
}
