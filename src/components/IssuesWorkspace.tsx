"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Kanban,
  List,
  Search,
  BookmarkPlus,
  PanelRight,
  RotateCcw,
  Plus,
  SlidersHorizontal,
  Trash2,
  Pencil,
  ChevronRight,
  Building2,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import { KanbanBoard, type SwimlaneMode } from "./KanbanBoard";
import { ListView } from "./ListView";
import { InspectorSidebar } from "./InspectorSidebar";
import { ViewEditorModal } from "./ViewEditorModal";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  PRIORITIES,
  type FilterState,
  type IssueDTO,
  type PriorityValue,
  type SavedViewDTO,
} from "@/lib/types";

interface IssuesWorkspaceProps {
  title: string;
  description?: string;
  savedView?: SavedViewDTO | null;
  initialFilters?: FilterState;
  defaultViewMode?: "kanban" | "list";
  defaultInspectorOpen?: boolean;
}

export function IssuesWorkspace({
  title,
  description,
  savedView,
  initialFilters,
  defaultViewMode = "list",
  defaultInspectorOpen = false,
}: IssuesWorkspaceProps) {
  const router = useRouter();
  const { data, issueVersion, openCreateModal, refresh, showToast } = useWorkspace();

  const [issues, setIssues] = useState<IssueDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [scopeTab, setScopeTab] = useState<"all" | "active" | "backlog">("all");

  const [viewMode, setViewMode] = useState<"kanban" | "list">(
    savedView?.displayConfig?.viewMode ?? defaultViewMode
  );
  const [swimlane, setSwimlane] = useState<SwimlaneMode>(
    savedView?.displayConfig?.swimlane ?? "priority"
  );
  const [listGroupBy, setListGroupBy] = useState<"status" | "priority">("status");
  const [inspectorOpen, setInspectorOpen] = useState(defaultInspectorOpen);
  const [filterBarOpen, setFilterBarOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState(initialFilters?.search ?? savedView?.filters?.search ?? "");
  const [projectIdsFilter, setProjectIdsFilter] = useState<string[]>(
    initialFilters?.projectIds ?? savedView?.filters?.projectIds ?? []
  );
  const [cycleId, setCycleId] = useState(
    initialFilters?.cycleId ?? savedView?.filters?.cycleId ?? ""
  );
  const [prioritiesFilter, setPrioritiesFilter] = useState<PriorityValue[]>(
    initialFilters?.priorities ?? savedView?.filters?.priorities ?? []
  );
  const [assigneeIdsFilter, setAssigneeIdsFilter] = useState<string[]>(
    initialFilters?.assigneeIds ?? savedView?.filters?.assigneeIds ?? []
  );
  const [labelIdsFilter, setLabelIdsFilter] = useState<string[]>(
    initialFilters?.labelIds ?? savedView?.filters?.labelIds ?? []
  );
  const [statusIdsFilter, setStatusIdsFilter] = useState<string[]>(
    initialFilters?.statusIds ?? savedView?.filters?.statusIds ?? []
  );

  const [viewModalOpen, setViewModalOpen] = useState(false);

  const projectId = projectIdsFilter.length === 1 ? projectIdsFilter[0] : "";
  const priority = prioritiesFilter.length === 1 ? prioritiesFilter[0] : "";
  const assigneeId = assigneeIdsFilter.length === 1 ? assigneeIdsFilter[0] : "";
  const labelId = labelIdsFilter.length === 1 ? labelIdsFilter[0] : "";

  const fetchIssues = useCallback(async () => {
    setFetchError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (projectIdsFilter.length > 0) params.set("projectIds", projectIdsFilter.join(","));
    if (cycleId) params.set("cycleId", cycleId);
    if (prioritiesFilter.length > 0) params.set("priorities", prioritiesFilter.join(","));
    if (assigneeIdsFilter.length > 0) params.set("assigneeIds", assigneeIdsFilter.join(","));
    if (labelIdsFilter.length > 0) params.set("labelIds", labelIdsFilter.join(","));
    if (statusIdsFilter.length > 0) params.set("statusIds", statusIdsFilter.join(","));

    try {
      const res = await fetch(`/api/internal/issues?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setFetchError("Gagal memuat daftar tiket dari server.");
        return;
      }
      const json = await res.json();
      setIssues(json.issues ?? []);
    } catch {
      setFetchError("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [search, projectIdsFilter, cycleId, prioritiesFilter, assigneeIdsFilter, labelIdsFilter, statusIdsFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchIssues();
    }, 80);
    return () => clearTimeout(timer);
  }, [fetchIssues, issueVersion]);

  async function handleOptimisticUpdate(
    issue: IssueDTO,
    patch: {
      statusId?: string;
      priority?: PriorityValue;
      assigneeId?: string | null;
      estimate?: number | null;
    }
  ) {
    if (!data) return;
    const snapshot = issues;

    setIssues((prev) =>
      prev.map((item) => {
        if (item.id !== issue.id) return item;
        const nextStatus = patch.statusId
          ? data.statuses.find((s) => s.id === patch.statusId) ?? item.status
          : item.status;
        const nextAssignee =
          patch.assigneeId !== undefined
            ? patch.assigneeId === null
              ? null
              : data.members.find((m) => m.id === patch.assigneeId) ?? item.assignee
            : item.assignee;

        return {
          ...item,
          statusId: patch.statusId ?? item.statusId,
          status: nextStatus,
          priority: patch.priority ?? item.priority,
          assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : item.assigneeId,
          assignee: nextAssignee,
          estimate: patch.estimate !== undefined ? patch.estimate : item.estimate,
        };
      })
    );

    try {
      const res = await fetch(`/api/internal/issues/${encodeURIComponent(issue.identifier)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setIssues(snapshot);
        showToast(`Gagal memperbarui ${issue.identifier}`, { type: "error" });
      } else {
        const json = await res.json();
        if (json.issue) {
          setIssues((prev) => prev.map((it) => (it.id === issue.id ? json.issue : it)));
        }
        showToast(`${issue.identifier} diperbarui`);
      }
    } catch {
      setIssues(snapshot);
      showToast(`Kesalahan jaringan saat memperbarui ${issue.identifier}`, { type: "error" });
    }
  }

  function resetFilters() {
    setSearch("");
    setProjectIdsFilter([]);
    setCycleId("");
    setPrioritiesFilter([]);
    setAssigneeIdsFilter([]);
    setLabelIdsFilter([]);
    setStatusIdsFilter([]);
  }

  async function handleDeleteSavedView() {
    if (!savedView) return;
    if (!confirm(`Hapus View "${savedView.name}"?`)) return;
    const res = await fetch(`/api/internal/views?id=${savedView.id}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
      router.push("/board");
    }
  }

  const visibleStatuses =
    data?.statuses.filter((s) => {
      if (statusIdsFilter.length > 0 && !statusIdsFilter.includes(s.id)) return false;
      if (!savedView) {
        if (scopeTab === "active") return s.category === "UNSTARTED" || s.category === "STARTED";
        if (scopeTab === "backlog") return s.category === "BACKLOG";
      }
      return true;
    }) ?? [];

  const displayedIssues = !savedView
    ? issues.filter((i) => {
        if (scopeTab === "active") {
          return i.status.category === "UNSTARTED" || i.status.category === "STARTED";
        }
        if (scopeTab === "backlog") return i.status.category === "BACKLOG";
        return true;
      })
    : issues;

  const issueLinkQuery = savedView
    ? `?fromView=${encodeURIComponent(savedView.id)}&fromLabel=${encodeURIComponent(savedView.name)}`
    : `?fromPath=${encodeURIComponent(
        projectId
          ? `/board?projectId=${projectId}`
          : cycleId
            ? `/board?cycleId=${cycleId}`
            : assigneeId
              ? `/board?assigneeId=${assigneeId}`
              : "/board"
      )}&fromLabel=${encodeURIComponent(title)}`;

  const hasActiveFilters = Boolean(
    search ||
      projectIdsFilter.length > 0 ||
      cycleId ||
      prioritiesFilter.length > 0 ||
      assigneeIdsFilter.length > 0 ||
      labelIdsFilter.length > 0 ||
      statusIdsFilter.length > 0
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Row 1: Breadcrumb Header */}
      <header className="h-11 px-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-[13px] min-w-0">
          <Link
            href="/board"
            className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition truncate max-w-[180px]"
          >
            <Building2 aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{data?.workspace.name ?? "Workspace"}</span>
          </Link>
          <ChevronRight aria-hidden="true" className="hidden sm:block w-3.5 h-3.5 text-zinc-600 shrink-0" />
          {savedView ? (
            <>
              <Link href="/views" className="text-zinc-400 hover:text-zinc-200 transition shrink-0">
                Views
              </Link>
              <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="inline-flex items-center gap-1.5 font-medium text-zinc-100 truncate">
                <LayoutGrid aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{title}</span>
              </span>
            </>
          ) : (
            <h1 className="font-medium text-zinc-100 truncate">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {savedView && (
            <>
              <button
                type="button"
                onClick={() => setViewModalOpen(true)}
                aria-label="Edit View"
                title="Edit View"
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a22] transition"
              >
                <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteSavedView}
                aria-label="Hapus View"
                title="Hapus View"
                className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-[#1a1a22] transition"
              >
                <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {!savedView && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewModalOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <BookmarkPlus aria-hidden="true" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save view</span>
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() =>
              openCreateModal({
                projectId: projectId || undefined,
                cycleId: cycleId || undefined,
              })
            }
          >
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
            New issue
          </Button>
        </div>
      </header>

      {/* Row 2: Scope Tabs (Active / Backlog / All issues) + Display & Inspector Controls */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        {!savedView ? (
          <div className="flex items-center gap-2 shrink-0">
            <TabsList>
              {(
                [
                  { key: "active", label: "Active" },
                  { key: "backlog", label: "Backlog" },
                  { key: "all", label: "All issues" },
                ] as const
              ).map((t) => (
                <TabsTrigger
                  key={t.key}
                  active={scopeTab === t.key}
                  onClick={() => setScopeTab(t.key)}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Badge variant="secondary" className="font-mono tabular-nums text-[10px]">
              {displayedIssues.length}
            </Badge>
          </div>
        ) : (
          <Badge variant="secondary" className="font-mono tabular-nums text-[10px]">
            {displayedIssues.length} {displayedIssues.length === 1 ? "issue" : "issues"}
          </Badge>
        )}

        <div className="flex items-center gap-1.5">
          {/* View Mode */}
          <div className="inline-flex rounded-md bg-[#141419] border border-[#22222b] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              aria-label="Tampilan Kanban"
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition ${
                viewMode === "kanban"
                  ? "bg-[#22222c] text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Kanban aria-hidden="true" className="w-3 h-3" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="Tampilan List"
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition ${
                viewMode === "list"
                  ? "bg-[#22222c] text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <List aria-hidden="true" className="w-3 h-3" />
              List
            </button>
          </div>

          {/* Swimlane / Group */}
          {viewMode === "kanban" ? (
            <select
              aria-label="Pengelompokan swimlane"
              value={swimlane}
              onChange={(e) => setSwimlane(e.target.value as SwimlaneMode)}
              className="text-[11px] bg-[#141419] border border-[#22222b] rounded-md px-2 py-1 text-zinc-300"
            >
              <option value="priority">Rows: Priority</option>
              <option value="assignee">Rows: Assignee</option>
              <option value="none">Rows: None</option>
            </select>
          ) : (
            <select
              aria-label="Pengelompokan list"
              value={listGroupBy}
              onChange={(e) => setListGroupBy(e.target.value as "status" | "priority")}
              className="text-[11px] bg-[#141419] border border-[#22222b] rounded-md px-2 py-1 text-zinc-300"
            >
              <option value="status">Group: Status</option>
              <option value="priority">Group: Priority</option>
            </select>
          )}

          {/* Filter Bar Toggle */}
          <button
            type="button"
            onClick={() => setFilterBarOpen((v) => !v)}
            aria-expanded={filterBarOpen}
            aria-label="Toggle filter tiket"
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition ${
              filterBarOpen || hasActiveFilters
                ? "bg-[#1e1e28] border-[#333344] text-zinc-100"
                : "bg-[#141419] border-[#22222b] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SlidersHorizontal aria-hidden="true" className="w-3 h-3" />
            Filter
          </button>

          {/* Inspector Toggle */}
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            aria-expanded={inspectorOpen}
            aria-label="Toggle panel Inspector"
            title="Toggle Inspector Sidebar"
            className={`p-1.5 rounded-md border transition ${
              inspectorOpen
                ? "bg-[#22222c] border-[#363646] text-zinc-100"
                : "bg-[#141419] border-[#22222b] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <PanelRight aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible Filter Toolbar */}
      {(filterBarOpen || search) && (
        <div className="px-4 py-2 border-b border-[#1c1c24] bg-[#111115] flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search
              aria-hidden="true"
              className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <input
              aria-label="Cari tiket"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau ID (SDG-1)..."
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-[#17171d] border border-[#262632] rounded-md text-zinc-200 placeholder-zinc-500"
            />
          </div>

          <select
            aria-label="Filter project"
            value={projectId}
            onChange={(e) => setProjectIdsFilter(e.target.value ? [e.target.value] : [])}
            className="text-xs bg-[#17171d] border border-[#262632] rounded-md px-2 py-1 text-zinc-300"
          >
            <option value="">
              {projectIdsFilter.length > 1
                ? `${projectIdsFilter.length} Projects Selected`
                : "All Projects"}
            </option>
            {data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key}: {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter cycle"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="text-xs bg-[#17171d] border border-[#262632] rounded-md px-2 py-1 text-zinc-300"
          >
            <option value="">All Cycles</option>
            {data?.cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter prioritas"
            value={priority}
            onChange={(e) =>
              setPrioritiesFilter(e.target.value ? [e.target.value as PriorityValue] : [])
            }
            className="text-xs bg-[#17171d] border border-[#262632] rounded-md px-2 py-1 text-zinc-300"
          >
            <option value="">
              {prioritiesFilter.length > 1
                ? `${prioritiesFilter.length} Priorities`
                : "All Priorities"}
            </option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeIdsFilter(e.target.value ? [e.target.value] : [])}
            className="text-xs bg-[#17171d] border border-[#262632] rounded-md px-2 py-1 text-zinc-300"
          >
            <option value="">
              {assigneeIdsFilter.length > 1
                ? `${assigneeIdsFilter.length} Assignees`
                : "All Assignees"}
            </option>
            <option value="unassigned">Unassigned</option>
            {data?.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter label"
            value={labelId}
            onChange={(e) => setLabelIdsFilter(e.target.value ? [e.target.value] : [])}
            className="text-xs bg-[#17171d] border border-[#262632] rounded-md px-2 py-1 text-zinc-300"
          >
            <option value="">
              {labelIdsFilter.length > 1 ? `${labelIdsFilter.length} Labels` : "All Labels"}
            </option>
            {data?.labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c24] transition"
            >
              <RotateCcw aria-hidden="true" className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      )}

      {/* Main Content + Inspector Sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {loading || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-zinc-500">
            <p>Memuat daftar tiket dan konfigurasi workflow...</p>
          </div>
        ) : fetchError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-xs text-red-400">{fetchError}</p>
            <button
              type="button"
              onClick={() => void fetchIssues()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1a1a22] hover:bg-[#23232e] border border-[#2d2d3a] text-xs text-zinc-200"
            >
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
              Coba Lagi
            </button>
          </div>
        ) : viewMode === "kanban" ? (
          <KanbanBoard
            issues={displayedIssues}
            statuses={visibleStatuses}
            members={data.members}
            swimlane={swimlane}
            issueLinkQuery={issueLinkQuery}
            onMoveIssue={handleOptimisticUpdate}
            onQuickCreateInStatus={(statusId) =>
              openCreateModal({
                statusId,
                projectId: projectId || undefined,
                cycleId: cycleId || undefined,
              })
            }
          />
        ) : (
          <ListView
            issues={displayedIssues}
            statuses={visibleStatuses}
            members={data.members}
            groupBy={listGroupBy}
            issueLinkQuery={issueLinkQuery}
            onUpdateIssue={handleOptimisticUpdate}
            onQuickCreateInStatus={(statusId) =>
              openCreateModal({
                statusId,
                projectId: projectId || undefined,
                cycleId: cycleId || undefined,
              })
            }
          />
        )}

        {inspectorOpen && (
          <InspectorSidebar
            title={savedView?.name ?? title}
            description={savedView?.description ?? description}
            owner={savedView?.owner ?? null}
            issues={displayedIssues}
            onEditView={savedView ? () => setViewModalOpen(true) : undefined}
            onClose={() => setInspectorOpen(false)}
          />
        )}
      </div>

      {/* Create / Edit View Modal */}
      {viewModalOpen && (
        <ViewEditorModal
          existingView={savedView ?? null}
          initialFilters={{
            projectIds: projectIdsFilter.length > 0 ? projectIdsFilter : undefined,
            statusIds: statusIdsFilter.length > 0 ? statusIdsFilter : undefined,
            priorities: prioritiesFilter.length > 0 ? prioritiesFilter : undefined,
            assigneeIds: assigneeIdsFilter.length > 0 ? assigneeIdsFilter : undefined,
            labelIds: labelIdsFilter.length > 0 ? labelIdsFilter : undefined,
            cycleId: cycleId || undefined,
          }}
          initialDisplayConfig={{ viewMode, swimlane }}
          onClose={() => setViewModalOpen(false)}
          onSaved={async (saved) => {
            setViewModalOpen(false);
            await refresh();
            showToast(`View "${saved.name}" berhasil disimpan`);
            if (!savedView) {
              router.push(`/views/${saved.id}`);
            } else {
              setProjectIdsFilter(saved.filters?.projectIds ?? []);
              setStatusIdsFilter(saved.filters?.statusIds ?? []);
              setPrioritiesFilter(saved.filters?.priorities ?? []);
              setAssigneeIdsFilter(saved.filters?.assigneeIds ?? []);
              setLabelIdsFilter(saved.filters?.labelIds ?? []);
              setCycleId(saved.filters?.cycleId ?? "");
              if (saved.displayConfig?.viewMode) setViewMode(saved.displayConfig.viewMode);
              if (saved.displayConfig?.swimlane) setSwimlane(saved.displayConfig.swimlane);
            }
          }}
        />
      )}
    </div>
  );
}
