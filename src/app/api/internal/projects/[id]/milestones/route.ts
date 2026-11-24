import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createMilestoneSchema = z.object({
  name: z.string().min(1, "Nama milestone wajib diisi").max(80),
  description: z.string().max(300).optional(),
  targetDate: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const parsed = createMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input milestone tidak valid" }, { status: 400 });
  }

  const count = await prisma.projectMilestone.count({ where: { projectId: project.id } });
  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId: project.id,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? "",
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
      position: count,
    },
  });

  return NextResponse.json({ milestone }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const milestoneId = new URL(req.url).searchParams.get("milestoneId");
  if (!milestoneId) return NextResponse.json({ error: "Missing milestoneId" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  await prisma.projectMilestone.deleteMany({
    where: { id: milestoneId, projectId: project.id },
  });

  return NextResponse.json({ ok: true });
}
