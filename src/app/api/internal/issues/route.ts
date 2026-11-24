import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Priority, Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createIssueWithSequence, ISSUE_INCLUDE, serializeIssue } from "@/lib/issues";

const createIssueSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Judul tiket wajib diisi").max(250),
  description: z.string().max(50000).optional(),
  statusId: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  cycleId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const statusIds = searchParams.get("statusIds")?.split(",").filter(Boolean);
  const priorities = searchParams.get("priorities")?.split(",").filter(Boolean) as Priority[] | undefined;
  const assigneeIds = searchParams.get("assigneeIds")?.split(",").filter(Boolean);
  const labelIds = searchParams.get("labelIds")?.split(",").filter(Boolean);
  const projectIds = searchParams.get("projectIds")?.split(",").filter(Boolean);
  const cycleId = searchParams.get("cycleId");

  const where: Prisma.IssueWhereInput = {
    workspaceId: ctx.workspace.id,
  };

  if (search) {
    // Support flexible identifier queries like "sdg 1", "sdg1", "mob - 2" -> "SDG-1", "MOB-2"
    const normalizedId = search.replace(/^([a-zA-Z]+)\s*-?\s*(\d+)$/, "$1-$2");
    const compactNoSpace = search.replace(/\s+/g, "-");
    const tokens = search.split(/\s+/).filter(Boolean);

    const searchBranches: Prisma.IssueWhereInput[] = [
      { title: { contains: search, mode: "insensitive" } },
      { identifier: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];

    if (normalizedId !== search) {
      searchBranches.push({ identifier: { contains: normalizedId, mode: "insensitive" } });
    }
    if (compactNoSpace !== search && compactNoSpace !== normalizedId) {
      searchBranches.push({ identifier: { contains: compactNoSpace, mode: "insensitive" } });
    }
    if (tokens.length > 1) {
      searchBranches.push({
        AND: tokens.map((tok) => ({
          OR: [
            { title: { contains: tok, mode: "insensitive" } },
            { identifier: { contains: tok, mode: "insensitive" } },
            { description: { contains: tok, mode: "insensitive" } },
          ],
        })),
      });
    }

    where.OR = searchBranches;
  }
  if (statusIds?.length) where.statusId = { in: statusIds };
  if (priorities?.length) where.priority = { in: priorities };
  if (assigneeIds?.length) {
    if (assigneeIds.includes("unassigned")) {
      const realIds = assigneeIds.filter((id) => id !== "unassigned");
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { assigneeId: null },
            ...(realIds.length ? [{ assigneeId: { in: realIds } }] : []),
          ],
        },
      ];
    } else {
      where.assigneeId = { in: assigneeIds };
    }
  }
  if (projectIds?.length) where.projectId = { in: projectIds };
  if (cycleId === "none") {
    where.cycleId = null;
  } else if (cycleId) {
    where.cycleId = cycleId;
  }
  if (labelIds?.length) {
    where.labels = { some: { labelId: { in: labelIds } } };
  }

  const issues = await prisma.issue.findMany({
    where,
    include: ISSUE_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({
    issues: issues.map(serializeIssue),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createIssueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const issue = await createIssueWithSequence({
      ...parsed.data,
      workspaceId: ctx.workspace.id,
      reporterId: ctx.user.id,
      actorName: ctx.user.name,
    });

    return NextResponse.json({ issue: serializeIssue(issue) }, { status: 201 });
  } catch (err) {
    console.error("[Create Issue Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat tiket" },
      { status: 500 }
    );
  }
}
