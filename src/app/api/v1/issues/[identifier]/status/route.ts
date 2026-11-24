import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { serializeIssue, updateIssueWithAudit } from "@/lib/issues";

const patchStatusSchema = z.object({
  status: z.string().min(1).optional(),
  statusId: z.string().min(1).optional(),
  statusSlug: z.string().min(1).optional(),
});

export async function PATCH(
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
  });

  if (!issue) {
    return NextResponse.json({ error: `Issue "${identifier}" not found` }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchStatusSchema.safeParse(body);
  const statusQuery = parsed.success
    ? parsed.data.statusId || parsed.data.statusSlug || parsed.data.status
    : undefined;

  if (!statusQuery) {
    return NextResponse.json(
      { error: "Provide 'status', 'statusSlug', or 'statusId' in request body" },
      { status: 400 }
    );
  }

  const targetStatus = await prisma.workflowStatus.findFirst({
    where: {
      workspaceId: auth.workspaceId,
      OR: [
        { id: statusQuery },
        { slug: { equals: statusQuery, mode: "insensitive" } },
        { name: { equals: statusQuery, mode: "insensitive" } },
      ],
    },
  });

  if (!targetStatus) {
    return NextResponse.json({ error: `Workflow status "${statusQuery}" not found` }, { status: 404 });
  }

  const updated = await updateIssueWithAudit(
    issue.id,
    auth.workspaceId,
    { statusId: targetStatus.id },
    { id: null, name: `API: ${auth.apiKeyName}` }
  );

  if (!updated) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeIssue(updated) });
}
