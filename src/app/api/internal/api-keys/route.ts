import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { generateRawApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const createKeySchema = z.object({
  name: z.string().min(2).max(80),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKeys = await prisma.apiKey.findMany({
    where: { workspaceId: ctx.workspace.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ apiKeys });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nama API Key wajib diisi" }, { status: 400 });

  const { rawKey, keyPrefix, keyHash } = generateRawApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      keyPrefix,
      keyHash,
      createdById: ctx.user.id,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ apiKey, rawKey }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.apiKey.updateMany({
    where: { id, workspaceId: ctx.workspace.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
