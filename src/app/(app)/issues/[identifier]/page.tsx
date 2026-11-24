"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Send,
  Trash2,
  GitBranch,
  History,
  MessageSquare,
  Edit3,
  Check,
  ArrowRight,
  UserCheck,
  CheckSquare,
  Loader2,
  Building2,
  ChevronRight,
  LayoutGrid,
  ImagePlus,
  Film,
  AtSign,
} from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PriorityIcon } from "@/components/IssueCard";
import { RichMarkdownEditor, uploadMediaFile } from "@/components/RichMarkdownEditor";
import {
  MarkdownRenderer,
  toggleMarkdownCheckbox,
  countMarkdownCheckboxes,
} from "@/components/MarkdownRenderer";
import {
  IssuePropertiesSidebar,
  type IssueCustomFields,
  type TimeEntryDTO,
} from "@/components/IssuePropertiesSidebar";
import { getInitials, type IssueDTO } from "@/lib/types";

interface CommentDTO {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string; avatarColor: string };
}

interface ActivityDTO {
  id: string;
  actorName: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface IssueDetailDTO extends IssueDTO {
  customFields?: IssueCustomFields;
  subIssues: IssueDTO[];
  comments: CommentDTO[];
  activities: ActivityDTO[];
  timeEntries?: TimeEntryDTO[];
}

function IssueDetailInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const identifier = String(params.identifier);
  const { data, openCreateModal, issueVersion, showToast } = useWorkspace();

  const fromView = searchParams.get("fromView");
  const fromPath = searchParams.get("fromPath");
  const fromLabel = searchParams.get("fromLabel");

  const resolvedViewName =
    fromLabel ||
    (fromView ? data?.savedViews.find((v) => v.id === fromView)?.name : null) ||
    "View";

  const backHref = fromView
    ? `/views/${encodeURIComponent(fromView)}`
    : fromPath || "/board";

