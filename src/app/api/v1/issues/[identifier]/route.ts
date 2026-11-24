import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_INCLUDE, serializeIssue } from "@/lib/issues";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { identifier } = await context.params;

  const issue = await prisma.issue.findFirst({
    where: {
      workspaceId: auth.workspaceId,
      identifier: { equals: identifier, mode: "insensitive" },
    },
    include: {
      ...ISSUE_INCLUDE,
      subIssues: {
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: `Issue "${identifier}" not found` }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...serializeIssue(issue),
      subIssues: issue.subIssues.map(serializeIssue),
      comments: issue.comments,
      activities: issue.activities,
    },
  });
}
