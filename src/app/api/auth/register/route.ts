import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { DEFAULT_WORKFLOW_STATUSES } from "@/lib/default-statuses";
import { slugify } from "@/lib/types";

const registerSchema = z.object({
  name: z.string().max(80).optional().or(z.literal("")),
  email: z.string().email("Email tidak valid").toLowerCase(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(100),
  workspaceName: z.string().min(2, "Nama workspace minimal 2 karakter").max(60).optional(),
});

const AVATAR_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan pendaftaran. Coba lagi dalam ${rl.retryAfterSec} detik.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const { email, password, workspaceName } = parsed.data;
    const displayName = (parsed.data.name || "").trim() || email;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: displayName, email, passwordHash, avatarColor },
      });

      const wsName = workspaceName?.trim() || `${email.split("@")[0]}'s Workspace`;
      const baseSlug = slugify(wsName) || "workspace";
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const workspace = await tx.workspace.create({
        data: {
          name: wsName,
          slug,
          members: {
            create: { userId: user.id, role: WorkspaceRole.OWNER },
          },
          statuses: {
            create: DEFAULT_WORKFLOW_STATUSES,
          },
          projects: {
            create: {
              name: "Core Platform",
              key: "CORE",
              description: "Default project",
              color: "#6366f1",
            },
          },
          labels: {
            create: [
              { name: "Platform Core", color: "#6366f1" },
              { name: "Bug", color: "#ef4444" },
              { name: "Feature", color: "#10b981" },
            ],
          },
        },
      });

      return { user, workspace };
    });

    await setSessionCookie({ userId: result.user.id, workspaceId: result.workspace.id });

    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          avatarColor: result.user.avatarColor,
        },
        workspace: {
          id: result.workspace.id,
          name: result.workspace.name,
          slug: result.workspace.slug,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Register Error]", err);
    return NextResponse.json({ error: "Gagal mendaftarkan akun" }, { status: 500 });
  }
}
