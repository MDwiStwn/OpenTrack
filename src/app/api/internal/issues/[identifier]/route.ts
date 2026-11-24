import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Priority } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_INCLUDE, serializeIssue, updateIssueWithAudit } from "@/lib/issues";

const updateIssueSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  description: z.string().max(50000).optional(),
  statusId: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  projectId: z.string().optional(),
  cycleId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  customFields: z.record(z.any()).optional(),
});

async function findIssueByIdOrIdentifier(workspaceId: string, idOrIdentifier: string) {
  return prisma.issue.findFirst({
    where: {
      workspaceId,
      OR: [
        { identifier: { equals: idOrIdentifier, mode: "insensitive" } },
        { id: idOrIdentifier },
      ],
    },
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { identifier } = await context.params;

  const issue = await prisma.issue.findFirst({
    where: {
      workspaceId: ctx.workspace.id,
      OR: [
        { identifier: { equals: identifier, mode: "insensitive" } },
        { id: identifier },
      ],
    },
    include: {
      ...ISSUE_INCLUDE,
      subIssues: {
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, email: true, avatarColor: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      timeEntries: {
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 100,
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    issue: {
      ...serializeIssue(issue),
      subIssues: issue.subIssues.map(serializeIssue),
      comments: issue.comments,
      activities: issue.activities,
      timeEntries: issue.timeEntries,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { identifier } = await context.params;
  const target = await findIssueByIdOrIdentifier(ctx.workspace.id, identifier);
  if (!target) {
    return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateIssueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const updated = await updateIssueWithAudit(target.id, ctx.workspace.id, parsed.data, {
      id: ctx.user.id,
      name: ctx.user.name,
    });

    if (!updated) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ issue: serializeIssue(updated) });
  } catch (err) {
    console.error("[Update Issue Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui tiket" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { identifier } = await context.params;
  const target = await findIssueByIdOrIdentifier(ctx.workspace.id, identifier);
  if (!target) {
    return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
  }

  await prisma.issue.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
