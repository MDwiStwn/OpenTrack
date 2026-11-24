import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTemplateSchema = z.object({
  name: z.string().min(2, "Nama template minimal 2 karakter").max(80),
  description: z.string().max(300).optional(),
  content: z.string().max(50000),
  isDefault: z.boolean().optional(),
});

const patchTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(300).optional(),
  content: z.string().max(50000).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.issueTemplate.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Hanya Owner/Admin yang dapat mengelola template" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Input template tidak valid" },
      { status: 400 }
    );
  }

  const template = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.issueTemplate.updateMany({
        where: { workspaceId: ctx.workspace.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.issueTemplate.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() ?? "",
        content: parsed.data.content,
        isDefault: Boolean(parsed.data.isDefault),
      },
    });
  });

  return NextResponse.json({ template }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.issueTemplate.updateMany({
        where: { workspaceId: ctx.workspace.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.issueTemplate.updateMany({
      where: { id: parsed.data.id, workspaceId: ctx.workspace.id },
      data: {
        name: parsed.data.name?.trim(),
        description: parsed.data.description?.trim(),
        content: parsed.data.content,
        isDefault: parsed.data.isDefault,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.issueTemplate.deleteMany({
    where: { id, workspaceId: ctx.workspace.id },
  });

  return NextResponse.json({ ok: true });
}
