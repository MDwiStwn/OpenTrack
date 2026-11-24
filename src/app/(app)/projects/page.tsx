"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Box,
  Diamond,
  Search,
  X,
  Loader2,
  Circle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PriorityIcon } from "@/components/IssueCard";
import { PRIORITIES, getInitials, type PriorityValue, type UserRef } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { CountUp } from "@/components/reactbits/CountUp";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface ProjectListItem {
  id: string;
  name: string;
  key: string;
  summary: string;
  color: string;
  status: string;
  health: string;
  priority: PriorityValue;
  lead: UserRef | null;
  targetDate: string | null;
  milestones: Array<{
    id: string;
    name: string;
    totalIssues: number;
    completedIssues: number;
    progressPercent: number;
  }>;
  stats: {
    totalIssues: number;
    completedIssues: number;
    totalPoints: number;
    progressPercent: number;
  };
}

function HealthBadge({ health }: { health: string }) {
  if (health === "ON_TRACK") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" /> On track
      </span>
    );
  }
  if (health === "AT_RISK") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
        <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" /> At risk
      </span>
    );
  }
  if (health === "OFF_TRACK") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <XCircle aria-hidden="true" className="w-3.5 h-3.5" /> Off track
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <Circle aria-hidden="true" className="w-3.5 h-3.5" /> No updates
    </span>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { data, refresh, showToast } = useWorkspace();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<PriorityValue>("MEDIUM");
  const [leadId, setLeadId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const canManage = data?.role === "OWNER" || data?.role === "ADMIN";

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/projects", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setProjects(json.projects ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr("");
    try {
      const res = await fetch("/api/internal/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key: key.trim().toUpperCase(),
          summary: summary.trim(),
          priority,
          leadId: leadId || undefined,
          targetDate: targetDate || null,
          color,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormErr(json.error || "Gagal membuat project");
        return;
      }
      setCreateOpen(false);
      setName("");
      setKey("");
      setSummary("");
      setTargetDate("");
      await Promise.all([loadProjects(), refresh()]);
      showToast(`Project "${json.project.name}" berhasil dibuat`);
      router.push(`/projects/${json.project.id}`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.key.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Row 1 Header */}
      <header className="h-11 px-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <h1 className="text-[13px] font-semibold tracking-tight text-foreground">Projects</h1>
        {canManage && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
            New project
          </Button>
        )}
      </header>

      {/* Row 2 Sub-bar */}
      <div className="h-10 px-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
            All projects
          </Badge>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {filtered.length}
          </span>
        </div>

        <div className="relative w-60">
          <Search
            aria-hidden="true"
            className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
          />
          <Input
            aria-label="Cari project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari project..."
            className="h-7 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Projects Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Memuat daftar projects...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Belum ada project</p>
            <p className="text-xs text-muted-foreground">
              Buat project baru (misal: Kantin, Keuangan, Akademik) untuk mengelompokkan tiket dan milestone.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List (HP / Small Screens) */}
            <div className="md:hidden p-3 space-y-2.5">
              {filtered.map((proj) => {
                const activeMilestone =
                  proj.milestones.find((m) => m.progressPercent < 100) ?? proj.milestones[0];
                return (
                  <SpotlightCard
                    key={proj.id}
                    onClick={() => router.push(`/projects/${proj.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/projects/${proj.id}`);
                      }
                    }}
                    className="p-3.5 space-y-2.5 cursor-pointer shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${proj.color}22`, color: proj.color }}
                        >
                          <Box aria-hidden="true" className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{proj.name}</p>
                          {activeMilestone && (
                            <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Diamond aria-hidden="true" className="w-2.5 h-2.5 text-amber-400/80" />
                              {activeMilestone.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                        {proj.key}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <HealthBadge health={proj.health} />
                      <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                        <CountUp to={proj.stats.totalIssues} /> issues ·{" "}
                        <CountUp to={proj.stats.progressPercent} suffix="%" />
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${proj.stats.progressPercent}%` }}
                      />
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Health</TableHead>
                <TableHead className="w-20">Priority</TableHead>
                <TableHead className="w-40">Lead</TableHead>
                <TableHead className="w-28">Target date</TableHead>
                <TableHead className="w-20 text-right">Issues</TableHead>
                <TableHead className="w-32 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((proj) => {
                const activeMilestone =
                  proj.milestones.find((m) => m.progressPercent < 100) ?? proj.milestones[0];

                return (
                  <TableRow
                    key={proj.id}
                    onClick={() => router.push(`/projects/${proj.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${proj.color}22`, color: proj.color }}
                        >
                          <Box aria-hidden="true" className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-medium text-[13px] text-foreground truncate">
                          {proj.name}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 text-muted-foreground shrink-0">
                          {proj.key}
                        </Badge>
                        {activeMilestone && (
                          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-1 shrink-0">
                            <Diamond aria-hidden="true" className="w-3 h-3 text-amber-400/80" />
                            {activeMilestone.name}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <HealthBadge health={proj.health} />
                    </TableCell>

                    <TableCell>
                      <PriorityIcon priority={proj.priority} className="w-3.5 h-3.5" />
                    </TableCell>

                    <TableCell>
                      {proj.lead ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                            style={{ backgroundColor: proj.lead.avatarColor }}
                          >
                            {getInitials(proj.lead.name)}
                          </span>
                          <span className="text-foreground/90 truncate">{proj.lead.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono tabular-nums text-[11px] text-muted-foreground">
                      {proj.targetDate
                        ? new Date(proj.targetDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </TableCell>

                    <TableCell className="text-right font-mono tabular-nums text-foreground/90">
                      {proj.stats.totalIssues}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${proj.stats.progressPercent}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-foreground/90 w-9 text-right">
                          {proj.stats.progressPercent}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
            </div>
          </>
        )}
      </div>

      {/* Create Project Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Buat Project Baru</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setCreateOpen(false)}
                aria-label="Tutup modal"
                className="text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </Button>
            </div>

            {formErr && (
              <div className="mb-3 px-3 py-2 rounded-md bg-destructive/15 border border-destructive/40 text-xs text-red-300">
                {formErr}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Nama Project</label>
                  <Input
                    autoFocus
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Misal: Kantin / Keuangan / Akademik"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Prefix Key</label>
                  <Input
                    required
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder="FIN"
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Ringkasan Singkat</label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Deskripsi singkat modul atau cakupan project"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityValue)}
                    className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Lead</label>
                  <select
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Default (Anda)</option>
                    {data?.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Target Date</label>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Warna Ikon</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded bg-transparent border-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCreateOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
                    Buat Project
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
