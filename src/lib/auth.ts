import { EncryptJWT, jwtDecrypt } from "jose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { WorkspaceRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "opentrack_session";

const JWT_ISSUER = "opentrack";
const JWT_AUDIENCE = "opentrack-session";

function parseExpiryToSeconds(expr: string): number {
  const m = expr.trim().match(/^(\d+)([smhd])$/i);
  if (!m) return 60 * 60 * 24; // default 24h
  const val = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit === "s") return val;
  if (unit === "m") return val * 60;
  if (unit === "h") return val * 3600;
  if (unit === "d") return val * 86400;
  return 60 * 60 * 24;
}

const SESSION_EXPIRY_EXPR = process.env.JWT_EXPIRES_IN || "24h";
const SESSION_MAX_AGE_SEC = parseExpiryToSeconds(SESSION_EXPIRY_EXPR);

/**
 * Derive a 256-bit AES-GCM encryption key from JWT_SECRET using SHA-256 with domain separation.
 * Using JWE (EncryptJWT + A256GCM) ensures the session token payload is encrypted and authenticated,
 * so it cannot be Base64-decoded by clients or intermediaries.
 */
function getEncryptionKey(): Uint8Array {
  const rawSecret = process.env.JWT_SECRET;
  if (!rawSecret || rawSecret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable must be set (min 32 chars recommended)");
    }
  }
  const effective = rawSecret || "opentrack-local-dev-only-key-do-not-use-in-prod";
  return crypto
    .createHash("sha256")
    .update(`opentrack:jwe:a256gcm:v1:${effective}`)
    .digest();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionPayload {
  userId: string;
  workspaceId: string;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new EncryptJWT({
    sub: payload.userId,
    wid: payload.workspaceId,
    jti: crypto.randomBytes(12).toString("hex"),
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY_EXPR)
    .encrypt(getEncryptionKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtDecrypt(token, getEncryptionKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      contentEncryptionAlgorithms: ["A256GCM"],
      keyManagementAlgorithms: ["dir"],
    });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const workspaceId = typeof payload.wid === "string" ? payload.wid : null;
    if (userId && workspaceId) {
      return { userId, workspaceId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    avatarColor: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    issuePrefix: string;
  };
  role: WorkspaceRole;
}

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
      },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, avatarColor: true },
      },
      workspace: {
        select: { id: true, name: true, slug: true, issuePrefix: true },
      },
    },
  });

  if (!membership) return null;

  return {
    user: membership.user,
    workspace: membership.workspace,
    role: membership.role,
  };
}
