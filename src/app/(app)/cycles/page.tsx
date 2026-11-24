"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  Plus,
  Triangle,
  PlayCircle,
  CheckCircle2,
  Clock,
  X,
  ArrowUpRight,
  Layers,
  Target,
  Activity,
} from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { CycleBurnupChart, RingProgress } from "@/components/CycleBurnupChart";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { CountUp } from "@/components/reactbits/CountUp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BurnupPoint } from "@/lib/cycle-metrics";
import type { CycleDTO, CycleStatusValue } from "@/lib/types";

interface CycleListItem extends CycleDTO {
  metrics?: {
    scopePoints: number;
    startedPoints: number;
    completedPoints: number;
    startedPercent: number;
    completedPercent: number;
    capacityPercent: number;
    daysToStart: number;
    series: BurnupPoint[];
  };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtAxisDate(dateStr: string): { month: string; day: string } {
  const d = new Date(dateStr);
  return { month: MONTHS_SHORT[d.getMonth()], day: String(d.getDate()) };
}

function fmtDateRange(startStr: string, endStr: string): string {
  const s = new Date(startStr);
  const e = new Date(endStr);
  return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} - ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}`;
}

export default function CyclesPage() {
  const router = useRouter();
  const { data, refresh, showToast } = useWorkspace();
  const [cycles, setCycles] = useState<CycleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<CycleStatusValue>("UPCOMING");
  const [saving, setSaving] = useState(false);

  const canManage = data?.role === "OWNER" || data?.role === "ADMIN";

  const loadCycles = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/cycles", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setCycles(json.cycles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/internal/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, startDate, endDate, status }),
      });
      if (res.ok) {
        setModalOpen(false);
        setName("");
        setDescription("");
        await Promise.all([loadCycles(), refresh()]);
        showToast("Cycle baru berhasil dibuat");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateCycle(e: React.MouseEvent, id: string, cycleName: string) {
    e.stopPropagation();
    const res = await fetch("/api/internal/cycles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "ACTIVE" }),
    });
    if (res.ok) {
      await Promise.all([loadCycles(), refresh()]);
      showToast(`${cycleName} diaktifkan sebagai Current Cycle`);
    }
  }

  const activeCycle = cycles.find((c) => c.status === "ACTIVE");
  const featuredCycleId =
    activeCycle?.id ??
    cycles.find((c) => (c.metrics?.scopePoints ?? c.stats?.totalIssues ?? 0) > 0)?.id ??
    null;

  const totalScopeAll = cycles.reduce(
    (sum, c) => sum + (c.metrics?.scopePoints ?? c.stats?.totalPoints ?? 0),
    0
  );
  const totalIssuesAll = cycles.reduce((sum, c) => sum + (c.stats?.totalIssues ?? 0), 0);
  const avgCompletion =
    cycles.length > 0
      ? Math.round(
          cycles.reduce((sum, c) => sum + (c.metrics?.completedPercent ?? c.stats?.issueProgress ?? 0), 0) /
            cycles.length
        )
      : 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Top Breadcrumb Header */}
      <header className="h-11 px-4 sm:px-6 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
          <Link
            href="/board"
            className="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition truncate max-w-[180px]"
          >
            <Building2 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{data?.workspace.name ?? "Workspace"}</span>
          </Link>
          <ChevronRight aria-hidden="true" className="hidden sm:block w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <h1 className="font-semibold tracking-tight text-foreground">Cycles</h1>
          <Badge variant="secondary" className="font-mono tabular-nums text-[10px] ml-1">
            {cycles.length}
          </Badge>
        </nav>

        {canManage && (
          <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
            New cycle
          </Button>
        )}
      </header>

      {/* Full-Width Balanced Body (Equal Left & Right Edges) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : cycles.length === 0 ? (
          <SpotlightCard className="p-10 text-center max-w-lg mx-auto mt-10 shadow-sm">
            <PlayCircle aria-hidden="true" className="w-9 h-9 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-sm font-semibold text-foreground">Belum ada Cycle</h2>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Buat cycle/sprint pertama untuk melacak progres scope, kapasitas tim, dan grafik burn-up secara berkala.
            </p>
            {canManage && (
              <Button type="button" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
                <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                Buat Cycle Pertama
              </Button>
            )}
          </SpotlightCard>
        ) : (
          <>
            {/* Summary Metrics Strip (Full Width, 4 Equal Columns) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SpotlightCard className="p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Current Cycle</span>
                  <Activity aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-foreground truncate mt-1.5">
                  {activeCycle ? activeCycle.name.replace(/—/g, "-") : "Belum ada aktif"}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-muted-foreground mt-0.5">
                  {activeCycle
                    ? fmtDateRange(activeCycle.startDate, activeCycle.endDate)
                    : "Aktifkan salah satu sprint"}
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Total Scope</span>
                  <Triangle aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-1">
                  <CountUp to={totalScopeAll} />
                </p>
                <p className="text-[11px] font-mono tabular-nums text-muted-foreground">
                  {totalIssuesAll} tiket terdaftar
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Rata-rata Selesai</span>
                  <Target aria-hidden="true" className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-1">
                  <CountUp to={avgCompletion} suffix="%" />
                </p>
                <p className="text-[11px] text-muted-foreground">Akumulasi seluruh cycle</p>
              </SpotlightCard>

              <SpotlightCard className="p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Total Sprint</span>
                  <Layers aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-1">
                  <CountUp to={cycles.length} />
                </p>
                <p className="text-[11px] font-mono tabular-nums text-muted-foreground">
                  {cycles.filter((c) => c.status === "COMPLETED").length} selesai ·{" "}
                  {cycles.filter((c) => c.status === "UPCOMING").length} upcoming
                </p>
              </SpotlightCard>
            </div>

            {/* Full-Width Vertical Timeline */}
            <div className="w-full rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Timeline Cycles</span>
                <span>Klik baris untuk membuka detail &amp; breakdown sprint</span>
              </div>

              <div className="divide-y divide-border/70">
                {cycles.map((cycle, idx) => {
                  const isCurrent = cycle.status === "ACTIVE";
                  const isCompleted = cycle.status === "COMPLETED";
                  const showExpandedChart = cycle.id === featuredCycleId;
                  const axis = fmtAxisDate(cycle.startDate);
                  const m = cycle.metrics;
                  const scope = m?.scopePoints ?? cycle.stats?.totalPoints ?? 0;
                  const started = m?.startedPoints ?? 0;
                  const completed = m?.completedPoints ?? cycle.stats?.completedPoints ?? 0;
                  const startedPct = m?.startedPercent ?? 0;
                  const completedPct = m?.completedPercent ?? cycle.stats?.pointProgress ?? 0;
                  const capacityPct = m?.capacityPercent ?? 0;
                  const cleanName = cycle.name.replace(/—/g, "-");

                  return (
                    <div key={cycle.id} className="relative flex">
                      {/* Left Date Axis + Continuous Timeline Rail */}
                      <div className="hidden sm:flex flex-col items-end justify-start w-20 shrink-0 py-4 pr-5 pl-3 relative bg-card/30 border-r border-border/50">
                        <span className="text-[11px] font-mono uppercase text-muted-foreground leading-none">
                          {axis.month}
                        </span>
                        <span className="text-xs font-mono font-medium text-foreground/90 tabular-nums mt-0.5">
                          {axis.day}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`absolute right-[-1px] w-px ${
                            idx === 0 ? "top-5" : "top-0"
                          } ${idx === cycles.length - 1 ? "h-5" : "bottom-0"} ${
                            isCurrent ? "bg-indigo-500/80" : "bg-border"
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`absolute right-[-4.5px] top-[20px] w-2 h-2 rounded-full border ${
                            isCurrent
                              ? "bg-indigo-500 border-indigo-400"
                              : isCompleted
                                ? "bg-emerald-500/80 border-emerald-400"
                                : "bg-background border-muted-foreground/70"
                          }`}
                        />
                      </div>

                      {/* Right Main Row + Optional Expanded Burn-Up Chart */}
                      <div className="flex-1 min-w-0 px-4 sm:px-5 py-3.5">
                        <div
                          onClick={() => router.push(`/cycles/${cycle.id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(`/cycles/${cycle.id}`);
                            }
                          }}
                          className="group flex flex-wrap items-center justify-between gap-3 rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isCurrent ? (
                              <PlayCircle aria-hidden="true" className="w-4 h-4 text-indigo-400 shrink-0" />
                            ) : isCompleted ? (
                              <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Clock aria-hidden="true" className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-foreground truncate">
                                  {cleanName}
                                </span>
                                <ArrowUpRight
                                  aria-hidden="true"
                                  className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                />
                              </div>
                              <p className="text-[11px] font-mono tabular-nums text-muted-foreground">
                                {fmtDateRange(cycle.startDate, cycle.endDate)}
                                {cycle.description ? ` · ${cycle.description}` : ""}
                              </p>
                            </div>
                          </div>

                          {/* Right Metrics Strip */}
                          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-mono tabular-nums">
                            {canManage && !isCurrent && !isCompleted && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px] font-sans"
                                onClick={(e) => void handleActivateCycle(e, cycle.id, cleanName)}
                              >
                                Jadikan Current
                              </Button>
                            )}

                            <Badge
                              variant={isCurrent ? "default" : "outline"}
                              className={`text-[10px] font-sans ${
                                isCurrent ? "" : "text-muted-foreground"
                              }`}
                            >
                              {isCurrent ? "Current" : isCompleted ? "Completed" : "Upcoming"}
                            </Badge>

                            {isCompleted ? (
                              <>
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <RingProgress percent={completedPct} color="#6366f1" />
                                  <span className="text-foreground">{completedPct}%</span> success
                                </span>
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <Triangle aria-hidden="true" className="w-3 h-3" />
                                  <span className="text-foreground">{completed}</span> completed
                                </span>
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <Triangle aria-hidden="true" className="w-3 h-3" />
                                  <span className="text-foreground">{scope}</span> scope
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                  <RingProgress
                                    percent={capacityPct}
                                    color={isCurrent ? "#6366f1" : "#71717a"}
                                  />
                                  <span className="text-foreground">{capacityPct}%</span> of capacity
                                </span>
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <Triangle aria-hidden="true" className="w-3 h-3" />
                                  <span className="text-foreground">{scope}</span> scope
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expanded Full-Width Burn-Up Chart for Active / Featured Cycle */}
                        {showExpandedChart && (
                          <div
                            onClick={() => router.push(`/cycles/${cycle.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(`/cycles/${cycle.id}`);
                              }
                            }}
                            className="mt-3 rounded-lg border border-border bg-background/80 p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center hover:border-foreground/25 transition-colors cursor-pointer"
                          >
                            <div className="lg:col-span-9">
                              <CycleBurnupChart series={m?.series ?? []} height={175} />
                            </div>

                            <div className="lg:col-span-3 space-y-3 text-xs border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-5">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Ringkasan Progres
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-muted-foreground">
                                  <span className="w-2 h-2 rounded-[2px] bg-zinc-500" />
                                  Scope
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-foreground">
                                  <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-muted-foreground" />
                                  {scope}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-muted-foreground">
                                  <span className="w-2 h-2 rounded-[2px] bg-amber-400" />
                                  Started
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-foreground">
                                  <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-muted-foreground" />
                                  {started} · {startedPct}%
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-muted-foreground">
                                  <span className="w-2 h-2 rounded-[2px] bg-indigo-500" />
                                  Completed
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-foreground">
                                  <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-muted-foreground" />
                                  {completed} · {completedPct}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Cycle Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Buat Cycle / Sprint Baru
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup modal"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateCycle} className="space-y-3">
              <div>
                <label htmlFor="cyc-name" className="block text-xs text-muted-foreground mb-1">
                  Nama Cycle
                </label>
                <Input
                  id="cyc-name"
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sprint 2026 - 7"
                />
              </div>
              <div>
                <label htmlFor="cyc-desc" className="block text-xs text-muted-foreground mb-1">
                  Deskripsi
                </label>
                <Textarea
                  id="cyc-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Fokus target sprint ini..."
                  className="min-h-[60px] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cyc-start" className="block text-xs text-muted-foreground mb-1">
                    Tanggal Mulai
                  </label>
                  <Input
                    id="cyc-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="cyc-end" className="block text-xs text-muted-foreground mb-1">
                    Tanggal Selesai
                  </label>
                  <Input
                    id="cyc-end"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cyc-status" className="block text-xs text-muted-foreground mb-1">
                  Status Awal
                </label>
                <select
                  id="cyc-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CycleStatusValue)}
                  className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
                >
                  <option value="UPCOMING">Upcoming</option>
                  <option value="ACTIVE">Active (Current)</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Buat Cycle"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
