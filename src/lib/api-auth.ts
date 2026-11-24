import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateRawApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomPart = crypto.randomBytes(24).toString("hex");
  const rawKey = `ot_live_${randomPart}`;
  const keyPrefix = rawKey.slice(0, 14);
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

export interface ApiKeyAuthResult {
  workspaceId: string;
  apiKeyId: string;
  apiKeyName: string;
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuthResult | null> {
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");

  let rawKey: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    rawKey = authHeader.slice(7).trim();
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey || apiKey.revokedAt) {
    return null;
  }

  // Update lastUsedAt asynchronously without blocking the request
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    workspaceId: apiKey.workspaceId,
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
  };
}
