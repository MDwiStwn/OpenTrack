"use client";

import { useState, useEffect } from "react";
import { X, Loader2, FileText } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import { RichMarkdownEditor } from "./RichMarkdownEditor";
import { getIssueTemplates } from "@/lib/issue-templates";
import { ESTIMATE_OPTIONS, PRIORITIES, type IssueDTO, type PriorityValue } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface QuickCreateModalProps {
  defaults?: {
    statusId?: string;
    projectId?: string;
    cycleId?: string;
    parentId?: string;
  };
  onClose: () => void;
  onCreated: (issue: IssueDTO) => void;
}

export function QuickCreateModal({ defaults, onClose, onCreated }: QuickCreateModalProps) {
  const { data } = useWorkspace();
  const [projectId, setProjectId] = useState(defaults?.projectId || data?.projects[0]?.id || "");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState(defaults?.statusId || data?.statuses[0]?.id || "");
  const [priority, setPriority] = useState<PriorityValue>("MEDIUM");
  const [estimate, setEstimate] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [cycleId, setCycleId] = useState<string>(
    defaults?.cycleId ?? data?.cycles.find((c) => c.status === "ACTIVE")?.id ?? ""
  );
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [cfRequester, setCfRequester] = useState("");
  const [cfInstitution, setCfInstitution] = useState("");
  const [cfFoundDate, setCfFoundDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cfApp, setCfApp] = useState("");
  const [cfEnvironment, setCfEnvironment] = useState<"" | "Dev" | "Stg" | "Demo" | "Prod">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId && data?.projects[0]?.id) {
      setProjectId(data.projects[0].id);
    }
    if (!statusId && data?.statuses[0]?.id) {
      setStatusId(data.statuses[0].id);
    }
  }, [data, projectId, statusId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleLabel(id: string) {
    setSelectedLabels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyStandardTemplate() {
    const customDefault = data?.templates?.find((t) => t.isDefault) ?? data?.templates?.[0];
    if (customDefault) {
      setDescription(customDefault.content);
      return;
    }
    const tpl = getIssueTemplates()[0];
    if (tpl) setDescription(tpl.content);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Judul tiket wajib diisi.");
      return;
    }
    if (!projectId) {
      setError("Pilih Project terlebih dahulu (buat Project di Settings jika belum ada).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/internal/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          milestoneId: milestoneId || null,
          title: title.trim(),
          description,
          statusId: statusId || undefined,
          priority,
          estimate: estimate ? parseInt(estimate, 10) : null,
          assigneeId: assigneeId || null,
          cycleId: cycleId || null,
          parentId: defaults?.parentId || null,
          labelIds: selectedLabels,
          customFields: {
            requester: cfRequester.trim() || undefined,
            institution: cfInstitution.trim() || undefined,
            foundDate: cfFoundDate || undefined,
            applications: cfApp.trim() ? [cfApp.trim()] : undefined,
            environment: cfEnvironment || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Gagal membuat tiket (HTTP ${res.status})`);
        return;
      }
      onCreated(json.issue);
    } catch {
      setError("Terjadi kesalahan jaringan saat menyimpan tiket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-surface-1 border border-border-default rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between gap-2 shrink-0 bg-surface-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold text-zinc-200">
              {defaults?.parentId ? "Buat Sub-Issue Baru" : "New Issue"}
            </span>
            <select
              aria-label="Pilih Project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setMilestoneId("");
              }}
              className="text-xs bg-surface-2 border border-border-default rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              {data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} - {p.name}
                </option>
              ))}
            </select>
            {(() => {
              const selectedProj = data?.projects.find((p) => p.id === projectId);
              const projMilestones = selectedProj?.milestones ?? [];
              if (projMilestones.length === 0) return null;
              return (
                <select
                  aria-label="Pilih Milestone"
                  value={milestoneId}
                  onChange={(e) => setMilestoneId(e.target.value)}
                  className="text-xs bg-surface-2 border border-border-default rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">No milestone</option>
                  {projMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              );
            })()}
            {!description.trim() && (
              <button
                type="button"
                onClick={applyStandardTemplate}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181822] hover:bg-[#222230] border border-[#2c2c3c] text-[11px] font-medium text-zinc-200 transition"
              >
                <FileText aria-hidden="true" className="w-3 h-3 text-zinc-400" />
                Isi Template Standar
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-surface-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form wraps scrollable body + sticky footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-xs text-red-300">
                {error}
              </div>
            )}

            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul tiket"
              className="w-full bg-transparent text-base font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none border-b border-border-subtle pb-2"
            />

            {/* Rich Markdown Editor with Templates, Tables, Checklists, Split/Preview */}
            <RichMarkdownEditor
              value={description}
              onChange={setDescription}
              minHeightClass="min-h-[240px]"
            />

            {/* Metadata Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Status</label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="w-full text-xs bg-surface-2 border border-border-default rounded-md px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {data?.statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityValue)}
                  className="w-full text-xs bg-surface-2 border border-border-default rounded-md px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Estimate</label>
                <select
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  className="w-full text-xs bg-surface-2 border border-border-default rounded-md px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">No Estimate</option>
                  {ESTIMATE_OPTIONS.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt} pts
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Assignee (PIC)</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full text-xs bg-surface-2 border border-border-default rounded-md px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {data?.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Cycle</label>
                <select
                  value={cycleId}
                  onChange={(e) => setCycleId(e.target.value)}
                  className="w-full text-xs bg-surface-2 border border-border-default rounded-md px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">No Cycle</option>
                  {data?.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Collapsible Custom Fields */}
            <details className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2">
              <summary className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 select-none">
                + Custom Fields (Requester, Sekolah/Institusi, Application, Environment)
              </summary>
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Requester</label>
                  <input
                    value={cfRequester}
                    onChange={(e) => setCfRequester(e.target.value)}
                    placeholder="Nama requester"
                    className="w-full px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-md text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Sekolah / Institusi</label>
                  <input
                    value={cfInstitution}
                    onChange={(e) => setCfInstitution(e.target.value)}
                    placeholder="Nama sekolah / institusi"
                    className="w-full px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-md text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1">Application</label>
                  <input
                    value={cfApp}
                    onChange={(e) => setCfApp(e.target.value)}
                    placeholder="Nama aplikasi / layanan"
                    className="w-full px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-md text-zinc-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Tanggal Ditemukan</label>
                    <input
                      type="date"
                      value={cfFoundDate}
                      onChange={(e) => setCfFoundDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-[11px] bg-surface-2 border border-border-default rounded-md text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1">Environment</label>
                    <select
                      value={cfEnvironment}
                      onChange={(e) =>
                        setCfEnvironment(e.target.value as "" | "Dev" | "Stg" | "Demo" | "Prod")
                      }
                      className="w-full px-2 py-1.5 text-xs bg-surface-2 border border-border-default rounded-md text-zinc-200"
                    >
                      <option value="">Pilih</option>
                      <option value="Dev">Dev</option>
                      <option value="Stg">Stg</option>
                      <option value="Demo">Demo</option>
                      <option value="Prod">Prod</option>
                    </select>
                  </div>
                </div>
              </div>
            </details>

            {/* Labels */}
            {data && data.labels.length > 0 && (
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Labels</label>
                <div className="flex flex-wrap gap-1.5">
                  {data.labels.map((lbl) => {
                    const active = selectedLabels.includes(lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => toggleLabel(lbl.id)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border transition ${
                          active
                            ? "bg-indigo-500/20 border-indigo-500 text-zinc-100"
                            : "bg-surface-2 border-border-default text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                        {lbl.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground">
              Mendukung Markdown, tabel, checklist interaktif, dan link antar-tiket.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
                Buat Tiket
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
