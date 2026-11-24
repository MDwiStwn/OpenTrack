import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const switchSchema = z.object({
  workspaceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "workspaceId wajib diisi" }, { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parsed.data.workspaceId,
        userId: ctx.user.id,
      },
    },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Anda tidak memiliki akses ke workspace tersebut" }, { status: 403 });
  }

  await setSessionCookie({ userId: ctx.user.id, workspaceId: membership.workspaceId });

  return NextResponse.json({
    workspace: membership.workspace,
    role: membership.role,
  });
}
