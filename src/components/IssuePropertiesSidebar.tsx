"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Triangle,
  Repeat,
  Plus,
  X,
  Box,
  Diamond,
  ExternalLink,
  Play,
  Square,
  Zap,
  Trash2,
} from "lucide-react";
import {
  ESTIMATE_OPTIONS,
  PRIORITIES,
  getInitials,
  type IssueDTO,
  type PriorityValue,
} from "@/lib/types";
import { useWorkspace } from "./WorkspaceProvider";
import { PriorityIcon } from "./IssueCard";

export interface TimeEntryDTO {
  id: string;
  issueId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  stage?: string;
  note: string;
  isManual?: boolean;
  user: { id: string; name: string; avatarColor: string };
}

export type StageState = "pending" | "in_progress" | "done";

export interface WorkflowStageData {
  status: StageState;
  picId?: string | null;
  picIds?: string[];
}

export interface ExtraCustomField {
  id: string;
  label: string;
  value: string;
}

export interface IssueCustomFields {
  requester?: string;
  institution?: string;
  foundDate?: string;
  deliveredDate?: string;
  applications?: string[];
  version?: string;
  environment?: "Dev" | "Stg" | "Demo" | "Prod" | "";
  workflowStages?: Record<string, WorkflowStageData>;
  extraFields?: ExtraCustomField[];
  additionalAssigneeIds?: string[];
}

const WORKFLOW_STAGE_DEFS = [
  { key: "development", label: "Development" },
  { key: "codeReview", label: "Code Review" },
  { key: "qcDemo", label: "QC Demo" },
  { key: "qcProduction", label: "QC Production" },
  { key: "delivered", label: "Delivered" },
] as const;

const ENVIRONMENTS = ["Dev", "Stg", "Demo", "Prod"] as const;
const DAY_LETTERS = ["M", "S", "S", "R", "K", "J", "S"]; // Min, Sen, Sel, Rab, Kam, Jum, Sab
const MONTH_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

interface IssuePropertiesSidebarProps {
  issue: IssueDTO & { customFields?: IssueCustomFields; timeEntries?: TimeEntryDTO[] };
  onPatchIssue: (patch: Record<string, unknown>, msg?: string) => Promise<void>;
  onRefreshIssue: () => Promise<void>;
}

function formatDaysAgo(dateStr?: string): string | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffDays = Math.floor((Date.now() - parsed.getTime()) / 86400000);
  if (diffDays === 0) return "Hari ini";
  if (diffDays > 0) return `${diffDays} hari lalu`;
  return `${Math.abs(diffDays)} hari lagi`;
}

function formatTotalHours(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 m";
  if (totalSeconds < 3600) {
    return `${Math.max(1, Math.round(totalSeconds / 60))} m`;
  }
  const hours = totalSeconds / 3600;
  return `${hours.toFixed(2)} j`;
}

function formatShortMinutes(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}

