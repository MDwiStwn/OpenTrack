"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Box,
  Plus,
  Diamond,
  ExternalLink,
  Trash2,
  Edit3,
  Check,
  Calendar,
  Send,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { IssuesWorkspace } from "@/components/IssuesWorkspace";
import { PriorityIcon } from "@/components/IssueCard";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { RichMarkdownEditor } from "@/components/RichMarkdownEditor";
import { PRIORITIES, getInitials, type PriorityValue, type UserRef } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectMilestoneItem {
  id: string;
  name: string;
  description: string;
  targetDate: string | null;
  totalIssues: number;
  completedIssues: number;
  progressPercent: number;
}

interface ProjectUpdateItem {
  id: string;
  health: string;
  body: string;
  createdAt: string;
  author: UserRef;
}

interface ProjectActivityItem {
  id: string;
  actorName: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  issue: { id: string; identifier: string; title: string };
}

interface ProjectResource {
  id: string;
  title: string;
  url: string;
}

interface ProjectDetailDTO {
  id: string;
  name: string;
  key: string;
  summary: string;
  description: string;
  color: string;
  status: string;
  health: string;
  priority: PriorityValue;
  leadId: string | null;
  lead: UserRef | null;
  startDate: string | null;
  targetDate: string | null;
  resources: ProjectResource[];
  milestones: ProjectMilestoneItem[];
  updates: ProjectUpdateItem[];
  activities: ProjectActivityItem[];
  stats: {
    totalIssues: number;
    completedIssues: number;
    totalPoints: number;
    progressPercent: number;
  };
}

