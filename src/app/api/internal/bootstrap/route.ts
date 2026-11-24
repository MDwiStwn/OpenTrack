import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = ctx.workspace.id;

  const [
    projects,
    statuses,
    labels,
    cycles,
    members,
    savedViews,
    userMemberships,
    unreadNotificationCount,
    templates,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { issues: true } },
        milestones: {
          orderBy: { position: "asc" },
          select: { id: true, name: true, description: true },
        },
      },
    }),
    prisma.workflowStatus.findMany({
      where: { workspaceId },
      orderBy: { position: "asc" },
    }),
    prisma.label.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    }),
    prisma.cycle.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarColor: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.savedView.findMany({
      where: {
        workspaceId,
        OR: [{ isShared: true }, { ownerId: ctx.user.id }],
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarColor: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspaceMember.findMany({
      where: { userId: ctx.user.id },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.notification.count({
      where: { workspaceId, userId: ctx.user.id, readAt: null },
    }),
    prisma.issueTemplate.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  return NextResponse.json({
    user: ctx.user,
    workspace: ctx.workspace,
    role: ctx.role,
    unreadNotificationCount,
    templates,
    workspaces: userMemberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
    projects,
    statuses,
    labels,
    cycles,
    members: members.map((m) => ({
      id: m.user.id,
      membershipId: m.id,
      name: m.user.name,
      email: m.user.email,
      avatarColor: m.user.avatarColor,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    savedViews,
  });
}
