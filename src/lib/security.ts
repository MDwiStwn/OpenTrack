import dns from "dns/promises";
import net from "net";
import type { NextRequest } from "next/server";

/* -------------------------------------------------------------------------- */
/*  1. Sliding-Window In-Memory Rate Limiter (Auth Brute-Force Protection)    */
/* -------------------------------------------------------------------------- */

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = rateBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  rateBuckets.set(key, bucket);

  // Periodic cleanup to keep memory bounded
  if (rateBuckets.size > 5000) {
    for (const [k, b] of rateBuckets.entries()) {
      if (b.timestamps.every((t) => t <= cutoff)) {
        rateBuckets.delete(k);
      }
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

/* -------------------------------------------------------------------------- */
/*  2. SSRF Protection for Outbound Webhook URLs                              */
/* -------------------------------------------------------------------------- */

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:169.254.") ||
      normalized.startsWith("::ffff:192.168.")
    ) {
      return true;
    }
    return false;
  }

  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "db",
  "postgres",
  "redis",
  "metadata.google.internal",
  "metadata",
]);

export async function validateSafeWebhookUrl(
  rawUrl: string
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Format URL webhook tidak valid" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "URL webhook harus menggunakan protokol http atau https" };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return { ok: false, reason: "URL webhook tidak boleh mengarah ke host internal/localhost" };
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      return { ok: false, reason: "URL webhook tidak boleh mengarah ke IP privat atau loopback" };
    }
    return { ok: true, url: parsed };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) {
      return { ok: false, reason: "Host webhook tidak dapat di-resolve" };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { ok: false, reason: "Host webhook mengarah ke alamat IP internal yang diblokir" };
      }
    }
  } catch {
    return { ok: false, reason: "Gagal memverifikasi DNS host webhook" };
  }

  return { ok: true, url: parsed };
}

/* -------------------------------------------------------------------------- */
/*  3. Magic-Byte Verification for Uploaded Images & Videos                   */
/* -------------------------------------------------------------------------- */

export function verifyMediaMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;

  switch (mime) {
    case "image/png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/jpeg":
    case "image/jpg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/gif": {
      const sig = buffer.subarray(0, 6).toString("ascii");
      return sig === "GIF87a" || sig === "GIF89a";
    }
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "video/mp4":
    case "video/quicktime":
      // ISO Base Media File Format: bytes 4..8 are "ftyp"
      return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "video/webm":
      // EBML header: 1A 45 DF A3
      return (
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
      );
    case "video/ogg":
      return buffer.subarray(0, 4).toString("ascii") === "OggS";
    default:
      return false;
  }
}
