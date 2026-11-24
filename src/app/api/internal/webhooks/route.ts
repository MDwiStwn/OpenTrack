import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getAuthContext, canManageWorkspace } from "@/lib/auth";
import { validateSafeWebhookUrl } from "@/lib/security";
import { prisma } from "@/lib/prisma";

const createWebhookSchema = z.object({
  name: z.string().min(2).max(80),
  url: z.string().url("URL webhook tidak valid"),
  secret: z.string().min(8).max(128).optional(),
  events: z
    .array(z.enum(["issue.created", "issue.updated", "issue.status_changed"]))
    .min(1, "Pilih minimal satu event"),
});

const patchWebhookSchema = z.object({
  id: z.string(),
  isActive: z.boolean().optional(),
  events: z.array(z.enum(["issue.created", "issue.updated", "issue.status_changed"])).optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const webhooks = await prisma.webhook.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, event: true, statusCode: true, success: true, error: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ webhooks });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Input tidak valid" }, { status: 400 });
  }

  const safeCheck = await validateSafeWebhookUrl(parsed.data.url);
  if (!safeCheck.ok) {
    return NextResponse.json({ error: safeCheck.reason }, { status: 400 });
  }

  const secret = parsed.data.secret || `whsec_${crypto.randomBytes(16).toString("hex")}`;

  const webhook = await prisma.webhook.create({
    data: {
      workspaceId: ctx.workspace.id,
      name: parsed.data.name,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
    },
  });

  return NextResponse.json({ webhook }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });

  await prisma.webhook.updateMany({
    where: { id: parsed.data.id, workspaceId: ctx.workspace.id },
    data: {
      isActive: parsed.data.isActive,
      events: parsed.data.events,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.webhook.deleteMany({ where: { id, workspaceId: ctx.workspace.id } });
  return NextResponse.json({ ok: true });
}
