"use client";

import { useState, useRef } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Table,
  Link as LinkIcon,
  Code,
  FileText,
  Eye,
  Edit3,
  Columns2,
  ImagePlus,
  Film,
  Loader2,
  X,
} from "lucide-react";
import { getIssueTemplates } from "@/lib/issue-templates";
import { MarkdownRenderer, toggleMarkdownCheckbox } from "./MarkdownRenderer";
import { useWorkspace } from "./WorkspaceProvider";

const UPLOAD_LINK_RE = /(!?\[([^\]]*)\]\((\/api\/uploads\/[^)\s]+)\))/g;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|ogv)$/i;

interface RichMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  showTemplates?: boolean;
}

export async function uploadMediaFile(file: File): Promise<{ url: string; type: "image" | "video"; originalName: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/internal/uploads", {
    method: "POST",
    body: fd,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Gagal mengunggah media");
  }
  return json;
}

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder = "Tulis deskripsi detail (mendukung Markdown, Tabel, Checklist, Gambar & Video, atau tempel screenshot dengan Ctrl+V)...",
  minHeightClass = "min-h-[260px]",
  showTemplates = true,
}: RichMarkdownEditorProps) {
  const { data } = useWorkspace();
  const [mode, setMode] = useState<"write" | "split" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const builtinTemplates = getIssueTemplates();
  const templates =
    data?.templates && data.templates.length > 0
      ? [...data.templates, ...builtinTemplates]
      : builtinTemplates;

  function insertText(before: string, after = "", defaultPlaceholder = "") {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + before + defaultPlaceholder + after);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || defaultPlaceholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  async function handleFilesUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setUploadErr("");
    try {
      let appended = "";
      for (const file of list) {
        const uploaded = await uploadMediaFile(file);
        if (uploaded.type === "image") {
          appended += `\n![${uploaded.originalName}](${uploaded.url})\n`;
        } else {
          appended += `\n[Video: ${uploaded.originalName}](${uploaded.url})\n`;
        }
      }
      insertText(appended);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Gagal mengunggah file");
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const mediaFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))) {
        const f = item.getAsFile();
        if (f) mediaFiles.push(f);
      }
    }
    if (mediaFiles.length > 0) {
      e.preventDefault();
      void handleFilesUpload(mediaFiles);
    }
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    if (value.trim() && tpl.id !== "blank") {
      if (!confirm("Ganti isi deskripsi saat ini dengan template yang dipilih?")) return;
    }
    onChange(tpl.content);
  }

  // Extract uploaded media items so user sees live visual thumbnails/video previews before saving
  const attachedMedia: Array<{ raw: string; label: string; url: string; isVideo: boolean }> = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(UPLOAD_LINK_RE.source, "g");
  while ((m = re.exec(value)) !== null) {
    attachedMedia.push({
      raw: m[1],
      label: m[2] || "Lampiran",
      url: m[3],
      isVideo: VIDEO_EXT_RE.test(m[3]),
    });
  }

  function removeAttachedMedia(rawToken: string) {
    onChange(value.replace(rawToken, "").replace(/\n{3,}/g, "\n\n").trim());
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-2/50 overflow-hidden flex flex-col">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFilesUpload(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/ogg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFilesUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Toolbar */}
      <div className="px-2.5 py-1.5 bg-surface-2 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-0.5">
          {showTemplates && (
            <div className="flex items-center gap-1 mr-2 pr-2 border-r border-border-default">
              <FileText aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <select
                aria-label="Pilih template deskripsi"
                value=""
                onChange={(e) => {
                  if (e.target.value) applyTemplate(e.target.value);
                }}
                className="text-[11px] bg-surface-3 border border-border-default rounded px-1.5 py-0.5 text-zinc-200 cursor-pointer"
              >
                <option value="">+ Gunakan Template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            aria-label="Heading 2"
            title="Heading 2"
            onClick={() => insertText("\n## ", "\n", "Judul Bagian")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <Heading2 aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Heading 3"
            title="Heading 3"
            onClick={() => insertText("\n### ", "\n", "Sub Judul")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <Heading3 aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Tebal"
            title="Bold"
            onClick={() => insertText("**", "**", "teks tebal")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <Bold aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Miring"
            title="Italic"
            onClick={() => insertText("_", "_", "teks miring")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <Italic aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Daftar poin"
            title="Bullet List"
            onClick={() => insertText("\n- ", "", "Item daftar")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <List aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Daftar bernomor"
            title="Numbered List"
            onClick={() => insertText("\n1. ", "", "Langkah pertama")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <ListOrdered aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Checklist"
            title="Checklist / Acceptance Criteria"
            onClick={() => insertText("\n- [ ] ", "", "Kriteria penerimaan")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <CheckSquare aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Sisipkan Tabel"
            title="Sisipkan Tabel (Field | Detail)"
            onClick={() =>
              insertText(
                "\n| Field | Detail |\n| :--- | :--- |\n| Field 1 | Nilai 1 |\n| Field 2 | Nilai 2 |\n"
              )
            }
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <Table aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Sisipkan Link"
            title="Link"
            onClick={() => insertText("[", "](https://)", "Judul Link")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <LinkIcon aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Kode"
            title="Code"
            onClick={() => insertText("`", "`", "kode")}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition"
          >
            <Code aria-hidden="true" className="w-3.5 h-3.5" />
          </button>

          {/* Media Upload Buttons */}
          <div className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-border-default">
            <button
              type="button"
              disabled={uploading}
              aria-label="Unggah Gambar"
              title="Upload Gambar (PNG, JPG, GIF, WEBP)"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-zinc-300 hover:text-white hover:bg-surface-3 disabled:opacity-50 transition"
            >
              {uploading ? (
                <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImagePlus aria-hidden="true" className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Gambar</span>
            </button>
            <button
              type="button"
              disabled={uploading}
              aria-label="Unggah Video"
              title="Upload Video (MP4, WEBM, MOV)"
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[11px] text-zinc-300 hover:text-white hover:bg-surface-3 disabled:opacity-50 transition"
            >
              <Film aria-hidden="true" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Video</span>
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="inline-flex rounded-md bg-surface-1 border border-border-subtle p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
              mode === "write" ? "bg-surface-3 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Edit3 aria-hidden="true" className="w-3 h-3" /> Write
          </button>
          <button
            type="button"
            onClick={() => setMode("split")}
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded transition ${
              mode === "split" ? "bg-surface-3 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Columns2 aria-hidden="true" className="w-3 h-3" /> Split
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
              mode === "preview" ? "bg-surface-3 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Eye aria-hidden="true" className="w-3 h-3" /> Preview
          </button>
        </div>
      </div>

      {uploadErr && (
        <div className="px-3 py-1.5 bg-red-500/15 border-b border-red-500/30 text-[11px] text-red-300">
          {uploadErr}
        </div>
      )}

      {/* Editor / Preview Body */}
      <div
        className={`grid ${
          mode === "split"
            ? "grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle"
            : "grid-cols-1"
        }`}
      >
        {(mode === "write" || mode === "split") && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder}
            className={`w-full ${minHeightClass} max-h-[55vh] p-3 bg-transparent text-xs font-mono leading-relaxed text-zinc-200 placeholder-zinc-500 resize-y`}
          />
        )}

        {(mode === "preview" || mode === "split") && (
          <div className={`${minHeightClass} max-h-[55vh] overflow-y-auto p-3.5 bg-surface-1/60 text-xs`}>
            {value.trim() ? (
              <MarkdownRenderer
                content={value}
                onToggleCheckbox={(idx) => onChange(toggleMarkdownCheckbox(value, idx))}
              />
            ) : (
              <p className="text-zinc-500 italic">Preview akan muncul di sini...</p>
            )}
          </div>
        )}
      </div>

      {/* Live Visual Media Preview Strip (visible in Write mode before saving!) */}
      {mode === "write" && attachedMedia.length > 0 && (
        <div className="px-3 py-2.5 border-t border-border-subtle bg-[#101014] space-y-1.5">
          <p className="text-[10px] font-medium text-zinc-500">
            Lampiran Media ({attachedMedia.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {attachedMedia.map((item, idx) => (
              <div
                key={`${item.url}-${idx}`}
                className="relative group rounded-lg overflow-hidden border border-[#272732] bg-[#15151b] w-36"
              >
                {item.isVideo ? (
                  <video
                    src={item.url}
                    controls
                    preload="metadata"
                    className="w-full h-24 object-cover bg-black"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.url}
                    alt={item.label}
                    className="w-full h-24 object-cover bg-[#0b0b0e]"
                  />
                )}
                <div className="px-1.5 py-1 text-[10px] text-zinc-400 truncate">
                  {item.label}
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachedMedia(item.raw)}
                  aria-label={`Hapus ${item.label}`}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/75 text-zinc-200 hover:text-red-400"
                >
                  <X aria-hidden="true" className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
