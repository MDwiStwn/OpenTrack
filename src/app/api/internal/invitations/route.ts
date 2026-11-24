import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { WorkspaceRole } from "@prisma/client";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createInviteSchema = z.object({
  email: z.string().email("Format email tidak valid").toLowerCase().optional().or(z.literal("")),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ invitations });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Hanya Owner/Admin yang dapat membuat undangan" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Input undangan tidak valid" },
      { status: 400 }
    );
  }

  if (parsed.data.role === WorkspaceRole.OWNER && ctx.role !== WorkspaceRole.OWNER) {
    return NextResponse.json(
      { error: "Hanya Owner yang dapat mengundang dengan peran OWNER" },
      { status: 403 }
    );
  }

  const targetEmail = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;
  const token = `inv_${crypto.randomBytes(18).toString("hex")}`;
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86400000);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: ctx.workspace.id,
      email: targetEmail,
      role: parsed.data.role,
      token,
      invitedById: ctx.user.id,
      expiresAt,
    },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(
    {
      invitation,
      invitePath: `/invite/${invitation.token}`,
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.workspaceInvitation.deleteMany({
    where: { id, workspaceId: ctx.workspace.id },
  });

  return NextResponse.json({ ok: true });
}
