import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Priority, Prisma } from "@prisma/client";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createIssueWithSequence, ISSUE_INCLUDE, serializeIssue } from "@/lib/issues";

const createV1IssueSchema = z.object({
  projectKey: z.string().min(2).max(10),
  title: z.string().min(1).max(250),
  description: z.string().max(50000).optional(),
  status: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  assigneeEmail: z.string().email().optional(),
  assigneeId: z.string().nullable().optional(),
  cycleId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token or X-API-Key header." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get("cycle_id");
  const statusParam = searchParams.get("status");
  const assigneeParam = searchParams.get("assignee");
  const priorityParam = searchParams.get("priority");
  const projectKey = searchParams.get("project_key");
  const labelParam = searchParams.get("label");
  const updatedAfter = searchParams.get("updated_after");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const where: Prisma.IssueWhereInput = {
    workspaceId: auth.workspaceId,
  };

  if (cycleId) where.cycleId = cycleId;
  if (priorityParam && Object.values(Priority).includes(priorityParam as Priority)) {
    where.priority = priorityParam as Priority;
  }
  if (projectKey) {
    where.project = { key: { equals: projectKey, mode: "insensitive" } };
  }
  if (statusParam) {
    where.status = {
      OR: [
        { id: statusParam },
        { slug: { equals: statusParam, mode: "insensitive" } },
        { name: { equals: statusParam, mode: "insensitive" } },
      ],
    };
  }
  if (assigneeParam) {
    where.assignee = {
      OR: [
        { id: assigneeParam },
        { email: { equals: assigneeParam, mode: "insensitive" } },
      ],
    };
  }
  if (labelParam) {
    where.labels = {
      some: {
        label: {
          OR: [
            { id: labelParam },
            { name: { equals: labelParam, mode: "insensitive" } },
          ],
        },
      },
    };
  }
  if (updatedAfter) {
    const parsedDate = new Date(updatedAfter);
    if (!Number.isNaN(parsedDate.getTime())) {
      where.updatedAt = { gte: parsedDate };
    }
  }

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: ISSUE_INCLUDE,
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.issue.count({ where }),
  ]);

  return NextResponse.json({
    data: issues.map(serializeIssue),
    meta: { total, limit, offset },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createV1IssueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        key: { equals: parsed.data.projectKey, mode: "insensitive" },
      },
    });
    if (!project) {
      return NextResponse.json({ error: `Project "${parsed.data.projectKey}" not found` }, { status: 404 });
    }

    let statusId: string | undefined;
    if (parsed.data.status) {
      const st = await prisma.workflowStatus.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          OR: [
            { id: parsed.data.status },
            { slug: { equals: parsed.data.status, mode: "insensitive" } },
            { name: { equals: parsed.data.status, mode: "insensitive" } },
          ],
        },
      });
      if (!st) {
        return NextResponse.json({ error: `Status "${parsed.data.status}" not found` }, { status: 400 });
      }
      statusId = st.id;
    }

    let assigneeId = parsed.data.assigneeId ?? null;
    if (!assigneeId && parsed.data.assigneeEmail) {
      const user = await prisma.user.findUnique({ where: { email: parsed.data.assigneeEmail.toLowerCase() } });
      if (user) assigneeId = user.id;
    }

    const issue = await createIssueWithSequence({
      workspaceId: auth.workspaceId,
      projectId: project.id,
      title: parsed.data.title,
      description: parsed.data.description,
      statusId,
      priority: parsed.data.priority,
      estimate: parsed.data.estimate,
      assigneeId,
      cycleId: parsed.data.cycleId,
      labelIds: parsed.data.labelIds,
      actorName: `API: ${auth.apiKeyName}`,
    });

    return NextResponse.json({ data: serializeIssue(issue) }, { status: 201 });
  } catch (err) {
    console.error("[v1 POST /issues Error]", err);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }
}
