import { Priority, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { dispatchWebhooks } from "./webhooks";

export const ISSUE_INCLUDE = {
  project: { select: { id: true, name: true, key: true, color: true } },
  status: { select: { id: true, name: true, slug: true, category: true, color: true, position: true } },
  assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
  reporter: { select: { id: true, name: true, email: true, avatarColor: true } },
  cycle: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
  milestone: { select: { id: true, name: true } },
  parent: { select: { id: true, identifier: true, title: true } },
  labels: { include: { label: { select: { id: true, name: true, color: true } } } },
  _count: { select: { subIssues: true, comments: true } },
} as const;

export interface CreateIssueInput {
  workspaceId: string;
  projectId: string;
  title: string;
  description?: string;
  statusId?: string;
  priority?: Priority;
  estimate?: number | null;
  assigneeId?: string | null;
  reporterId?: string | null;
  actorName: string;
  cycleId?: string | null;
  milestoneId?: string | null;
  parentId?: string | null;
  labelIds?: string[];
  customFields?: Record<string, unknown>;
}

export async function createIssueWithSequence(input: CreateIssueInput) {
  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: input.projectId, workspaceId: input.workspaceId },
    });

    if (!project) {
      throw new Error("Project does not belong to workspace");
    }

    const ws = await tx.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
      select: { issuePrefix: true, issueCounter: true },
    });

    const maxIssue = await tx.issue.aggregate({
      where: { workspaceId: input.workspaceId },
      _max: { number: true },
    });

    const prefix = (ws.issuePrefix || "SDG").toUpperCase();
    let number = Math.max(ws.issueCounter, maxIssue._max.number ?? 0) + 1;
    let identifier = `${prefix}-${number}`;

    // Guarantee uniqueness even if historical identifiers exist
    while (
      await tx.issue.findUnique({
        where: { workspaceId_identifier: { workspaceId: input.workspaceId, identifier } },
        select: { id: true },
      })
    ) {
      number += 1;
      identifier = `${prefix}-${number}`;
    }

    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: { issueCounter: number },
    });

    let statusId = input.statusId;
    if (!statusId) {
      const firstStatus = await tx.workflowStatus.findFirst({
        where: { workspaceId: input.workspaceId },
        orderBy: { position: "asc" },
      });
      if (!firstStatus) throw new Error("No workflow status configured");
      statusId = firstStatus.id;
    }

    const maxSort = await tx.issue.aggregate({
      where: { workspaceId: input.workspaceId, statusId },
      _max: { sortOrder: true },
    });

    const issue = await tx.issue.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        number,
        identifier,
        title: input.title,
        description: input.description ?? "",
        statusId,
        priority: input.priority ?? Priority.NONE,
        estimate: input.estimate ?? null,
        assigneeId: input.assigneeId ?? null,
        reporterId: input.reporterId ?? null,
        cycleId: input.cycleId ?? null,
        milestoneId: input.milestoneId ?? null,
        parentId: input.parentId ?? null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1000,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        labels: input.labelIds?.length
          ? { create: input.labelIds.map((labelId) => ({ labelId })) }
          : undefined,
        activities: {
          create: {
            actorId: input.reporterId ?? null,
            actorName: input.actorName,
            action: "CREATED",
            newValue: identifier,
          },
        },
      },
      include: ISSUE_INCLUDE,
    });

    return issue;
  });

  dispatchWebhooks(input.workspaceId, "issue.created", serializeIssue(created));
  return created;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  statusId?: string;
  priority?: Priority;
  estimate?: number | null;
  assigneeId?: string | null;
  projectId?: string;
  cycleId?: string | null;
  milestoneId?: string | null;
  parentId?: string | null;
  labelIds?: string[];
  sortOrder?: number;
  customFields?: Record<string, unknown>;
}