  const [issue, setIssue] = useState<IssueDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingCommentMedia, setPendingCommentMedia] = useState<
    Array<{ url: string; type: "image" | "video"; originalName: string }>
  >([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingCommentMedia, setUploadingCommentMedia] = useState(false);
  const commentImgRef = useRef<HTMLInputElement | null>(null);
  const commentVidRef = useRef<HTMLInputElement | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loadIssue = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/issues/${encodeURIComponent(identifier)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setIssue(json.issue);
        setTitleDraft(json.issue.title);
        setDescDraft(json.issue.description || "");
      } else {
        setIssue(null);
      }
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    void loadIssue();
  }, [loadIssue, issueVersion]);

  const checklistStats = useMemo(
    () => countMarkdownCheckboxes(issue?.description || ""),
    [issue?.description]
  );

  const nextStatus = useMemo(() => {
    if (!issue || !data?.statuses.length) return null;
    const idx = data.statuses.findIndex((s) => s.id === issue.statusId);
    if (idx === -1 || idx >= data.statuses.length - 1) return null;
    return data.statuses[idx + 1];
  }, [issue, data?.statuses]);

  async function patchIssue(patch: Record<string, unknown>, successMsg?: string) {
    if (!issue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/internal/issues/${encodeURIComponent(issue.identifier)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Gagal menyimpan perubahan", { type: "error" });
        return;
      }
      await loadIssue();
      if (successMsg) showToast(successMsg);
    } catch {
      showToast("Gagal terhubung ke server", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveContent() {
    if (!titleDraft.trim()) {
      showToast("Judul tiket tidak boleh kosong", { type: "error" });
      return;
    }
    await patchIssue(
      { title: titleDraft.trim(), description: descDraft },
      "Deskripsi & judul tiket diperbarui"
    );
    setEditingDesc(false);
  }

  async function handleToggleChecklist(checkboxIndex: number) {
    if (!issue) return;
    const updatedDescription = toggleMarkdownCheckbox(issue.description || "", checkboxIndex);
    // Optimistic update for instant checkbox response
    setIssue((prev) => (prev ? { ...prev, description: updatedDescription } : prev));
    setDescDraft(updatedDescription);

    try {
      const res = await fetch(`/api/internal/issues/${encodeURIComponent(issue.identifier)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: updatedDescription }),
      });
      if (!res.ok) {
        await loadIssue();
        showToast("Gagal memperbarui checklist", { type: "error" });
      }
    } catch {
      await loadIssue();
      showToast("Gagal terhubung ke server", { type: "error" });
    }
  }

  async function handleCommentMediaFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadingCommentMedia(true);
    try {
      const uploadedItems: Array<{ url: string; type: "image" | "video"; originalName: string }> = [];
      for (const f of list) {
        const uploaded = await uploadMediaFile(f);
        uploadedItems.push(uploaded);
      }
      setPendingCommentMedia((prev) => [...prev, ...uploadedItems]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal mengunggah media", { type: "error" });
    } finally {
      setUploadingCommentMedia(false);
    }
  }

  function handleCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
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
      void handleCommentMediaFiles(mediaFiles);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if ((!commentBody.trim() && pendingCommentMedia.length === 0) || !issue) return;
    setSubmittingComment(true);
    try {
      const mediaMarkdown = pendingCommentMedia
        .map((m) =>
          m.type === "image"
            ? `![${m.originalName}](${m.url})`
            : `[Video: ${m.originalName}](${m.url})`
        )
        .join("\n\n");
      const finalBody = [commentBody.trim(), mediaMarkdown].filter(Boolean).join("\n\n");

      const res = await fetch(`/api/internal/issues/${encodeURIComponent(issue.identifier)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: finalBody, mentionedUserIds }),
      });
      if (res.ok) {
        const json = await res.json();
        setCommentBody("");
        setMentionedUserIds([]);
        setMentionQuery(null);
        setPendingCommentMedia([]);
        await loadIssue();
        showToast(
          json.notifiedCount > 0
            ? `Komentar terkirim (${json.notifiedCount} anggota ditandai ke Inbox)`
            : "Komentar ditambahkan"
        );
      } else {
        showToast("Gagal menambahkan komentar", { type: "error" });
      }
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleCommentChange(val: string) {
    setCommentBody(val);
    const cursor = commentTextareaRef.current?.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: { id: string; name: string }) {
    const el = commentTextareaRef.current;
    const cursor = el?.selectionStart ?? commentBody.length;
    const before = commentBody.slice(0, cursor);
    const after = commentBody.slice(cursor);
    const replacedBefore = before.replace(/@([^\s@]*)$/, `@${member.name} `);
    const next = replacedBefore.endsWith(`@${member.name} `)
      ? replacedBefore + after
      : `${before}${before.endsWith(" ") || !before ? "" : " "}@${member.name} ${after}`;
    setCommentBody(next);
    setMentionedUserIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionQuery(null);
    requestAnimationFrame(() => el?.focus());
  }

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !data?.members) return [];
    return data.members.filter(
      (m) =>
        m.name.toLowerCase().includes(mentionQuery) ||
        m.email.toLowerCase().includes(mentionQuery)
    );
  }, [mentionQuery, data?.members]);

  async function handleDelete() {
    if (!issue) return;
    if (!confirm(`Hapus tiket ${issue.identifier} secara permanen?`)) return;
    const res = await fetch(`/api/internal/issues/${encodeURIComponent(issue.identifier)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      showToast(`Tiket ${issue.identifier} dihapus`);
      router.push(backHref);
    }
  }

  if (loading) {
    return <div className="p-8 text-xs text-zinc-500">Memuat detail tiket...</div>;
  }

  if (!issue) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-zinc-300">Tiket {identifier} tidak ditemukan.</p>
        <Link href="/board" className="text-xs text-indigo-400 hover:underline">
          ← Kembali ke Board
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      {/* Top Contextual Breadcrumb + Quick Work Actions Bar */}
      <header className="h-11 px-4 border-b border-[#1c1c24] bg-[#0f0f12] flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
          <Link
            href={backHref}
            aria-label="Kembali ke halaman sebelumnya"
            title="Kembali"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a22] transition shrink-0"
          >
            <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/board"
            className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition truncate max-w-[170px]"
          >
            <Building2 aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{data?.workspace.name ?? "Workspace"}</span>
          </Link>

          <ChevronRight aria-hidden="true" className="hidden sm:block w-3.5 h-3.5 text-zinc-600 shrink-0" />

          {fromView ? (
            <>
              <Link
                href={`/views/${encodeURIComponent(fromView)}`}
                className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition truncate max-w-[180px]"
              >
                <LayoutGrid aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="truncate">{resolvedViewName}</span>
              </Link>
              <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            </>
          ) : fromPath && fromLabel ? (
            <>
              <Link
                href={fromPath}
                className="text-zinc-300 hover:text-white transition truncate max-w-[160px]"
              >
                {fromLabel}
              </Link>
              <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            </>
          ) : (
            <>
              <Link
                href={`/board?projectId=${issue.projectId}`}
                className="text-zinc-300 hover:text-white transition truncate max-w-[160px]"
              >
                {issue.project.name}
              </Link>
              <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            </>
          )}

          <span className="font-mono font-medium text-zinc-100 shrink-0">{issue.identifier}</span>

          {issue.parent && (
            <Link
              href={`/issues/${issue.parent.identifier}`}
              className="ml-1 px-2 py-0.5 rounded bg-[#181820] border border-[#262632] text-[11px] text-zinc-300 hover:text-white shrink-0"
            >
              Parent: {issue.parent.identifier}
            </Link>
          )}
          {saving && (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 ml-2 shrink-0">
              <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin" /> Menyimpan...
            </span>
          )}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {data?.user && issue.assigneeId !== data.user.id && (
            <button
              onClick={() => patchIssue({ assigneeId: data.user.id }, `Tiket di-assign ke ${data.user.name}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border-default text-xs text-zinc-200 transition"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              Ambil Tiket
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() =>
                patchIssue({ statusId: nextStatus.id }, `Status dipindahkan ke ${nextStatus.name}`)
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition"
            >
              Lanjut: {nextStatus.name}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Hapus Tiket"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Main Content (full width fit) */}
        <div className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
          {/* Title & Description */}
          <div className="space-y-3">
            {editingDesc ? (
              <div className="space-y-3">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-full text-xl font-semibold bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
                <RichMarkdownEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  minHeightClass="min-h-[340px]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveContent}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                  >
                    <Check className="w-3.5 h-3.5" /> Simpan Perubahan
                  </button>
                  <button
                    onClick={() => {
                      setTitleDraft(issue.title);
                      setDescDraft(issue.description || "");
                      setEditingDesc(false);
                    }}
                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold text-zinc-100 leading-snug">{issue.title}</h1>
                    {checklistStats.total > 0 && (
                      <div className="inline-flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 border border-border-subtle font-mono tabular-nums">
                          <CheckSquare className="w-3 h-3 text-emerald-400" />
                          {checklistStats.checked}/{checklistStats.total} checklist selesai
                        </span>
                        <span className="text-zinc-500">· Klik kotak centang di bawah untuk update langsung</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingDesc(true)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 border border-border-default text-xs text-zinc-300"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Deskripsi
                  </button>
                </div>
                <div className="mt-4 rounded-xl bg-surface-1 border border-border-subtle p-5 min-h-[100px]">
                  {issue.description ? (
                    <MarkdownRenderer
                      content={issue.description}
                      onToggleCheckbox={handleToggleChecklist}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-xs text-zinc-500 italic">
                      Belum ada deskripsi. Klik Edit Deskripsi untuk mengisi atau memakai template Linear.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sub-Issues */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                Sub-Issues ({issue.subIssues.length})
              </h2>
              <button
                onClick={() =>
                  openCreateModal({
                    projectId: issue.projectId,
                    cycleId: issue.cycleId ?? undefined,
                    parentId: issue.id,
                  })
                }
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-border-default text-[11px] text-zinc-300"
              >
                <Plus className="w-3 h-3" /> Tambah Sub-Issue
              </button>
            </div>

            {issue.subIssues.length > 0 ? (
              <div className="rounded-lg border border-border-subtle bg-surface-1 divide-y divide-border-subtle/70">
                {issue.subIssues.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/issues/${sub.identifier}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-surface-2 transition text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PriorityIcon priority={sub.priority} className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono text-[11px] text-zinc-400">{sub.identifier}</span>
                      <span className="text-zinc-200 truncate">{sub.title}</span>
                    </div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                      style={{ backgroundColor: `${sub.status.color}20`, color: sub.status.color }}
                    >
                      {sub.status.name}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Belum ada sub-issue.</p>
            )}
          </section>

          {/* Comments */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Komentar ({issue.comments.length})
            </h2>

            <div className="space-y-2.5">
              {issue.comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-surface-1 border border-border-subtle p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white"
                        style={{ backgroundColor: c.author.avatarColor }}
                      >
                        {getInitials(c.author.name)}
                      </div>
                      <span className="text-xs font-medium text-zinc-200">{c.author.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(c.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <MarkdownRenderer content={c.body} className="text-xs" />
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="space-y-2">
              <input
                ref={commentImgRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void handleCommentMediaFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={commentVidRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/ogg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void handleCommentMediaFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="relative rounded-lg bg-[#131318] border border-[#242430] overflow-visible">
                <textarea
                  ref={commentTextareaRef}
                  rows={3}
                  value={commentBody}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  onPaste={handleCommentPaste}
                  placeholder="Tulis komentar, ketik @nama untuk menandai anggota, tempel screenshot (Ctrl+V), atau unggah gambar/video..."
                  className="w-full bg-transparent p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none"
                />

                {/* @mention autocomplete dropdown */}
                {mentionQuery !== null && mentionCandidates.length > 0 && (
                  <div className="mx-3 mb-2 rounded-lg bg-[#16161e] border border-[#2d2d3d] shadow-2xl py-1 max-h-44 overflow-y-auto">
                    <p className="px-2.5 py-1 text-[10px] text-zinc-500">
                      Pilih anggota untuk di-tag (kirim notifikasi ke Inbox):
                    </p>
                    {mentionCandidates.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => insertMention(m)}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-xs text-zinc-200 hover:bg-[#222230]"
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: m.avatarColor }}
                        >
                          {getInitials(m.name)}
                        </span>
                        <span className="font-medium truncate">{m.name}</span>
                        <span className="text-[11px] text-zinc-500 truncate ml-auto">{m.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Visual Media Preview before sending */}
                {pendingCommentMedia.length > 0 && (
                  <div className="px-3 pb-3 flex flex-wrap gap-2">
                    {pendingCommentMedia.map((item, idx) => (
                      <div
                        key={`${item.url}-${idx}`}
                        className="relative rounded-lg overflow-hidden border border-[#2a2a36] bg-[#0d0d11] w-40"
                      >
                        {item.type === "video" ? (
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
                            alt={item.originalName}
                            className="w-full h-24 object-cover bg-[#0b0b0e]"
                          />
                        )}
                        <div className="px-2 py-1 text-[10px] text-zinc-400 truncate">
                          {item.originalName}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingCommentMedia((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`Hapus ${item.originalName}`}
                          className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/80 text-[10px] text-zinc-200 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-3 py-2 border-t border-[#1e1e28] bg-[#101014] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMentionQuery((q) => (q === null ? "" : null))}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-[#1c1c24] transition"
                    >
                      <AtSign aria-hidden="true" className="w-3.5 h-3.5" />
                      Mention
                    </button>
                    <button
                      type="button"
                      disabled={uploadingCommentMedia}
                      onClick={() => commentImgRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-[#1c1c24] disabled:opacity-50 transition"
                    >
                      {uploadingCommentMedia ? (
                        <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImagePlus aria-hidden="true" className="w-3.5 h-3.5" />
                      )}
                      Gambar
                    </button>
                    <button
                      type="button"
                      disabled={uploadingCommentMedia}
                      onClick={() => commentVidRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-[#1c1c24] disabled:opacity-50 transition"
                    >
                      <Film aria-hidden="true" className="w-3.5 h-3.5" />
                      Video
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      submittingComment ||
                      uploadingCommentMedia ||
                      (!commentBody.trim() && pendingCommentMedia.length === 0)
                    }
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#5e6ad2] hover:bg-[#6c77e0] disabled:opacity-50 text-xs font-medium text-white transition"
                  >
                    <Send aria-hidden="true" className="w-3 h-3" />
                    Kirim Komentar
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Activity Log / Audit Trail */}
          <section className="space-y-2.5 pt-2 border-t border-border-subtle">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Activity Log ({issue.activities.length})
            </h2>
            <div className="space-y-1.5">
              {issue.activities.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-3 text-xs py-1">
                  <div className="text-zinc-400">
                    <span className="font-medium text-zinc-200">{act.actorName}</span>{" "}
                    {act.action === "CREATED" && (
                      <span>
                        membuat tiket <span className="font-mono text-zinc-300">{act.newValue}</span>
                      </span>
                    )}
                    {act.action === "COMMENTED" && <span>menambahkan komentar</span>}
                    {act.action !== "CREATED" && act.action !== "COMMENTED" && (
                      <span>
                        mengubah <span className="text-zinc-300">{act.field}</span> dari{" "}
                        <span className="px-1 py-0.5 rounded bg-surface-2 text-zinc-400">
                          {act.oldValue ?? "-"}
                        </span>{" "}
                        →{" "}
                        <span className="px-1 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                          {act.newValue ?? "-"}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                    {new Date(act.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Properties, Custom Fields, Workflow & Time Tracking Sidebar (1:1 Linear) */}
        <IssuePropertiesSidebar
          issue={issue}
          onPatchIssue={patchIssue}
          onRefreshIssue={loadIssue}
        />
      </div>
    </div>
  );
}

export default function IssueDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500">Memuat detail tiket...</div>}>
      <IssueDetailInner />
    </Suspense>
  );
}
