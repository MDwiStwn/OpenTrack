import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const commentSchema = z.object({
  body: z.string().min(1, "Komentar tidak boleh kosong").max(20000),
  mentionedUserIds: z.array(z.string()).optional(),
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
  });

  if (!issue) {
    return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Input tidak valid" },
      { status: 400 }
    );
  }

  // Detect @mentions both from explicit mentionedUserIds and by matching @name / @email in text
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const mentionSet = new Set<string>(parsed.data.mentionedUserIds ?? []);
  const lowerBody = parsed.data.body.toLowerCase();
  for (const m of members) {
    const firstName = m.user.name.split(" ")[0]?.toLowerCase() ?? "";
    if (
      lowerBody.includes(`@${m.user.name.toLowerCase()}`) ||
      lowerBody.includes(`@${m.user.email.toLowerCase()}`) ||
      (firstName.length >= 2 && new RegExp(`@${firstName}\\b`, "i").test(parsed.data.body))
    ) {
      mentionSet.add(m.user.id);
    }
  }
  // Never notify yourself
  mentionSet.delete(ctx.user.id);

  const previewText = parsed.data.body.replace(/\s+/g, " ").trim().slice(0, 140);

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        issueId: issue.id,
        authorId: ctx.user.id,
        body: parsed.data.body,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarColor: true } },
      },
    }),
    prisma.activityLog.create({
      data: {
        issueId: issue.id,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        action: "COMMENTED",
        field: "comment",
        newValue: previewText.slice(0, 120),
      },
    }),
    ...Array.from(mentionSet).map((targetUserId) =>
      prisma.notification.create({
        data: {
          workspaceId: ctx.workspace.id,
          userId: targetUserId,
          actorId: ctx.user.id,
          issueId: issue.id,
          type: "MENTION",
          title: `${ctx.user.name} menyebut Anda di ${issue.identifier}`,
          body: previewText,
        },
      })
    ),
  ]);

  return NextResponse.json({ comment, notifiedCount: mentionSet.size }, { status: 201 });
}
