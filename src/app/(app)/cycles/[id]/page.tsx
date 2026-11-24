"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Plus,
  PanelRight,
  List,
  Kanban,
  Triangle,
  PlayCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  User,
} from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ListView } from "@/components/ListView";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CycleBurnupChart, RingProgress } from "@/components/CycleBurnupChart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials, type CycleStatusValue, type IssueDTO, type PriorityValue } from "@/lib/types";
import type { CycleMetrics } from "@/lib/cycle-metrics";

interface CycleDetailInfo {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: CycleStatusValue;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtShortRange(startStr: string, endStr: string): string {
  const s = new Date(startStr);
  const e = new Date(endStr);
  return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} -> ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}`;
}

export default function CycleDetailPage() {
  const params = useParams<{ id: string }>();
  const cycleId = params.id;
  const { data, issueVersion, openCreateModal, refresh, showToast } = useWorkspace();

  const [cycle, setCycle] = useState<CycleDetailInfo | null>(null);
  const [metrics, setMetrics] = useState<CycleMetrics | null>(null);
  const [issues, setIssues] = useState<IssueDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [breakdownTab, setBreakdownTab] = useState<"assignees" | "labels" | "priorities" | "projects">("assignees");

  const canManage = data?.role === "OWNER" || data?.role === "ADMIN";

  const loadDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal/cycles/${encodeURIComponent(cycleId)}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setCycle(json.cycle);
        setMetrics(json.metrics);
        setIssues(json.issues ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, issueVersion]);

  async function handleStatusChange(nextStatus: CycleStatusValue) {
    if (!cycle) return;
    const res = await fetch("/api/internal/cycles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cycle.id, status: nextStatus }),
    });
    if (res.ok) {
      await Promise.all([loadDetail(), refresh()]);
      showToast("Status cycle diperbarui");
    }
  }

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
        await loadDetail();
      }
    } catch {
      setIssues(snapshot);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        Memuat detail cycle...
      </div>
    );
  }

  if (notFound || !cycle || !metrics) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-foreground">Cycle tidak ditemukan</p>
        <Link href="/cycles">
          <Button type="button" variant="outline" size="sm">
            Kembali ke Cycles
          </Button>
        </Link>
      </div>
    );
  }

  const isCurrent = cycle.status === "ACTIVE";
  const isUpcoming = cycle.status === "UPCOMING";
  const breakdownRows = metrics.breakdowns[breakdownTab] ?? [];
  const issueLinkQuery = `?fromPath=${encodeURIComponent(`/cycles/${cycle.id}`)}&fromLabel=${encodeURIComponent(cycle.name)}`;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Row 1: Breadcrumb Header */}
      <header className="h-11 px-4 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
          <Link
            href="/board"
            className="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition truncate max-w-[160px]"
          >
            <Building2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{data?.workspace.name ?? "Workspace"}</span>
          </Link>
          <ChevronRight aria-hidden="true" className="hidden sm:block w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <Link href="/cycles" className="text-muted-foreground hover:text-foreground transition shrink-0">
            Cycles
          </Link>
          <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground truncate">
            {isCurrent ? (
              <PlayCircle aria-hidden="true" className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            ) : isUpcoming ? (
              <Clock aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="truncate">{cycle.name}</span>
          </span>
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          {issues.length > 0 && (
            <TabsList className="h-7">
              <TabsTrigger active={viewMode === "list"} onClick={() => setViewMode("list")} className="px-2 py-0.5 text-[11px]">
                <List aria-hidden="true" className="w-3 h-3" />
                List
              </TabsTrigger>
              <TabsTrigger active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} className="px-2 py-0.5 text-[11px]">
                <Kanban aria-hidden="true" className="w-3 h-3" />
                Board
              </TabsTrigger>
            </TabsList>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setInspectorOpen((v) => !v)}
            aria-label="Toggle panel info cycle"
            className={inspectorOpen ? "text-foreground bg-secondary" : "text-muted-foreground"}
          >
            <PanelRight aria-hidden="true" className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => openCreateModal({ cycleId: cycle.id })}
          >
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New issue</span>
          </Button>
        </div>
      </header>

      {/* Main Split: Issues/Empty State (Left) + Cycle Progress/Planning Sidebar (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Main Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {issues.length === 0 ? (
            /* Screenshot 3: Clean Upcoming / Empty Cycle State */
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-sm text-left space-y-3">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center mb-4">
                  <PlayCircle aria-hidden="true" className="w-6 h-6 text-muted-foreground" />
                </div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {cycle.name}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cycles adalah interval berbasis waktu untuk membantu tim fokus pada sekumpulan target pekerjaan. Pantau kapasitas, scope, dan progres seiring tiket ditambahkan.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openCreateModal({ cycleId: cycle.id })}
                  >
                    Create new issue
                    <kbd className="ml-1 px-1 py-0.5 rounded bg-primary-foreground/15 text-[10px] font-mono">
                      C
                    </kbd>
                  </Button>
                  <Link href="/cycles">
                    <Button type="button" variant="outline" size="sm">
                      Semua Cycles
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Screenshot 1: Populated Cycle Issues (List or Board) */
            <>
              <div className="h-9 px-4 border-b border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
                <span className="font-mono tabular-nums">{issues.length} issues</span>
                <span className="text-[11px] font-mono tabular-nums">
                  {metrics.completedPercent}% selesai
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {viewMode === "list" ? (
                  <ListView
                    issues={issues}
                    statuses={data?.statuses ?? []}
                    members={data?.members ?? []}
                    groupBy="status"
                    issueLinkQuery={issueLinkQuery}
                    onQuickCreateInStatus={(statusId) => openCreateModal({ cycleId: cycle.id, statusId })}
                    onUpdateIssue={handleOptimisticUpdate}
                  />
                ) : (
                  <KanbanBoard
                    issues={issues}
                    statuses={data?.statuses ?? []}
                    members={data?.members ?? []}
                    swimlane="priority"
                    issueLinkQuery={issueLinkQuery}
                    onQuickCreateInStatus={(statusId) => openCreateModal({ cycleId: cycle.id, statusId })}
                    onMoveIssue={(iss, patch) => void handleOptimisticUpdate(iss, patch)}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Cycle Inspector Sidebar (Screenshots 1 & 3) */}
        {inspectorOpen && (
          <aside className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card/50 p-4 space-y-5 overflow-y-auto text-xs">
            {/* Status + Date Range Header */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant={isCurrent ? "secondary" : "outline"} className="text-[11px]">
                    {isCurrent ? "Current" : isUpcoming ? "Upcoming" : "Completed"}
                  </Badge>
                  <span className="px-2 py-0.5 rounded-md bg-secondary/60 border border-border text-[11px] font-mono tabular-nums text-muted-foreground">
                    {fmtShortRange(cycle.startDate, cycle.endDate)}
                  </span>
                </div>
                {canManage && (
                  <select
                    aria-label="Ubah status cycle"
                    value={cycle.status}
                    onChange={(e) => void handleStatusChange(e.target.value as CycleStatusValue)}
                    className="h-6 rounded bg-card border border-input px-1.5 text-[11px] text-muted-foreground"
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isCurrent ? (
                  <PlayCircle aria-hidden="true" className="w-4 h-4 text-indigo-400 shrink-0" />
                ) : isUpcoming ? (
                  <Clock aria-hidden="true" className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
                  {cycle.name}
                </h2>
              </div>

              {cycle.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{cycle.description}</p>
              )}
            </div>

            {/* Upcoming Planning Card (Screenshot 3) vs Active/Completed Progress & Burn-Up (Screenshot 1) */}
            {isUpcoming && issues.length === 0 ? (
              <section className="pt-4 border-t border-border space-y-3">
                <h3 className="text-[11px] font-medium text-muted-foreground">Planning</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-[2px] bg-indigo-500" />
                      Capacity
                    </p>
                    <p className="text-sm font-mono tabular-nums font-semibold text-foreground mt-1">
                      {metrics.capacityPercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock aria-hidden="true" className="w-3 h-3" />
                      Days to start
                    </p>
                    <p className="text-sm font-mono tabular-nums font-semibold text-foreground mt-1">
                      {metrics.daysToStart}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-[2px] bg-zinc-500" />
                      Scope
                    </p>
                    <p className="text-sm font-mono tabular-nums font-semibold text-foreground mt-1 inline-flex items-center gap-1">
                      <Triangle aria-hidden="true" className="w-3 h-3 text-muted-foreground" />
                      {metrics.scopePoints}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className="pt-4 border-t border-border space-y-3">
                  <h3 className="text-[11px] font-medium text-muted-foreground">Progress</h3>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-[2px] bg-zinc-500" />
                        Scope
                      </span>
                      <p className="font-mono tabular-nums text-foreground font-medium mt-1 inline-flex items-center gap-1">
                        <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-muted-foreground" />
                        {metrics.scopePoints}
                      </p>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-[2px] bg-amber-400" />
                        Started
                      </span>
                      <p className="font-mono tabular-nums text-foreground font-medium mt-1">
                        {metrics.startedPoints} · {metrics.startedPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-[2px] bg-indigo-500" />
                        Completed
                      </span>
                      <p className="font-mono tabular-nums text-foreground font-medium mt-1">
                        {metrics.completedPoints} · {metrics.completedPercent}%
                      </p>
                    </div>
                  </div>

                  <CycleBurnupChart series={metrics.series} height={140} />
                </section>

                {/* Breakdown Tabs: Assignees | Labels | Priority | Projects (Screenshot 1) */}
                <section className="pt-4 border-t border-border space-y-3">
                  <TabsList className="w-full grid grid-cols-4 h-7">
                    {(
                      [
                        { key: "assignees", label: "Assignees" },
                        { key: "labels", label: "Labels" },
                        { key: "priorities", label: "Priority" },
                        { key: "projects", label: "Projects" },
                      ] as const
                    ).map((t) => (
                      <TabsTrigger
                        key={t.key}
                        active={breakdownTab === t.key}
                        onClick={() => setBreakdownTab(t.key)}
                        className="px-1 py-0.5 text-[10px]"
                      >
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="space-y-2">
                    {breakdownRows.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground py-2">Belum ada data</p>
                    ) : (
                      breakdownRows.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-2 py-1 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {breakdownTab === "assignees" ? (
                              row.avatarColor ? (
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                                  style={{ backgroundColor: row.avatarColor }}
                                >
                                  {getInitials(row.name)}
                                </span>
                              ) : (
                                <User aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              )
                            ) : row.color ? (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: row.color }}
                              />
                            ) : null}
                            <span className="text-foreground/90 truncate">{row.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px] text-muted-foreground shrink-0">
                            <RingProgress percent={row.percent} size={13} color="#6366f1" />
                            <span>{row.percent}% of</span>
                            <Triangle aria-hidden="true" className="w-2.5 h-2.5" />
                            <span className="text-foreground">{row.totalScope}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}

            <div className="pt-3 border-t border-border">
              <Link
                href={`/board?cycleId=${cycle.id}`}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                Buka di All Issues Board <ArrowRight aria-hidden="true" className="w-3 h-3" />
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
