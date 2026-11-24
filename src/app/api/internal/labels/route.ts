import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const labelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().default("#3b82f6"),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const labels = await prisma.label.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ labels });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = labelSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

  const existing = await prisma.label.findUnique({
    where: { workspaceId_name: { workspaceId: ctx.workspace.id, name: parsed.data.name } },
  });
  if (existing) return NextResponse.json({ error: "Label sudah ada" }, { status: 409 });

  const label = await prisma.label.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      color: parsed.data.color,
    },
  });
  return NextResponse.json({ label }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.label.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
