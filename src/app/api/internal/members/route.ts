import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { WorkspaceRole } from "@prisma/client";
import { getAuthContext, canManageWorkspace, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(2).max(80),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(100).optional(),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER),
});

const patchMemberSchema = z.object({
  membershipId: z.string(),
  role: z.nativeEnum(WorkspaceRole),
});

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      user: { select: { id: true, name: true, email: true, avatarColor: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.user.id,
      membershipId: m.id,
      name: m.user.name,
      email: m.user.email,
      avatarColor: m.user.avatarColor,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Hanya Owner/Admin yang dapat menambahkan anggota" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input tidak valid" }, { status: 400 });
  }

  if (parsed.data.role === WorkspaceRole.OWNER && ctx.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: "Hanya Owner yang dapat menetapkan peran OWNER" }, { status: 403 });
  }

  let user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  let generatedPassword: string | undefined;
  if (!user) {
    const rawPassword = parsed.data.password || crypto.randomBytes(12).toString("base64url");
    if (!parsed.data.password) generatedPassword = rawPassword;
    const passwordHash = await hashPassword(rawPassword);
    user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      },
    });
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: user.id } },
  });
  if (existingMember) {
    return NextResponse.json({ error: "Pengguna sudah menjadi anggota workspace ini" }, { status: 409 });
  }

  const membership = await prisma.workspaceMember.create({
    data: {
      workspaceId: ctx.workspace.id,
      userId: user.id,
      role: parsed.data.role,
    },
    include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
  });

  return NextResponse.json(
    {
      member: {
        id: membership.user.id,
        membershipId: membership.id,
        name: membership.user.name,
        email: membership.user.email,
        avatarColor: membership.user.avatarColor,
        role: membership.role,
        joinedAt: membership.joinedAt,
      },
      ...(generatedPassword ? { temporaryPassword: generatedPassword } : {}),
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

  const target = await prisma.workspaceMember.findFirst({
    where: { id: parsed.data.membershipId, workspaceId: ctx.workspace.id },
  });
  if (!target) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });

  if (
    (target.role === WorkspaceRole.OWNER || parsed.data.role === WorkspaceRole.OWNER) &&
    ctx.role !== WorkspaceRole.OWNER
  ) {
    return NextResponse.json({ error: "Hanya Owner yang dapat mengubah peran OWNER" }, { status: 403 });
  }

  if (target.role === WorkspaceRole.OWNER && parsed.data.role !== WorkspaceRole.OWNER) {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId: ctx.workspace.id, role: WorkspaceRole.OWNER },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Workspace harus memiliki minimal satu OWNER" }, { status: 400 });
    }
  }

  await prisma.workspaceMember.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membershipId = new URL(req.url).searchParams.get("id");
  if (!membershipId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const target = await prisma.workspaceMember.findFirst({
    where: { id: membershipId, workspaceId: ctx.workspace.id },
  });
  if (!target) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });

  if (target.userId === ctx.user.id) {
    return NextResponse.json({ error: "Tidak dapat menghapus diri sendiri" }, { status: 400 });
  }
  if (target.role === WorkspaceRole.OWNER && ctx.role !== WorkspaceRole.OWNER) {
    return NextResponse.json({ error: "Hanya Owner yang dapat menghapus sesama Owner" }, { status: 403 });
  }

  await prisma.workspaceMember.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