function formatStopwatch(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatEntryTimeRange(startedAt: string, endedAt: string | null): string {
  const s = new Date(startedAt);
  const day = s.getDate();
  const mon = MONTH_SHORT_ID[s.getMonth()];
  const fmtHM = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  if (!endedAt) return `${day} ${mon}, ${fmtHM(s)}...`;
  const e = new Date(endedAt);
  return `${day} ${mon}, ${fmtHM(s)}-${fmtHM(e)}`;
}

export function IssuePropertiesSidebar({
  issue,
  onPatchIssue,
  onRefreshIssue,
}: IssuePropertiesSidebarProps) {
  const { data, showToast } = useWorkspace();
  const cf: IssueCustomFields = useMemo(() => issue.customFields ?? {}, [issue.customFields]);
  const timeEntries = useMemo(() => issue.timeEntries ?? [], [issue.timeEntries]);

  const [labelPickerOpen, setLabelPickerOpen] = useState(false);

  // Inline custom field drafts
  const [requester, setRequester] = useState(cf.requester ?? "");
  const [institution, setInstitution] = useState(cf.institution ?? "");
  const [foundDate, setFoundDate] = useState(cf.foundDate ?? "");
  const [deliveredDate, setDeliveredDate] = useState(cf.deliveredDate ?? "");
  const [version, setVersion] = useState(cf.version ?? "");
  const [addingApp, setAddingApp] = useState(false);
  const [newAppText, setNewAppText] = useState("");
  const [addingExtraField, setAddingExtraField] = useState(false);
  const [newExtraLabel, setNewExtraLabel] = useState("");
  const [newExtraValue, setNewExtraValue] = useState("");
  const [picMenuStage, setPicMenuStage] = useState<string | null>(null);

  // Time tracking & manual entry state
  const [timerStage, setTimerStage] = useState<string>(issue.status.name);
  const [timerNote, setTimerNote] = useState<string>("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualHours, setManualHours] = useState("0");
  const [manualMinutes, setManualMinutes] = useState("30");
  const [timerBusy, setTimerBusy] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    setRequester(cf.requester ?? "");
    setInstitution(cf.institution ?? "");
    setFoundDate(cf.foundDate ?? "");
    setDeliveredDate(cf.deliveredDate ?? "");
    setVersion(cf.version ?? "");
  }, [cf]);

  useEffect(() => {
    setTimerStage(issue.status.name);
  }, [issue.status.name]);

  const runningEntry = useMemo(
    () => timeEntries.find((e) => e.endedAt === null && e.userId === data?.user.id) ?? null,
    [timeEntries, data?.user.id]
  );

  useEffect(() => {
    if (!runningEntry) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningEntry]);

  const liveElapsed = runningEntry
    ? Math.max(0, Math.floor((nowTick - new Date(runningEntry.startedAt).getTime()) / 1000))
    : 0;

  const totalLoggedSeconds = useMemo(() => {
    const completed = timeEntries.reduce((sum, e) => sum + (e.endedAt ? e.durationSeconds : 0), 0);
    return completed + liveElapsed;
  }, [timeEntries, liveElapsed]);

  // Accumulate logged seconds per workflow stage (Development, Code Review, QC Demo, QC Production, Delivered)
  const stageDurations = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const entry of timeEntries) {
      const secs = entry.endedAt ? entry.durationSeconds : liveElapsed;
      const tag = `${entry.stage ?? ""} ${entry.note ?? ""}`.toLowerCase();
      if (tag.includes("qc prod")) totals.qcProduction = (totals.qcProduction ?? 0) + secs;
      else if (tag.includes("qc demo") || tag.includes("qc")) totals.qcDemo = (totals.qcDemo ?? 0) + secs;
      else if (tag.includes("code review") || tag.includes("review")) totals.codeReview = (totals.codeReview ?? 0) + secs;
      else if (tag.includes("deliver") || tag.includes("deploy")) totals.delivered = (totals.delivered ?? 0) + secs;
      else if (tag.includes("dev") || tag.includes("sprint")) totals.development = (totals.development ?? 0) + secs;
    }
    return totals;
  }, [timeEntries, liveElapsed]);

  // Last 7 days bar chart data
  const last7Days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        key,
        letter: DAY_LETTERS[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 6,
        seconds: 0,
      };
    });
    const byKey = Object.fromEntries(days.map((d) => [d.key, d]));
    for (const entry of timeEntries) {
      const k = new Date(entry.startedAt).toISOString().slice(0, 10);
      if (byKey[k]) {
        byKey[k].seconds += entry.endedAt ? entry.durationSeconds : liveElapsed;
      }
    }
    const maxSecs = Math.max(1, ...days.map((d) => d.seconds));
    return days.map((d) => ({ ...d, pct: d.seconds > 0 ? Math.max(12, Math.round((d.seconds / maxSecs) * 100)) : 0 }));
  }, [timeEntries, liveElapsed]);

  async function saveCustomFields(partial: Partial<IssueCustomFields>, msg?: string) {
    const merged: IssueCustomFields = { ...cf, ...partial };
    await onPatchIssue({ customFields: merged }, msg);
  }

  async function handleToggleLabel(labelId: string) {
    const current = issue.labels.map((l) => l.id);
    const next = current.includes(labelId)
      ? current.filter((x) => x !== labelId)
      : [...current, labelId];
    await onPatchIssue({ labelIds: next });
  }

  const stages = cf.workflowStages ?? {};
  const completedStagesCount = WORKFLOW_STAGE_DEFS.filter(
    (s) => stages[s.key]?.status === "done"
  ).length;

  async function cycleStageStatus(stageKey: string) {
    const current = stages[stageKey]?.status ?? "pending";
    const next: StageState =
      current === "pending" ? "in_progress" : current === "in_progress" ? "done" : "pending";
    await saveCustomFields({
      workflowStages: {
        ...stages,
        [stageKey]: { ...(stages[stageKey] ?? {}), status: next },
      },
    });
  }

  function getStagePicIds(stageKey: string): string[] {
    const s = stages[stageKey];
    if (!s) return [];
    if (Array.isArray(s.picIds)) return s.picIds;
    if (s.picId) return [s.picId];
    return [];
  }

  async function toggleStagePic(stageKey: string, memberId: string) {
    const currentIds = getStagePicIds(stageKey);
    const nextIds = currentIds.includes(memberId)
      ? currentIds.filter((id) => id !== memberId)
      : [...currentIds, memberId];
    await saveCustomFields({
      workflowStages: {
        ...stages,
        [stageKey]: {
          ...(stages[stageKey] ?? { status: "pending" }),
          picIds: nextIds,
          picId: nextIds[0] ?? null,
        },
      },
    });
  }

  async function clearStagePics(stageKey: string) {
    setPicMenuStage(null);
    await saveCustomFields({
      workflowStages: {
        ...stages,
        [stageKey]: {
          ...(stages[stageKey] ?? { status: "pending" }),
          picIds: [],
          picId: null,
        },
      },
    });
  }

  async function autoSyncStagesFromStatus() {
    const slug = issue.status.slug;
    const rankMap: Record<string, number> = {
      backlog: 0,
      "select-for-sprint": 0,
      "in-development": 1,
      "qc-demo-standby": 2,
      "qc-demo": 3,
      "request-deploy": 4,
      done: 5,
      delivered: 5,
    };
    const rank = rankMap[slug] ?? 0;
    const nextStages: Record<string, WorkflowStageData> = {};
    WORKFLOW_STAGE_DEFS.forEach((def, idx) => {
      const existing = stages[def.key] ?? { status: "pending" };
      let st: StageState = "pending";
      if (idx + 1 <= rank) st = "done";
      else if (idx === rank && rank > 0) st = "in_progress";
      nextStages[def.key] = { ...existing, status: st };
    });
    await saveCustomFields({ workflowStages: nextStages }, "Workflow stage disinkronkan");
  }

  async function handleAddApplication(e: React.FormEvent) {
    e.preventDefault();
    const val = newAppText.trim();
    if (!val) return;
    const current = cf.applications ?? [];
    if (!current.includes(val)) {
      await saveCustomFields({ applications: [...current, val] });
    }
    setNewAppText("");
    setAddingApp(false);
  }

  async function handleRemoveApplication(app: string) {
    const current = cf.applications ?? [];
    await saveCustomFields({ applications: current.filter((a) => a !== app) });
  }

  async function handleAddExtraField(e: React.FormEvent) {
    e.preventDefault();
    if (!newExtraLabel.trim()) return;
    const current = cf.extraFields ?? [];
    const next: ExtraCustomField[] = [
      ...current,
      { id: String(Date.now()), label: newExtraLabel.trim(), value: newExtraValue.trim() },
    ];
    await saveCustomFields({ extraFields: next }, "Field kustom ditambahkan");
    setNewExtraLabel("");
    setNewExtraValue("");
    setAddingExtraField(false);
  }

  async function handleRemoveExtraField(id: string) {
    const current = cf.extraFields ?? [];
    await saveCustomFields({ extraFields: current.filter((f) => f.id !== id) });
  }

  async function handleToggleTimer() {
    setTimerBusy(true);
    try {
      const res = await fetch(
        `/api/internal/issues/${encodeURIComponent(issue.identifier)}/time-entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: runningEntry ? "stop" : "start",
            stage: timerStage,
            note: timerNote.trim() || undefined,
          }),
        }
      );
      if (res.ok) {
        if (runningEntry) setTimerNote("");
        await onRefreshIssue();
        showToast(runningEntry ? "Timer dihentikan dan dicatat" : `Timer dimulai (${timerStage})`);
      } else {
        showToast("Gagal memperbarui timer", { type: "error" });
      }
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleLogManual(durationSeconds: number, date?: string) {
    if (durationSeconds <= 0) return;
    setTimerBusy(true);
    try {
      const res = await fetch(
        `/api/internal/issues/${encodeURIComponent(issue.identifier)}/time-entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "manual",
            durationSeconds,
            stage: timerStage,
            note: timerNote.trim() || undefined,
            date,
          }),
        }
      );
      if (res.ok) {
        setTimerNote("");
        await onRefreshIssue();
        showToast(`Dicatat ${formatShortMinutes(durationSeconds)} (${timerStage})`);
      } else {
        showToast("Gagal mencatat waktu", { type: "error" });
      }
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleManualFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Math.max(0, parseInt(manualHours, 10) || 0);
    const m = Math.max(0, parseInt(manualMinutes, 10) || 0);
    const totalSecs = h * 3600 + m * 60;
    if (totalSecs <= 0) {
      showToast("Isi Jam atau Menit minimal 1 menit", { type: "error" });
      return;
    }
    await handleLogManual(totalSecs, manualDate);
  }

  async function handleDeleteTimeEntry(entryId: string) {
    const res = await fetch(
      `/api/internal/issues/${encodeURIComponent(issue.identifier)}/time-entries?entryId=${entryId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await onRefreshIssue();
    }
  }

  const foundRelative = formatDaysAgo(foundDate);

  return (
    <aside className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#1c1c24] bg-[#0d0d10] p-4 space-y-5 overflow-y-auto text-xs">
      {/* 1. Properties */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium text-zinc-500">Properties</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
            <span
              className="w-3 h-3 rounded-full border-2 shrink-0"
              style={{ borderColor: issue.status.color }}
            />
            <select
              aria-label="Status tiket"
              value={issue.statusId}
              onChange={(e) => onPatchIssue({ statusId: e.target.value }, "Status diperbarui")}
              className="flex-1 bg-transparent text-zinc-200 font-medium focus:outline-none"
            >
              {data?.statuses.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#15151a]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
            <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5 shrink-0" />
            <select
              aria-label="Prioritas tiket"
              value={issue.priority}
              onChange={(e) =>
                onPatchIssue({ priority: e.target.value as PriorityValue }, "Prioritas diperbarui")
              }
              className="flex-1 bg-transparent text-zinc-200 focus:outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value} className="bg-[#15151a]">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
            {issue.assignee ? (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                style={{ backgroundColor: issue.assignee.avatarColor }}
              >
                {getInitials(issue.assignee.name)}
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full border border-dashed border-zinc-600 flex items-center justify-center text-[8px] text-zinc-500 shrink-0">
                ?
              </span>
            )}
            <select
              aria-label="Assignee tiket"
              value={issue.assigneeId ?? ""}
              onChange={(e) =>
                onPatchIssue({ assigneeId: e.target.value || null }, "Assignee diperbarui")
              }
              className="flex-1 bg-transparent text-zinc-200 focus:outline-none truncate"
            >
              <option value="" className="bg-[#15151a]">
                Unassigned
              </option>
              {data?.members.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#15151a]">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
            <Triangle aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <select
              aria-label="Estimate points"
              value={issue.estimate ?? ""}
              onChange={(e) =>
                onPatchIssue(
                  { estimate: e.target.value ? parseInt(e.target.value, 10) : null },
                  "Estimate diperbarui"
                )
              }
              className="flex-1 bg-transparent text-zinc-200 tabular-nums focus:outline-none"
            >
              <option value="" className="bg-[#15151a]">
                No estimate
              </option>
              {ESTIMATE_OPTIONS.map((pt) => (
                <option key={pt} value={pt} className="bg-[#15151a]">
                  {pt} Points
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
            <Repeat aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <select
              aria-label="Cycle sprint"
              value={issue.cycleId ?? ""}
              onChange={(e) =>
                onPatchIssue({ cycleId: e.target.value || null }, "Cycle diperbarui")
              }
              className="flex-1 bg-transparent text-zinc-300 focus:outline-none truncate"
            >
              <option value="" className="bg-[#15151a]">
                No Cycle
              </option>
              {data?.cycles.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#15151a]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2. Labels */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium text-zinc-500">Labels</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {issue.labels.map((lbl) => (
            <span
              key={lbl.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#15151b] border border-[#252530] text-[11px] text-zinc-200"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />
              {lbl.name}
              <button
                type="button"
                aria-label={`Hapus label ${lbl.name}`}
                onClick={() => handleToggleLabel(lbl.id)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <X aria-hidden="true" className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setLabelPickerOpen((v) => !v)}
            aria-label="Tambah atau ubah label"
            className="w-6 h-6 rounded-full border border-dashed border-[#2c2c38] hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition"
          >
            <Plus aria-hidden="true" className="w-3 h-3" />
          </button>

          {labelPickerOpen && data && (
            <div className="w-full mt-1.5 p-2 rounded-lg bg-[#15151b] border border-[#292936] flex flex-wrap gap-1.5">
              {data.labels.map((lbl) => {
                const active = issue.labels.some((il) => il.id === lbl.id);
                return (
                  <button
                    key={lbl.id}
                    type="button"
                    onClick={() => handleToggleLabel(lbl.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition ${
                      active
                        ? "bg-[#5e6ad2]/20 border-[#5e6ad2] text-zinc-100"
                        : "bg-[#101015] border-[#252530] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                    {lbl.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. Project & Milestone */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-500">Project</h3>
          <Link
            href={`/projects/${issue.projectId}`}
            title="Buka halaman project"
            aria-label={`Buka project ${issue.project.name}`}
            className="text-zinc-500 hover:text-zinc-200 p-0.5 rounded transition"
          >
            <ExternalLink aria-hidden="true" className="w-3 h-3" />
          </Link>
        </div>
        {(() => {
          const activeProject = data?.projects.find((p) => p.id === issue.projectId);
          const milestones = activeProject?.milestones ?? [];
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
                <span
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 border border-white/10"
                  style={{ backgroundColor: `${issue.project.color}22` }}
                >
                  <Box
                    aria-hidden="true"
                    className="w-3 h-3"
                    style={{ color: issue.project.color }}
                  />
                </span>
                <select
                  aria-label="Project tiket"
                  value={issue.projectId}
                  onChange={(e) =>
                    onPatchIssue(
                      { projectId: e.target.value, milestoneId: null },
                      "Project diperbarui"
                    )
                  }
                  className="flex-1 bg-transparent text-zinc-200 font-medium focus:outline-none truncate"
                >
                  {(data?.projects ?? [issue.project]).map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#15151a]">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative pl-4">
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-0 h-3.5 w-2.5 border-l border-b border-[#2b2b38] rounded-bl-[3px]"
                />
                <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#16161d] transition">
                  <Diamond
                    aria-hidden="true"
                    className={`w-3 h-3 shrink-0 ${
                      issue.milestoneId
                        ? "text-[#7b86eb] fill-[#7b86eb]/30"
                        : "text-zinc-600"
                    }`}
                  />
                  <select
                    aria-label="Milestone project"
                    value={issue.milestoneId ?? ""}
                    onChange={(e) =>
                      onPatchIssue(
                        { milestoneId: e.target.value || null },
                        "Milestone diperbarui"
                      )
                    }
                    className={`flex-1 bg-transparent focus:outline-none truncate ${
                      issue.milestoneId ? "text-zinc-200" : "text-zinc-500"
                    }`}
                  >
                    <option value="" className="bg-[#15151a]">
                      No milestone
                    </option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#15151a]">
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* 4. Custom Field & Time Tracking */}
      <div className="pt-3 border-t border-[#1e1e26] space-y-5">
        <p className="text-[11px] font-medium text-zinc-400">Custom Field &amp; Time Tracking</p>

        {/* Informasi Issue (inline editable + extra custom fields) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-medium text-zinc-500">Informasi Issue</h4>
            <button
              type="button"
              onClick={() => setAddingExtraField((v) => !v)}
              className="text-[10px] text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-0.5"
            >
              <Plus aria-hidden="true" className="w-3 h-3" /> Field
            </button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 items-center gap-2">
              <label htmlFor="cf-requester" className="col-span-5 text-[11px] text-zinc-500">
                Requester
              </label>
              <div className="col-span-7 flex items-center gap-1.5 min-w-0">
                {requester && (
                  <span className="w-4 h-4 rounded-full bg-teal-600/80 text-[8px] font-semibold text-white flex items-center justify-center shrink-0">
                    {getInitials(requester)}
                  </span>
                )}
                <input
                  id="cf-requester"
                  value={requester}
                  onChange={(e) => setRequester(e.target.value)}
                  onBlur={() => {
                    if (requester !== (cf.requester ?? "")) {
                      void saveCustomFields({ requester });
                    }
                  }}
                  placeholder="Klik untuk isi..."
                  className="w-full bg-transparent hover:bg-[#16161d] focus:bg-[#16161d] rounded px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label htmlFor="cf-inst" className="col-span-5 text-[11px] text-zinc-500">
                Sekolah/Institusi
              </label>
              <input
                id="cf-inst"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                onBlur={() => {
                  if (institution !== (cf.institution ?? "")) {
                    void saveCustomFields({ institution });
                  }
                }}
                placeholder="Klik untuk isi..."
                className="col-span-7 bg-transparent hover:bg-[#16161d] focus:bg-[#16161d] rounded px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600"
              />
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label htmlFor="cf-found" className="col-span-5 text-[11px] text-zinc-500">
                Tanggal Ditemukan
              </label>
              <div className="col-span-7 space-y-0.5">
                <input
                  id="cf-found"
                  type="date"
                  value={foundDate}
                  onChange={(e) => {
                    setFoundDate(e.target.value);
                    void saveCustomFields({ foundDate: e.target.value });
                  }}
                  className="w-full bg-transparent hover:bg-[#16161d] rounded px-1.5 py-0.5 text-[11px] text-zinc-200"
                />
                {foundRelative && (
                  <p className="px-1.5 text-[10px] text-zinc-500">{foundRelative}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label htmlFor="cf-delivered" className="col-span-5 text-[11px] text-zinc-500">
                Tanggal Delivered
              </label>
              <input
                id="cf-delivered"
                type="date"
                value={deliveredDate}
                onChange={(e) => {
                  setDeliveredDate(e.target.value);
                  void saveCustomFields({ deliveredDate: e.target.value });
                }}
                className="col-span-7 bg-transparent hover:bg-[#16161d] rounded px-1.5 py-0.5 text-[11px] text-zinc-200"
              />
            </div>

            {/* Extra user-defined custom fields */}
            {(cf.extraFields ?? []).map((ef) => (
              <div key={ef.id} className="grid grid-cols-12 items-center gap-2 group">
                <span className="col-span-5 text-[11px] text-zinc-500 truncate">{ef.label}</span>
                <div className="col-span-7 flex items-center justify-between gap-1 px-1.5">
                  <span className="text-xs text-zinc-200 truncate">{ef.value || "-"}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExtraField(ef.id)}
                    aria-label={`Hapus field ${ef.label}`}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400"
                  >
                    <X aria-hidden="true" className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {addingExtraField && (
              <form
                onSubmit={handleAddExtraField}
                className="p-2 rounded-lg bg-[#14141a] border border-[#262632] space-y-1.5"
              >
                <input
                  autoFocus
                  required
                  value={newExtraLabel}
                  onChange={(e) => setNewExtraLabel(e.target.value)}
                  placeholder="Nama field (misal: Link PR)"
                  className="w-full px-2 py-1 text-[11px] bg-[#101014] border border-[#262632] rounded text-zinc-100"
                />
                <input
                  value={newExtraValue}
                  onChange={(e) => setNewExtraValue(e.target.value)}
                  placeholder="Nilai field..."
                  className="w-full px-2 py-1 text-[11px] bg-[#101014] border border-[#262632] rounded text-zinc-100"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAddingExtraField(false)}
                    className="px-2 py-0.5 text-[11px] text-zinc-400"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-0.5 rounded bg-[#5e6ad2] text-[11px] text-white"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Workflow 5-Stage Progress with per-stage accumulated duration */}
        <section className="pt-3 border-t border-[#1e1e26] space-y-2.5">
          <h4 className="text-[11px] font-medium text-zinc-500">Workflow</h4>

          <div className="grid grid-cols-5 gap-1">
            {WORKFLOW_STAGE_DEFS.map((def) => {
              const st = stages[def.key]?.status ?? "pending";
              return (
                <div
                  key={def.key}
                  className={`h-1 rounded-full ${
                    st === "done"
                      ? "bg-emerald-500"
                      : st === "in_progress"
                        ? "bg-amber-400"
                        : "bg-[#22222c]"
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono tabular-nums text-zinc-400">
              {completedStagesCount} / 5 selesai
            </span>
            <button
              type="button"
              onClick={autoSyncStagesFromStatus}
              title="Sinkronkan progres tahap otomatis dari Status tiket"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b1b29] hover:bg-[#242438] border border-[#2f2f46] text-[10px] font-medium text-indigo-300 transition"
            >
              <Zap aria-hidden="true" className="w-2.5 h-2.5 text-amber-400" />
              Otomatis
            </button>
          </div>

          <div className="space-y-1">
            {WORKFLOW_STAGE_DEFS.map((def) => {
              const st = stages[def.key]?.status ?? "pending";
              const picIds = getStagePicIds(def.key);
              const stagePics = picIds
                .map((id) => data?.members.find((m) => m.id === id))
                .filter(Boolean);
              const stageSecs = stageDurations[def.key] ?? 0;

              return (
                <div key={def.key} className="relative">
                  <div className="flex items-center justify-between gap-2 py-1 px-1 rounded hover:bg-[#15151b] transition">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          st === "done"
                            ? "bg-emerald-400"
                            : st === "in_progress"
                              ? "bg-amber-400"
                              : "bg-zinc-600"
                        }`}
                      />
                      <span className="text-xs text-zinc-300 truncate">{def.label}</span>

                      {/* Multi-PIC Stacked Avatars + Add Trigger */}
                      <button
                        type="button"
                        onClick={() =>
                          setPicMenuStage((prev) => (prev === def.key ? null : def.key))
                        }
                        title={
                          stagePics.length > 0
                            ? `PIC (${stagePics.length}): ${stagePics.map((p) => p!.name).join(", ")}`
                            : `Pilih PIC ${def.label} (bisa >1 orang)`
                        }
                        aria-label={`Atur PIC untuk ${def.label}`}
                        className="inline-flex items-center -space-x-1 shrink-0"
                      >
                        {stagePics.map((p) => (
                          <span
                            key={p!.id}
                            className="w-4 h-4 rounded-full ring-1 ring-[#0d0d10] flex items-center justify-center text-[8px] font-semibold text-white"
                            style={{ backgroundColor: p!.avatarColor }}
                          >
                            {getInitials(p!.name)}
                          </span>
                        ))}
                        <span className="w-4 h-4 rounded-full bg-[#22222c] hover:bg-[#2d2d3a] ring-1 ring-[#0d0d10] flex items-center justify-center text-[9px] text-zinc-400 hover:text-zinc-100">
                          +
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => cycleStageStatus(def.key)}
                        className={`text-[11px] font-medium ${
                          st === "done"
                            ? "text-emerald-400"
                            : st === "in_progress"
                              ? "text-amber-400"
                              : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {st === "done" ? "Selesai" : st === "in_progress" ? "Berjalan" : "Belum"}
                      </button>
                      {stageSecs > 0 && (
                        <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                          · {formatShortMinutes(stageSecs)}
                        </span>
                      )}
                    </div>
                  </div>

                  {picMenuStage === def.key && data && (
                    <div className="mt-1 mb-1 p-1.5 rounded-lg bg-[#15151b] border border-[#2a2a36] space-y-0.5">
                      <div className="px-2 py-1 flex items-center justify-between border-b border-[#22222c] mb-1">
                        <span className="text-[10px] text-zinc-500">
                          Pilih PIC ({picIds.length} dipilih)
                        </span>
                        <div className="flex items-center gap-2">
                          {picIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => clearStagePics(def.key)}
                              className="text-[10px] text-zinc-400 hover:text-red-400"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPicMenuStage(null)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300"
                          >
                            Selesai
                          </button>
                        </div>
                      </div>
                      {data.members.map((m) => {
                        const selected = picIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleStagePic(def.key, m.id)}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] transition ${
                              selected
                                ? "bg-[#5e6ad2]/20 text-zinc-100"
                                : "text-zinc-300 hover:bg-[#1e1e28]"
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                                style={{ backgroundColor: m.avatarColor }}
                              >
                                {getInitials(m.name)}
                              </span>
                              <span className="truncate">{m.name}</span>
                            </span>
                            <input
                              type="checkbox"
                              readOnly
                              checked={selected}
                              className="accent-[#5e6ad2] pointer-events-none"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Informasi Platform */}
        <section className="pt-3 border-t border-[#1e1e26] space-y-2.5">
          <h4 className="text-[11px] font-medium text-zinc-500">Informasi Platform</h4>

          <div className="space-y-1.5">
            <span className="block text-[11px] text-zinc-500">Application</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(cf.applications ?? []).map((app) => (
                <span
                  key={app}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#181822] border border-[#2a2a38] text-[11px] text-zinc-200"
                >
                  {app}
                  <button
                    type="button"
                    aria-label={`Hapus ${app}`}
                    onClick={() => handleRemoveApplication(app)}
                    className="text-zinc-500 hover:text-zinc-200"
                  >
                    <X aria-hidden="true" className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {addingApp ? (
                <form onSubmit={handleAddApplication} className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    value={newAppText}
                    onChange={(e) => setNewAppText(e.target.value)}
                    onBlur={() => {
                      if (!newAppText.trim()) setAddingApp(false);
                    }}
                    placeholder="Nama aplikasi..."
                    className="w-36 px-2 py-0.5 text-[11px] bg-[#16161d] border border-[#2e2e3d] rounded text-zinc-100"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingApp(true)}
                  aria-label="Tambah Application"
                  className="w-5 h-5 rounded border border-[#2a2a38] bg-[#14141a] hover:bg-[#1d1d26] text-zinc-400 hover:text-zinc-200 flex items-center justify-center"
                >
                  <Plus aria-hidden="true" className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 items-center gap-2">
            <label htmlFor="cf-version" className="col-span-5 text-[11px] text-zinc-500">
              Version
            </label>
            <input
              id="cf-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              onBlur={() => {
                if (version !== (cf.version ?? "")) {
                  void saveCustomFields({ version });
                }
              }}
              placeholder="Set version"
              className="col-span-7 bg-transparent hover:bg-[#16161d] focus:bg-[#16161d] rounded px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600"
            />
          </div>

          <div className="grid grid-cols-12 items-center gap-2">
            <span className="col-span-5 text-[11px] text-zinc-500">Environment</span>
            <div className="col-span-7 flex items-center gap-1">
              {ENVIRONMENTS.map((env) => {
                const active = cf.environment === env;
                return (
                  <button
                    key={env}
                    type="button"
                    onClick={() => saveCustomFields({ environment: active ? "" : env })}
                    className={`px-2 py-0.5 rounded text-[11px] border transition ${
                      active
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-medium"
                        : "bg-[#141419] border-[#262632] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {env}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Time Tracking */}
        <section className="pt-3 border-t border-[#1e1e26] space-y-2.5">
          <h4 className="text-[11px] font-medium text-zinc-500">Time tracking</h4>

          {/* Stage / Catatan selector for timer & quick logs */}
          <div className="grid grid-cols-2 gap-1.5">
            <select
              aria-label="Tahap pengerjaan timer"
              value={timerStage}
              onChange={(e) => setTimerStage(e.target.value)}
              className="text-[11px] bg-[#141419] border border-[#242430] rounded-md px-2 py-1 text-zinc-200"
            >
              <option value="Development">Development</option>
              <option value="Code Review">Code Review</option>
              <option value="QC Demo">QC Demo</option>
              <option value="QC Production">QC Production</option>
              <option value="Delivered">Delivered</option>
            </select>
            <input
              aria-label="Catatan aktivitas"
              value={timerNote}
              onChange={(e) => setTimerNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className="text-[11px] bg-[#141419] border border-[#242430] rounded-md px-2 py-1 text-zinc-200 placeholder-zinc-600"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono tabular-nums text-zinc-300">
              {runningEntry ? formatStopwatch(liveElapsed) : "Belum berjalan"}
            </span>
            <button
              type="button"
              disabled={timerBusy}
              onClick={handleToggleTimer}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition ${
                runningEntry
                  ? "bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25"
                  : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
              }`}
            >
              {runningEntry ? (
                <>
                  <Square aria-hidden="true" className="w-3 h-3 fill-current" /> Stop
                </>
              ) : (
                <>
                  <Play aria-hidden="true" className="w-3 h-3 fill-current" /> Start
                </>
              )}
            </button>
          </div>
        </section>

        {/* Time Entries: Total + 7-Day Bar Chart + Quick Add + Manual Form + Detailed Log */}
        <section className="pt-3 border-t border-[#1e1e26] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-medium text-zinc-500">Time entries</h4>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Total tercatat</span>
            <span className="font-mono tabular-nums font-semibold text-zinc-100">
              {formatTotalHours(totalLoggedSeconds)}
            </span>
          </div>

          {/* 7-Day Mini Bar Chart */}
          <div className="rounded-lg bg-[#111116] border border-[#1f1f29] px-3 pt-4 pb-2.5">
            <div className="grid grid-cols-7 gap-2 items-end h-14">
              {last7Days.map((day) => (
                <div
                  key={day.key}
                  title={`${day.key}: ${formatShortMinutes(day.seconds) || "0m"}`}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-3.5 rounded-t ${
                        day.seconds > 0 ? "bg-emerald-500/80" : "bg-[#22222c]"
                      }`}
                      style={{ height: day.seconds > 0 ? `${day.pct}%` : "3px" }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      day.isToday ? "text-emerald-400 font-semibold" : "text-zinc-500"
                    }`}
                  >
                    {day.letter} {day.dayNum}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Add (+15m, +30m, +1j) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 mr-1">Tambah cepat</span>
            {[
              { label: "+15m", secs: 900 },
              { label: "+30m", secs: 1800 },
              { label: "+1j", secs: 3600 },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                disabled={timerBusy}
                onClick={() => handleLogManual(btn.secs)}
                className="px-2 py-0.5 rounded bg-[#15151c] hover:bg-[#1f1f2a] border border-[#272734] text-[11px] font-mono text-zinc-200 transition"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Manual Date / Jam / Menit Form */}
          <form onSubmit={handleManualFormSubmit} className="grid grid-cols-12 gap-1.5 items-end">
            <div className="col-span-5">
              <label htmlFor="te-date" className="block text-[10px] text-zinc-500 mb-1">
                Tanggal
              </label>
              <input
                id="te-date"
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-1.5 py-1 rounded bg-[#141419] border border-[#262632] text-[11px] text-zinc-200"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="te-hours" className="block text-[10px] text-zinc-500 mb-1">
                Jam
              </label>
              <input
                id="te-hours"
                type="number"
                min={0}
                max={24}
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value)}
                className="w-full px-1.5 py-1 rounded bg-[#141419] border border-[#262632] text-[11px] font-mono text-zinc-200 text-center"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="te-mins" className="block text-[10px] text-zinc-500 mb-1">
                Menit
              </label>
              <input
                id="te-mins"
                type="number"
                min={0}
                max={59}
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                className="w-full px-1.5 py-1 rounded bg-[#141419] border border-[#262632] text-[11px] font-mono text-zinc-200 text-center"
              />
            </div>
            <div className="col-span-3">
              <button
                type="submit"
                disabled={timerBusy}
                className="w-full py-1 rounded bg-[#181822] hover:bg-[#232330] border border-[#2c2c3c] text-[11px] font-medium text-zinc-200 transition"
              >
                Tambah
              </button>
            </div>
          </form>

          {/* Time Entries Log Rows (1:1 reference style) */}
          {timeEntries.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {timeEntries.map((entry) => {
                const badgeText = entry.note
                  ? `${entry.stage ? `${entry.stage}: ` : ""}${entry.note}`
                  : entry.stage || "";

                return (
                  <div
                    key={entry.id}
                    className="group flex items-center justify-between gap-1.5 py-1 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-zinc-300 font-mono tabular-nums shrink-0 text-[10px]">
                        {formatEntryTimeRange(entry.startedAt, entry.endedAt)}
                      </span>
                      {entry.isManual && (
                        <span className="text-[10px] text-zinc-500 shrink-0">manual</span>
                      )}
                      {badgeText && (
                        <span
                          title={badgeText}
                          className="px-1.5 py-0.5 rounded bg-[#17171f] border border-[#242430] text-[10px] text-zinc-400 truncate max-w-[110px]"
                        >
                          {badgeText}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 font-mono tabular-nums text-zinc-200">
                      <span>
                        {entry.endedAt
                          ? formatStopwatch(entry.durationSeconds)
                          : formatStopwatch(liveElapsed)}
                      </span>
                      {entry.endedAt && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTimeEntry(entry.id)}
                          aria-label="Hapus catatan waktu"
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition"
                        >
                          <Trash2 aria-hidden="true" className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
