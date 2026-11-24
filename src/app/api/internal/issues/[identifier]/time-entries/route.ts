import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  action: z.enum(["start", "stop", "manual"]),
  durationSeconds: z.number().int().min(1).max(86400 * 7).optional(),
  stage: z.string().max(60).optional(),
  note: z.string().max(200).optional(),
  date: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { identifier } = await context.params;
  const issue = await prisma.issue.findFirst({
    where: {
      workspaceId: ctx.workspace.id,
      OR: [
        { identifier: { equals: identifier, mode: "insensitive" } },
        { id: identifier },
      ],
    },
    include: { status: { select: { name: true } } },
  });
  if (!issue) return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
  }

  const resolvedStage = parsed.data.stage?.trim() || issue.status.name;

  if (parsed.data.action === "start") {
    const running = await prisma.timeEntry.findFirst({
      where: { issueId: issue.id, userId: ctx.user.id, endedAt: null },
    });
    if (running) {
      return NextResponse.json({ entry: running });
    }
    const entry = await prisma.timeEntry.create({
      data: {
        issueId: issue.id,
        userId: ctx.user.id,
        startedAt: new Date(),
        stage: resolvedStage,
        note: parsed.data.note?.trim() ?? "",
        isManual: false,
      },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    return NextResponse.json({ entry }, { status: 201 });
  }

  if (parsed.data.action === "stop") {
    const running = await prisma.timeEntry.findFirst({
      where: { issueId: issue.id, userId: ctx.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!running) {
      return NextResponse.json({ error: "Tidak ada timer berjalan" }, { status: 404 });
    }
    const now = new Date();
    const elapsed = Math.max(1, Math.floor((now.getTime() - running.startedAt.getTime()) / 1000));
    const entry = await prisma.timeEntry.update({
      where: { id: running.id },
      data: {
        endedAt: now,
        durationSeconds: elapsed,
        note: parsed.data.note?.trim() || running.note,
      },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });
    return NextResponse.json({ entry });
  }

  // manual entry
  const secs = parsed.data.durationSeconds ?? 1800;
  let endTime = new Date();
  if (parsed.data.date) {
    const d = new Date(`${parsed.data.date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (parsed.data.date !== todayStr) {
        endTime = d;
      }
    }
  }
  const startTime = new Date(endTime.getTime() - secs * 1000);

  const entry = await prisma.timeEntry.create({
    data: {
      issueId: issue.id,
      userId: ctx.user.id,
      startedAt: startTime,
      endedAt: endTime,
      durationSeconds: secs,
      stage: resolvedStage,
      note: parsed.data.note?.trim() ?? "",
      isManual: true,
    },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });
  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ identifier: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { identifier } = await context.params;
  const entryId = new URL(req.url).searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "Missing entryId" }, { status: 400 });

  const issue = await prisma.issue.findFirst({
    where: {
      workspaceId: ctx.workspace.id,
      OR: [
        { identifier: { equals: identifier, mode: "insensitive" } },
        { id: identifier },
      ],
    },
  });
  if (!issue) return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });

  await prisma.timeEntry.deleteMany({
    where: { id: entryId, issueId: issue.id },
  });

  return NextResponse.json({ ok: true });
}
