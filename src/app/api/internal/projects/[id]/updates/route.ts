import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUpdateSchema = z.object({
  health: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK"]).default("ON_TRACK"),
  body: z.string().min(1, "Isi update tidak boleh kosong").max(20000),
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
  const parsed = createUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  const [update] = await prisma.$transaction([
    prisma.projectUpdate.create({
      data: {
        projectId: project.id,
        authorId: ctx.user.id,
        health: parsed.data.health,
        body: parsed.data.body.trim(),
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarColor: true } },
      },
    }),
    prisma.project.update({
      where: { id: project.id },
      data: { health: parsed.data.health },
    }),
  ]);

  return NextResponse.json({ update }, { status: 201 });
}