const PROJECT_STATUSES = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELED", label: "Canceled" },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id);
  const { data, refresh, openCreateModal, showToast } = useWorkspace();

  const [project, setProject] = useState<ProjectDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "issues">("overview");

  // Overview inline edit states
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [addingResource, setAddingResource] = useState(false);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");

  // Project Update composer
  const [writingUpdate, setWritingUpdate] = useState(false);
  const [updateHealth, setUpdateHealth] = useState<"ON_TRACK" | "AT_RISK" | "OFF_TRACK">("ON_TRACK");
  const [updateBody, setUpdateBody] = useState("");

  // Milestone composer
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [msName, setMsName] = useState("");
  const [msDesc, setMsDesc] = useState("");

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/projects/${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setProject(json.project);
        setDescDraft(json.project.description || "");
        setSummaryDraft(json.project.summary || "");
      } else {
        setProject(null);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  async function patchProject(patch: Record<string, unknown>, msg?: string) {
    if (!project) return;
    const res = await fetch(`/api/internal/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      await Promise.all([loadProject(), refresh()]);
      if (msg) showToast(msg);
    } else {
      showToast("Gagal memperbarui project", { type: "error" });
    }
  }

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !resTitle.trim() || !resUrl.trim()) return;
    const next = [
      ...(Array.isArray(project.resources) ? project.resources : []),
      { id: String(Date.now()), title: resTitle.trim(), url: resUrl.trim() },
    ];
    await patchProject({ resources: next }, "Resource ditambahkan");
    setResTitle("");
    setResUrl("");
    setAddingResource(false);
  }

  async function handleRemoveResource(resId: string) {
    if (!project) return;
    const next = (Array.isArray(project.resources) ? project.resources : []).filter(
      (r) => r.id !== resId
    );
    await patchProject({ resources: next });
  }

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !updateBody.trim()) return;
    const res = await fetch(`/api/internal/projects/${project.id}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ health: updateHealth, body: updateBody.trim() }),
    });
    if (res.ok) {
      setUpdateBody("");
      setWritingUpdate(false);
      await loadProject();
      showToast("Project update dipublikasikan");
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !msName.trim()) return;
    const res = await fetch(`/api/internal/projects/${project.id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: msName.trim(), description: msDesc.trim() }),
    });
    if (res.ok) {
      setMsName("");
      setMsDesc("");
      setAddingMilestone(false);
      await Promise.all([loadProject(), refresh()]);
      showToast("Milestone ditambahkan");
    }
  }

  async function handleDeleteMilestone(milestoneId: string) {
    if (!project || !confirm("Hapus milestone ini?")) return;
    const res = await fetch(
      `/api/internal/projects/${project.id}/milestones?milestoneId=${milestoneId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await Promise.all([loadProject(), refresh()]);
    }
  }

  if (loading) {
    return <div className="p-8 text-xs text-zinc-500">Memuat detail project...</div>;
  }

  if (!project) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-sm text-zinc-300">Project tidak ditemukan.</p>
        <Link href="/projects" className="text-xs text-indigo-400 hover:underline">
          Kembali ke daftar Projects
        </Link>
      </div>
    );
  }

  const resources = Array.isArray(project.resources) ? project.resources : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0f0f12] overflow-hidden">
      {/* Row 1: Breadcrumb Header (Image 3 style) */}
      <header className="h-11 px-4 border-b border-[#1c1c24] flex items-center justify-between gap-3 shrink-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
          <Link
            href="/board"
            className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition truncate max-w-[170px]"
          >
            <Building2 aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{data?.workspace.name ?? "Workspace"}</span>
          </Link>
          <ChevronRight aria-hidden="true" className="hidden sm:block w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <Link href="/projects" className="text-zinc-400 hover:text-zinc-200 transition shrink-0">
            Projects
          </Link>
          <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-100 truncate">
            <span
              className="w-4 h-4 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${project.color}22`, color: project.color }}
            >
              <Box aria-hidden="true" className="w-3 h-3" />
            </span>
            <span className="truncate">{project.name}</span>
          </span>
        </nav>

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => openCreateModal({ projectId: project.id })}
          className="shrink-0"
        >
          <Plus aria-hidden="true" className="w-3.5 h-3.5" />
          New issue
        </Button>
      </header>

      {/* Row 2: Tabs (Overview | Activity | Issues) */}
      <div className="h-10 px-4 border-b border-border flex items-center gap-1.5 shrink-0">
        <TabsList>
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "activity", label: "Activity" },
              { key: "issues", label: `Issues (${project.stats.totalIssues})` },
            ] as const
          ).map((t) => (
            <TabsTrigger
              key={t.key}
              active={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* TAB 1: OVERVIEW (Images 1 & 2) */}
      {activeTab === "overview" && (
        <div className="flex-1 overflow-y-auto px-6 py-7">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Project Icon + Title + Summary */}
            <div className="space-y-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center border"
                style={{
                  backgroundColor: `${project.color}18`,
                  borderColor: `${project.color}40`,
                  color: project.color,
                }}
              >
                <Box aria-hidden="true" className="w-5 h-5" />
              </div>

              <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
                {project.name}
              </h1>

              <input
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                onBlur={() => {
                  if (summaryDraft !== project.summary) {
                    void patchProject({ summary: summaryDraft });
                  }
                }}
                placeholder="Tambahkan ringkasan singkat project..."
                className="w-full bg-transparent hover:bg-[#15151b] focus:bg-[#15151b] rounded px-1 -mx-1 py-1 text-sm text-zinc-400 placeholder-zinc-600"
              />
            </div>

            {/* Properties Inline Row */}
            <div className="space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-zinc-500 w-20 shrink-0">Properties</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Status project"
                    value={project.status}
                    onChange={(e) => patchProject({ status: e.target.value }, "Status diperbarui")}
                    className="px-2 py-1 rounded-md bg-[#14141a] border border-[#242430] text-zinc-200"
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#14141a] border border-[#242430]">
                    <PriorityIcon priority={project.priority} className="w-3.5 h-3.5" />
                    <select
                      aria-label="Priority project"
                      value={project.priority}
                      onChange={(e) =>
                        patchProject({ priority: e.target.value }, "Prioritas diperbarui")
                      }
                      className="bg-transparent text-zinc-200 focus:outline-none"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value} className="bg-[#15151a]">
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    aria-label="Lead project"
                    value={project.leadId ?? ""}
                    onChange={(e) =>
                      patchProject({ leadId: e.target.value || null }, "Lead diperbarui")
                    }
                    className="px-2 py-1 rounded-md bg-[#14141a] border border-[#242430] text-zinc-200"
                  >
                    <option value="">Lead</option>
                    {data?.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#14141a] border border-[#242430] text-zinc-300">
                    <Calendar aria-hidden="true" className="w-3 h-3 text-zinc-500" />
                    <input
                      type="date"
                      aria-label="Start date"
                      value={project.startDate ? project.startDate.slice(0, 10) : ""}
                      onChange={(e) =>
                        patchProject({ startDate: e.target.value || null })
                      }
                      className="bg-transparent text-[11px] text-zinc-300"
                    />
                    <span className="text-zinc-600">→</span>
                    <input
                      type="date"
                      aria-label="Target date"
                      value={project.targetDate ? project.targetDate.slice(0, 10) : ""}
                      onChange={(e) =>
                        patchProject({ targetDate: e.target.value || null })
                      }
                      className="bg-transparent text-[11px] text-zinc-300"
                    />
                  </div>
                </div>
              </div>

              {/* Resources Row */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-zinc-500 w-20 shrink-0">Resources</span>
                <div className="flex flex-wrap items-center gap-2">
                  {resources.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#14141a] border border-[#242430] text-zinc-200"
                    >
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-indigo-300"
                      >
                        <ExternalLink aria-hidden="true" className="w-3 h-3 text-zinc-500" />
                        {r.title}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveResource(r.id)}
                        aria-label={`Hapus ${r.title}`}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {addingResource ? (
                    <form onSubmit={handleAddResource} className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        required
                        value={resTitle}
                        onChange={(e) => setResTitle(e.target.value)}
                        placeholder="Judul dokumen"
                        className="px-2 py-1 text-xs bg-[#16161d] border border-[#2a2a36] rounded text-zinc-100 w-32"
                      />
                      <input
                        required
                        type="url"
                        value={resUrl}
                        onChange={(e) => setResUrl(e.target.value)}
                        placeholder="https://..."
                        className="px-2 py-1 text-xs bg-[#16161d] border border-[#2a2a36] rounded text-zinc-100 w-44"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded bg-[#5e6ad2] text-white text-[11px]"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingResource(false)}
                        className="text-zinc-500 hover:text-zinc-200 px-1"
                      >
                        Batal
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingResource(true)}
                      className="text-zinc-500 hover:text-zinc-200 transition"
                    >
                      + Add document or link...
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Write Project Update Box (Image 1) */}
            {writingUpdate ? (
              <form
                onSubmit={handlePostUpdate}
                className="rounded-xl border border-[#262632] bg-[#131318] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">Tulis Project Update</span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {(
                      [
                        { v: "ON_TRACK", label: "On track", cls: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
                        { v: "AT_RISK", label: "At risk", cls: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
                        { v: "OFF_TRACK", label: "Off track", cls: "text-red-400 border-red-500/40 bg-red-500/10" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setUpdateHealth(opt.v)}
                        className={`px-2 py-0.5 rounded border transition ${
                          updateHealth === opt.v
                            ? opt.cls
                            : "border-[#262632] text-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  required
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  placeholder="Tulis ringkasan progres, blocker, atau milestone terbaru..."
                  className="w-full rounded-lg bg-[#0f0f12] border border-[#242430] p-2.5 text-xs text-zinc-200"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWritingUpdate(false)}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-[#5e6ad2] hover:bg-[#6c77e0] text-xs font-medium text-white"
                  >
                    <Send aria-hidden="true" className="w-3 h-3" /> Post Update
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setWritingUpdate(true)}
                className="w-full py-3 px-4 rounded-xl border border-[#22222c] bg-[#121216] hover:bg-[#16161d] text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-2 transition"
              >
                <Edit3 aria-hidden="true" className="w-3.5 h-3.5" />
                {project.updates.length > 0 ? "Write project update" : "Write first project update"}
              </button>
            )}

            {/* Description Section */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-zinc-400">Description</h2>
                {!editingDesc && (
                  <button
                    type="button"
                    onClick={() => setEditingDesc(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#16161d] hover:bg-[#1f1f2a] border border-[#262632] text-[11px] text-zinc-300"
                  >
                    <Edit3 aria-hidden="true" className="w-3 h-3" /> Edit Description
                  </button>
                )}
              </div>

              {editingDesc ? (
                <div className="space-y-2.5">
                  <RichMarkdownEditor
                    value={descDraft}
                    onChange={setDescDraft}
                    showTemplates={false}
                    minHeightClass="min-h-[260px]"
                    placeholder="Tulis Overview, Scope, Label Wajib, Metrik, dan Catatan Risiko project ini..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await patchProject({ description: descDraft }, "Deskripsi project disimpan");
                        setEditingDesc(false);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#5e6ad2] hover:bg-[#6c77e0] text-xs font-medium text-white"
                    >
                      <Check aria-hidden="true" className="w-3.5 h-3.5" /> Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescDraft(project.description || "");
                        setEditingDesc(false);
                      }}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : project.description ? (
                <div className="text-sm">
                  <MarkdownRenderer content={project.description} />
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">
                  Belum ada deskripsi overview. Klik Edit Description untuk menambahkan ruang lingkup, metrik, dan dokumentasi project.
                </p>
              )}
            </section>

            {/* Milestones Section (Image 2!) */}
            <section className="space-y-3 pt-4 border-t border-[#1e1e26]">
              <h2 className="text-xs font-medium text-zinc-400">Milestones</h2>

              <div className="space-y-3">
                {project.milestones.map((ms) => (
                  <div
                    key={ms.id}
                    className="group rounded-lg p-3 hover:bg-[#14141a] border border-transparent hover:border-[#22222c] transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Diamond
                          aria-hidden="true"
                          className={`w-3.5 h-3.5 shrink-0 ${
                            ms.progressPercent === 100 && ms.totalIssues > 0
                              ? "text-indigo-400 fill-indigo-400/30"
                              : "text-amber-400"
                          }`}
                        />
                        <span className="text-sm font-medium text-zinc-100 truncate">{ms.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono tabular-nums text-zinc-400">
                          {ms.totalIssues} issues · {ms.progressPercent}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(ms.id)}
                          aria-label={`Hapus milestone ${ms.name}`}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 transition"
                        >
                          <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {ms.description && (
                      <p className="text-xs text-zinc-400 mt-1 ml-5.5 pl-5">{ms.description}</p>
                    )}
                  </div>
                ))}
              </div>

              {addingMilestone ? (
                <form
                  onSubmit={handleAddMilestone}
                  className="rounded-lg bg-[#14141a] border border-[#262632] p-3 space-y-2"
                >
                  <input
                    autoFocus
                    required
                    value={msName}
                    onChange={(e) => setMsName(e.target.value)}
                    placeholder="Nama milestone (misal: Stabilization, Feature Request, Maintenance)"
                    className="w-full px-2.5 py-1.5 text-xs bg-[#101014] border border-[#262632] rounded text-zinc-100"
                  />
                  <input
                    value={msDesc}
                    onChange={(e) => setMsDesc(e.target.value)}
                    placeholder="Deskripsi singkat milestone..."
                    className="w-full px-2.5 py-1.5 text-xs bg-[#101014] border border-[#262632] rounded text-zinc-100"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingMilestone(false)}
                      className="px-2.5 py-1 text-xs text-zinc-400"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-[#5e6ad2] text-xs font-medium text-white"
                    >
                      Tambah Milestone
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingMilestone(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition pt-1"
                >
                  <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                  Milestone
                </button>
              )}
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Project Updates */}
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Project Updates ({project.updates.length})
              </h2>
              {project.updates.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada project update.</p>
              ) : (
                <div className="space-y-2.5">
                  {project.updates.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl bg-[#131318] border border-[#22222c] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white"
                            style={{ backgroundColor: u.author.avatarColor }}
                          >
                            {getInitials(u.author.name)}
                          </span>
                          <span className="font-medium text-zinc-200">{u.author.name}</span>
                          {u.health === "ON_TRACK" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> On track
                            </span>
                          )}
                          {u.health === "AT_RISK" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> At risk
                            </span>
                          )}
                          {u.health === "OFF_TRACK" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
                              <XCircle className="w-3 h-3" /> Off track
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {new Date(u.createdAt).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <MarkdownRenderer content={u.body} className="text-xs" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Issue Activity Feed */}
            <section className="space-y-3 pt-4 border-t border-[#1e1e26]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <History aria-hidden="true" className="w-3.5 h-3.5" />
                Issue Activity ({project.activities.length})
              </h2>
              {project.activities.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada aktivitas tiket pada project ini.</p>
              ) : (
                <div className="divide-y divide-[#1a1a22] rounded-xl border border-[#1f1f28] bg-[#121216]">
                  {project.activities.map((act) => (
                    <Link
                      key={act.id}
                      href={`/issues/${encodeURIComponent(act.issue.identifier)}?fromPath=${encodeURIComponent(`/projects/${project.id}`)}&fromLabel=${encodeURIComponent(project.name)}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#17171f] text-xs transition"
                    >
                      <div className="min-w-0 text-zinc-400 truncate">
                        <span className="font-mono text-zinc-500 mr-2">{act.issue.identifier}</span>
                        <span className="font-medium text-zinc-200">{act.actorName}</span>{" "}
                        {act.action === "CREATED" && "membuat tiket"}
                        {act.action === "COMMENTED" && "berkomentar"}
                        {act.action !== "CREATED" && act.action !== "COMMENTED" && (
                          <>
                            mengubah {act.field} ke{" "}
                            <span className="text-indigo-300">{act.newValue}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                        {new Date(act.createdAt).toLocaleString("id-ID")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* TAB 3: ISSUES */}
      {activeTab === "issues" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <IssuesWorkspace
            key={`project-${project.id}`}
            title={project.name}
            description={project.summary}
            defaultViewMode="list"
            initialFilters={{ projectIds: [project.id] }}
          />
        </div>
      )}
    </div>
  );
}
