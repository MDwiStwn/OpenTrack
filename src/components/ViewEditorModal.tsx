"use client";

import { useState } from "react";
import { X, Loader2, Bookmark, Plus, Layers } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import {
  PRIORITIES,
  type FilterState,
  type PriorityValue,
  type SavedViewDTO,
  type StatusCategoryValue,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ViewEditorModalProps {
  existingView?: SavedViewDTO | null;
  initialFilters?: FilterState;
  initialDisplayConfig?: { viewMode?: "kanban" | "list"; swimlane?: "none" | "priority" | "assignee" };
  onClose: () => void;
  onSaved: (view: SavedViewDTO) => void;
}

export function ViewEditorModal({
  existingView,
  initialFilters,
  initialDisplayConfig,
  onClose,
  onSaved,
}: ViewEditorModalProps) {
  const { data, refresh, showToast } = useWorkspace();

  const startFilters = existingView?.filters ?? initialFilters ?? {};
  const startDisplay = existingView?.displayConfig ?? initialDisplayConfig ?? {};

  const [name, setName] = useState(existingView?.name ?? "");
  const [description, setDescription] = useState(existingView?.description ?? "");
  const [isShared, setIsShared] = useState(existingView?.isShared ?? true);
  const [projectIds, setProjectIds] = useState<string[]>(startFilters.projectIds ?? []);
  const [statusIds, setStatusIds] = useState<string[]>(startFilters.statusIds ?? []);
  const [priorities, setPriorities] = useState<PriorityValue[]>(startFilters.priorities ?? []);
  const [labelIds, setLabelIds] = useState<string[]>(startFilters.labelIds ?? []);
  const [assigneeIds] = useState<string[]>(startFilters.assigneeIds ?? []);
  const [cycleId, setCycleId] = useState<string>(startFilters.cycleId ?? "");
  const [viewMode, setViewMode] = useState<"kanban" | "list">(startDisplay.viewMode ?? "kanban");
  const [swimlane, setSwimlane] = useState<"none" | "priority" | "assignee">(
    startDisplay.swimlane ?? "priority"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Inline create workflow status state
  const [addingStatus, setAddingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusCategory, setNewStatusCategory] = useState<StatusCategoryValue>("STARTED");
  const [newStatusColor, setNewStatusColor] = useState("#06b6d4");
  const [creatingStatus, setCreatingStatus] = useState(false);

  const canManage = data?.role === "OWNER" || data?.role === "ADMIN";

  function toggleItem<T>(list: T[], item: T, setter: (next: T[]) => void) {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function applyPreset(presetKey: "mob-dev" | "mob-qc" | "web-dev" | "web-qc") {
    if (!data) return;
    const findProjectIds = (keys: string[]) =>
      data.projects
        .filter((p) => keys.includes(p.key.toUpperCase()))
        .map((p) => p.id);
    const findStatusIds = (slugs: string[]) =>
      data.statuses.filter((s) => slugs.includes(s.slug)).map((s) => s.id);

    const devSlugs = ["select-for-sprint", "in-development"];
    const qcSlugs = ["qc-demo-standby", "qc-demo", "request-deploy"];

    if (presetKey === "mob-dev") {
      setName("Mobile Development");
      setDescription("Papan kerja pengerjaan fitur dan perbaikan modul Mobile.");
      setProjectIds(findProjectIds(["MOB"]));
      setStatusIds(findStatusIds(devSlugs));
    } else if (presetKey === "mob-qc") {
      setName("QC Mobile");
      setDescription("Antrean pengujian Quality Control untuk tiket aplikasi Mobile.");
      setProjectIds(findProjectIds(["MOB"]));
      setStatusIds(findStatusIds(qcSlugs));
    } else if (presetKey === "web-dev") {
      setName("Web Development & API");
      setDescription("Papan kerja pengerjaan fitur dan perbaikan Web serta Backend API.");
      setProjectIds(findProjectIds(["SDG", "API"]));
      setStatusIds(findStatusIds(devSlugs));
    } else if (presetKey === "web-qc") {
      setName("QC Web & API");
      setDescription("Antrean pengujian Quality Control untuk modul Web dan Backend API.");
      setProjectIds(findProjectIds(["SDG", "API"]));
      setStatusIds(findStatusIds(qcSlugs));
    }
    setViewMode("kanban");
    setSwimlane("priority");
  }

  async function handleAddWorkflowStatus() {
    if (!newStatusName.trim()) return;
    setCreatingStatus(true);
    setError("");
    try {
      const res = await fetch("/api/internal/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStatusName.trim(),
          category: newStatusCategory,
          color: newStatusColor,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menambahkan workflow status");
        return;
      }
      await refresh();
      if (json.status?.id) {
        setStatusIds((prev) => (prev.includes(json.status.id) ? prev : [...prev, json.status.id]));
      }
      setNewStatusName("");
      setAddingStatus(false);
      showToast(`Status "${json.status?.name ?? newStatusName}" ditambahkan ke workspace`);
    } catch {
      setError("Terjadi kesalahan jaringan saat menambah workflow status");
    } finally {
      setCreatingStatus(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama View wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const filters: FilterState = {};
      if (projectIds.length > 0) filters.projectIds = projectIds;
      if (statusIds.length > 0) filters.statusIds = statusIds;
      if (priorities.length > 0) filters.priorities = priorities;
      if (labelIds.length > 0) filters.labelIds = labelIds;
      if (assigneeIds.length > 0) filters.assigneeIds = assigneeIds;
      if (cycleId) filters.cycleId = cycleId;

      const displayConfig = { viewMode, swimlane };

      if (existingView) {
        const res = await fetch("/api/internal/views", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existingView.id,
            name: name.trim(),
            description: description.trim(),
            isShared,
            filters,
            displayConfig,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error || "Gagal memperbarui view");
          return;
        }
        onSaved({
          ...existingView,
          name: name.trim(),
          description: description.trim(),
          isShared,
          filters,
          displayConfig,
        });
      } else {
        const res = await fetch("/api/internal/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            isShared,
            filters,
            displayConfig,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Gagal membuat view");
          return;
        }
        onSaved(json.view);
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-card text-card-foreground border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Bookmark aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {existingView ? `Edit View: ${existingView.name}` : "Buat Custom View Baru"}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup modal"
            className="text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-md bg-destructive/15 border border-destructive/40 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Quick Presets */}
            {!existingView && (
              <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Layers aria-hidden="true" className="w-3.5 h-3.5" />
                  Preset Cepat (klik untuk isi otomatis, atau atur manual di bawah):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("mob-dev")}>
                    Mobile Development
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("mob-qc")}>
                    QC Mobile
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("web-dev")}>
                    Web Development &amp; API
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("web-qc")}>
                    QC Web &amp; API
                  </Button>
                </div>
              </div>
            )}

            {/* Name & Description */}
            <div className="space-y-2.5">
              <div>
                <label htmlFor="view-name" className="block text-xs font-medium text-muted-foreground mb-1">
                  Nama View
                </label>
                <Input
                  id="view-name"
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Mobile Development, QC Production, Web & API"
                />
              </div>
              <div>
                <label htmlFor="view-desc" className="block text-xs font-medium text-muted-foreground mb-1">
                  Deskripsi
                </label>
                <Textarea
                  id="view-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan cakupan tiket yang ditampilkan di view ini..."
                  className="min-h-[60px] resize-none"
                />
              </div>
            </div>

            {/* Multi-select Projects */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                Filter Projects (pilih 1 atau lebih, kosongkan untuk semua)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {data?.projects.map((p) => {
                  const active = projectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleItem(projectIds, p.id, setProjectIds)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition",
                        active
                          ? "bg-primary/10 border-foreground/60 text-foreground font-medium"
                          : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-mono text-[10px]">{p.key}</span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multi-select Workflow Statuses + Inline Add New Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-[11px] font-medium text-muted-foreground">
                  Filter Workflow Statuses (kosongkan untuk tampilkan semua kolom)
                </label>
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingStatus((v) => !v)}
                    className="h-6 px-2 text-[11px]"
                  >
                    <Plus aria-hidden="true" className="w-3 h-3" />
                    Tambah Status
                  </Button>
                )}
              </div>

              {addingStatus && canManage && (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Status baru akan ditambahkan ke seluruh workspace dan langsung dipilih di filter ini.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <Input
                      value={newStatusName}
                      onChange={(e) => setNewStatusName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAddWorkflowStatus();
                        }
                      }}
                      placeholder="Nama status (misal: QC Production Standby)"
                      className="sm:col-span-6 h-7 text-xs"
                    />
                    <select
                      aria-label="Kategori status"
                      value={newStatusCategory}
                      onChange={(e) => setNewStatusCategory(e.target.value as StatusCategoryValue)}
                      className="sm:col-span-3 h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                    >
                      <option value="BACKLOG">Backlog</option>
                      <option value="UNSTARTED">Unstarted</option>
                      <option value="STARTED">Started</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                    <div className="sm:col-span-3 flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="Warna status"
                        value={newStatusColor}
                        onChange={(e) => setNewStatusColor(e.target.value)}
                        className="w-7 h-7 rounded bg-transparent border-0 shrink-0"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={creatingStatus || !newStatusName.trim()}
                        onClick={() => void handleAddWorkflowStatus()}
                        className="flex-1 h-7"
                      >
                        {creatingStatus ? (
                          <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin" />
                        ) : (
                          "Simpan"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {data?.statuses.map((s) => {
                  const active = statusIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleItem(statusIds, s.id, setStatusIds)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition",
                        active
                          ? "bg-primary/10 border-foreground/60 text-foreground font-medium"
                          : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multi-select Labels */}
            {data && data.labels.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                  Filter Labels (opsional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {data.labels.map((l) => {
                    const active = labelIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleItem(labelIds, l.id, setLabelIds)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition",
                          active
                            ? "bg-primary/10 border-foreground/60 text-foreground font-medium"
                            : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multi-select Priorities */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                Filter Priority (opsional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => {
                  const active = priorities.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => toggleItem(priorities, p.value, setPriorities)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs border transition",
                        active
                          ? "bg-primary/10 border-foreground/60 text-foreground font-medium"
                          : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cycle, Display Mode, Swimlane, Sharing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Cycle (Sprint)</label>
                <select
                  value={cycleId}
                  onChange={(e) => setCycleId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Semua Cycle</option>
                  {data?.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Default Tampilan</label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as "kanban" | "list")}
                  className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="kanban">Kanban Board</option>
                  <option value="list">List View</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Default Swimlane</label>
                <select
                  value={swimlane}
                  onChange={(e) => setSwimlane(e.target.value as "none" | "priority" | "assignee")}
                  className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="priority">Priority</option>
                  <option value="assignee">Assignee</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground/90 pt-1">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="accent-foreground"
              />
              Bagikan View ini ke seluruh anggota workspace
            </label>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
              {existingView ? "Simpan Perubahan" : "Buat View"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
