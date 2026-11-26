import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getAuthContext } from "@/lib/auth";
import { verifyMediaMagicBytes } from "@/lib/security";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/ogg": ".ogv",
};

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Ukuran file maksimal 10 MB" }, { status: 413 });
    }

    const mime = file.type.toLowerCase();
    let kind: "image" | "video" | null = null;
    let ext = "";

    if (ALLOWED_IMAGE_TYPES[mime]) {
      kind = "image";
      ext = ALLOWED_IMAGE_TYPES[mime];
    } else if (ALLOWED_VIDEO_TYPES[mime]) {
      kind = "video";
      ext = ALLOWED_VIDEO_TYPES[mime];
    } else {
      return NextResponse.json(
        { error: "Format file tidak didukung. Gunakan PNG, JPG, GIF, WEBP, MP4, WEBM, atau MOV." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!verifyMediaMagicBytes(buffer, mime)) {
      return NextResponse.json(
        { error: "Isi file tidak cocok dengan tipe media yang diizinkan" },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    const fullPath = path.join(UPLOAD_DIR, filename);

    await writeFile(fullPath, buffer);

    return NextResponse.json(
      {
        url: `/api/uploads/${filename}`,
        filename,
        originalName: file.name || filename,
        type: kind,
        mimeType: mime,
        size: file.size,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Upload Error]", err);
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}
