import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createViewSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  isShared: z.boolean().default(true),
  filters: z.record(z.any()).default({}),
  displayConfig: z.record(z.any()).default({}),
});

const patchViewSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  isShared: z.boolean().optional(),
  filters: z.record(z.any()).optional(),
  displayConfig: z.record(z.any()).optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const views = await prisma.savedView.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      OR: [{ isShared: true }, { ownerId: ctx.user.id }],
    },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarColor: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ views });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createViewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

  const view = await prisma.savedView.create({
    data: {
      workspaceId: ctx.workspace.id,
      ownerId: ctx.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      isShared: parsed.data.isShared,
      filters: parsed.data.filters as Prisma.InputJsonValue,
      displayConfig: parsed.data.displayConfig as Prisma.InputJsonValue,
    },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarColor: true } },
    },
  });

  return NextResponse.json({ view }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchViewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

  await prisma.savedView.updateMany({
    where: { id: parsed.data.id, workspaceId: ctx.workspace.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isShared: parsed.data.isShared,
      filters: parsed.data.filters as Prisma.InputJsonValue | undefined,
      displayConfig: parsed.data.displayConfig as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.savedView.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
