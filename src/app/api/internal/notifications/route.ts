import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unreadOnly = new URL(req.url).searchParams.get("unread") === "true";

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true, avatarColor: true } },
        issue: {
          select: {
            id: true,
            identifier: true,
            title: true,
            priority: true,
            status: { select: { id: true, name: true, color: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({
      where: {
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: {
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id === "string") {
    await prisma.notification.updateMany({
      where: {
        id: body.id,
        workspaceId: ctx.workspace.id,
        userId: ctx.user.id,
      },
      data: { readAt: body.unread ? null : new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing id or markAllRead" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.notification.deleteMany({
    where: {
      id,
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
