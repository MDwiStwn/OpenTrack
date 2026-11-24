import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthContext, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";

const acceptSchema = z.object({
  mode: z.enum(["current", "login", "register"]).default("current"),
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().toLowerCase().optional(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(100).optional(),
});

const AVATAR_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`invite-get:${ip}`, 30, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { token } = await context.params;
  const inv = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  });

  if (!inv) {
    return NextResponse.json({ error: "Tautan undangan tidak ditemukan atau sudah dicabut" }, { status: 404 });
  }

  const ctx = await getAuthContext();
  const expired = inv.expiresAt.getTime() < Date.now();

  return NextResponse.json({
    invitation: {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      expired,
      workspace: inv.workspace,
      invitedBy: inv.invitedBy,
    },
    currentUser: ctx ? ctx.user : null,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`invite-post:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { token } = await context.params;
  const inv = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
  });

  if (!inv) {
    return NextResponse.json({ error: "Tautan undangan tidak valid" }, { status: 404 });
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Tautan undangan sudah kedaluwarsa" }, { status: 410 });
  }
  if (inv.email && inv.acceptedAt) {
    return NextResponse.json({ error: "Undangan email ini sudah pernah digunakan" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Input tidak valid" },
      { status: 400 }
    );
  }

  let userId: string;
  let userEmail: string;

  if (parsed.data.mode === "current") {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: "Silakan masuk atau daftar terlebih dahulu" }, { status: 401 });
    }
    userId = ctx.user.id;
    userEmail = ctx.user.email;
  } else if (parsed.data.mode === "login") {
    if (!parsed.data.email || !parsed.data.password) {
      return NextResponse.json({ error: "Email dan kata sandi wajib diisi" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
    }
    userId = user.id;
    userEmail = user.email;
  } else {
    // register new global user account
    if (!parsed.data.name || !parsed.data.email || !parsed.data.password) {
      return NextResponse.json({ error: "Nama, email, dan kata sandi wajib diisi" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Gunakan tab 'Masuk dengan Akun yang Ada'." },
        { status: 409 }
      );
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email,
        passwordHash,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      },
    });
    userId = created.id;
    userEmail = created.email;
  }

  // If invitation is locked to a specific email, enforce match
  if (inv.email && inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    return NextResponse.json(
      { error: `Undangan ini khusus untuk email ${inv.email}. Anda masuk sebagai ${userEmail}.` },
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    const existingMember = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
    });
    if (!existingMember) {
      await tx.workspaceMember.create({
        data: {
          workspaceId: inv.workspaceId,
          userId,
          role: inv.role,
        },
      });
    }
    if (inv.email) {
      await tx.workspaceInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date() },
      });
    }
  });

  await setSessionCookie({ userId, workspaceId: inv.workspaceId });

  return NextResponse.json({
    ok: true,
    workspace: inv.workspace,
    role: inv.role,
  });
}
