import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StatusCategory } from "@prisma/client";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/types";

const createStatusSchema = z.object({
  name: z.string().min(1).max(60),
  category: z.nativeEnum(StatusCategory),
  color: z.string().default("#71717a"),
});

const patchStatusSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(60).optional(),
  category: z.nativeEnum(StatusCategory).optional(),
  color: z.string().optional(),
  order: z.array(z.string()).optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statuses = await prisma.workflowStatus.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ statuses });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  const slug = slugify(parsed.data.name) || `status-${Date.now()}`;
  const count = await prisma.workflowStatus.count({ where: { workspaceId: ctx.workspace.id } });

  const status = await prisma.workflowStatus.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      slug,
      category: parsed.data.category,
      color: parsed.data.color,
      position: count,
    },
  });

  return NextResponse.json({ status }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  if (parsed.data.order) {
    await prisma.$transaction(
      parsed.data.order.map((statusId, index) =>
        prisma.workflowStatus.updateMany({
          where: { id: statusId, workspaceId: ctx.workspace.id },
          data: { position: index },
        })
      )
    );
    const statuses = await prisma.workflowStatus.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ statuses });
  }

  if (parsed.data.id) {
    const updated = await prisma.workflowStatus.updateMany({
      where: { id: parsed.data.id, workspaceId: ctx.workspace.id },
      data: {
        name: parsed.data.name,
        slug: parsed.data.name ? slugify(parsed.data.name) : undefined,
        category: parsed.data.category,
        color: parsed.data.color,
      },
    });
    return NextResponse.json({ updated });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const issueCount = await prisma.issue.count({ where: { statusId: id, workspaceId: ctx.workspace.id } });
  if (issueCount > 0) {
    return NextResponse.json(
      { error: `Tidak dapat menghapus status yang masih memiliki ${issueCount} tiket aktif` },
      { status: 409 }
    );
  }

  await prisma.workflowStatus.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