export async function updateIssueWithAudit(
  issueId: string,
  workspaceId: string,
  patch: UpdateIssueInput,
  actor: { id?: string | null; name: string }
) {
  const existing = await prisma.issue.findFirst({
    where: { id: issueId, workspaceId },
    include: {
      status: true,
      assignee: true,
      cycle: true,
    },
  });

  if (!existing) return null;

  const activities: Array<{
    actorId: string | null;
    actorName: string;
    action: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }> = [];

  let statusChanged = false;

  if (patch.statusId !== undefined && patch.statusId !== existing.statusId) {
    const newStatus = await prisma.workflowStatus.findFirst({
      where: { id: patch.statusId, workspaceId },
    });
    if (!newStatus) throw new Error("Invalid statusId");
    statusChanged = true;
    activities.push({
      actorId: actor.id ?? null,
      actorName: actor.name,
      action: "STATUS_CHANGED",
      field: "status",
      oldValue: existing.status.name,
      newValue: newStatus.name,
    });
  }

  if (patch.priority !== undefined && patch.priority !== existing.priority) {
    activities.push({
      actorId: actor.id ?? null,
      actorName: actor.name,
      action: "PRIORITY_CHANGED",
      field: "priority",
      oldValue: existing.priority,
      newValue: patch.priority,
    });
  }

  if (patch.assigneeId !== undefined && patch.assigneeId !== existing.assigneeId) {
    let newAssigneeName = "Unassigned";
    if (patch.assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: patch.assigneeId }, select: { name: true } });
      if (u) newAssigneeName = u.name;
    }
    activities.push({
      actorId: actor.id ?? null,
      actorName: actor.name,
      action: "ASSIGNEE_CHANGED",
      field: "assignee",
      oldValue: existing.assignee?.name ?? "Unassigned",
      newValue: newAssigneeName,
    });
  }

  if (patch.estimate !== undefined && patch.estimate !== existing.estimate) {
    activities.push({
      actorId: actor.id ?? null,
      actorName: actor.name,
      action: "ESTIMATE_CHANGED",
      field: "estimate",
      oldValue: existing.estimate !== null ? `${existing.estimate} pts` : "None",
      newValue: patch.estimate !== null ? `${patch.estimate} pts` : "None",
    });
  }

  if (patch.cycleId !== undefined && patch.cycleId !== existing.cycleId) {
    let newCycleName = "No Cycle";
    if (patch.cycleId) {
      const c = await prisma.cycle.findUnique({ where: { id: patch.cycleId }, select: { name: true } });
      if (c) newCycleName = c.name;
    }
    activities.push({
      actorId: actor.id ?? null,
      actorName: actor.name,
      action: "CYCLE_CHANGED",
      field: "cycle",
      oldValue: existing.cycle?.name ?? "No Cycle",
      newValue: newCycleName,
    });
  }

  if (patch.title !== undefined && patch.title !== existing.title) {
    activities.push({
      actorId: actor.id ?? null,
      actorName: actor.name,
      action: "UPDATED",
      field: "title",
      oldValue: existing.title,
      newValue: patch.title,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (patch.labelIds !== undefined) {
      await tx.issueLabel.deleteMany({ where: { issueId: existing.id } });
      if (patch.labelIds.length > 0) {
        await tx.issueLabel.createMany({
          data: patch.labelIds.map((labelId) => ({ issueId: existing.id, labelId })),
          skipDuplicates: true,
        });
      }
    }

    const issue = await tx.issue.update({
      where: { id: existing.id },
      data: {
        title: patch.title,
        description: patch.description,
        statusId: patch.statusId,
        priority: patch.priority,
        estimate: patch.estimate,
        assigneeId: patch.assigneeId,
        projectId: patch.projectId,
        cycleId: patch.cycleId,
        milestoneId: patch.milestoneId,
        parentId: patch.parentId,
        sortOrder: patch.sortOrder,
        customFields: patch.customFields as Prisma.InputJsonValue | undefined,
        activities: activities.length > 0 ? { create: activities } : undefined,
      },
      include: ISSUE_INCLUDE,
    });

    return issue;
  });

  const serialized = serializeIssue(updated);
  dispatchWebhooks(workspaceId, "issue.updated", serialized);
  if (statusChanged) {
    dispatchWebhooks(workspaceId, "issue.status_changed", {
      ...serialized,
      previousStatus: existing.status.name,
    });
  }

  return updated;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeIssue(issue: any) {
  return {
    id: issue.id,
    identifier: issue.identifier,
    number: issue.number,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    estimate: issue.estimate,
    sortOrder: issue.sortOrder,
    statusId: issue.statusId,
    projectId: issue.projectId,
    assigneeId: issue.assigneeId,
    cycleId: issue.cycleId,
    milestoneId: issue.milestoneId ?? null,
    parentId: issue.parentId,
    customFields: issue.customFields ?? {},
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    project: issue.project,
    status: issue.status,
    assignee: issue.assignee,
    reporter: issue.reporter,
    cycle: issue.cycle,
    milestone: issue.milestone ?? null,
    parent: issue.parent ?? null,
    labels: Array.isArray(issue.labels)
      ? issue.labels.map((il: { label: { id: string; name: string; color: string } }) => il.label)
      : [],
    subIssueCount: issue._count?.subIssues ?? 0,
    commentCount: issue._count?.comments ?? 0,
  };
}
