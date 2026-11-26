import { NextRequest, NextResponse } from "next/server";
import { stat, open } from "fs/promises";
import path from "path";
import { getAuthContext } from "@/lib/auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ogv": "video/ogg",
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await context.params;
  const safeName = path.basename(filename);
  if (!safeName || safeName !== filename || !/^[a-zA-Z0-9._-]+$/.test(safeName)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const ext = path.extname(safeName).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  const filePath = path.join(UPLOAD_DIR, safeName);

  const securityHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Frame-Options": "DENY",
  };

  try {
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;
    const range = req.headers.get("range");

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match?.[1] ? parseInt(match[1], 10) : 0;
      const end = match?.[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}`, ...securityHeaders },
        });
      }
      const chunkSize = end - start + 1;

      const fh = await open(filePath, "r");
      const buffer = Buffer.alloc(chunkSize);
      await fh.read(buffer, 0, chunkSize, start);
      await fh.close();

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=31536000, immutable",
          ...securityHeaders,
        },
      });
    }

    const fh = await open(filePath, "r");
    const buffer = Buffer.alloc(fileSize);
    await fh.read(buffer, 0, fileSize, 0);
    await fh.close();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
        ...securityHeaders,
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }
}
