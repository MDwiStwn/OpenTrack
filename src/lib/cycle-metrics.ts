import { StatusCategory } from "@prisma/client";

export interface CycleMetricIssueInput {
  id: string;
  estimate: number | null;
  priority: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  status: { category: StatusCategory | string; name: string };
  assignee?: { id: string; name: string; avatarColor: string } | null;
  project?: { id: string; name: string; key: string; color: string } | null;
  labels?: Array<{ label: { id: string; name: string; color: string } }>;
}

export interface BurnupPoint {
  date: string;
  label: string;
  isWeekend: boolean;
  scope: number;
  started: number;
  completed: number;
  dailyCompleted: number;
}

export interface CycleBreakdownRow {
  id: string;
  name: string;
  color?: string;
  avatarColor?: string;
  totalScope: number;
  completedScope: number;
  percent: number;
}

export interface CycleMetrics {
  scopePoints: number;
  startedPoints: number;
  completedPoints: number;
  totalIssues: number;
  startedIssues: number;
  completedIssues: number;
  startedPercent: number;
  completedPercent: number;
  capacityPercent: number;
  daysToStart: number;
  usesPoints: boolean;
  series: BurnupPoint[];
  breakdowns: {
    assignees: CycleBreakdownRow[];
    labels: CycleBreakdownRow[];
    priorities: CycleBreakdownRow[];
    projects: CycleBreakdownRow[];
  };
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtShortDate(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function computeCycleMetrics(
  cycle: { startDate: Date | string; endDate: Date | string },
  issues: CycleMetricIssueInput[]
): CycleMetrics {
  const start = new Date(cycle.startDate);
  const end = new Date(cycle.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const rawPoints = issues.reduce((s, i) => s + (i.estimate ?? 0), 0);
  const usesPoints = rawPoints > 0;
  const weight = (i: CycleMetricIssueInput) => (usesPoints ? i.estimate ?? 1 : 1);

  let scopePoints = 0;
  let startedPoints = 0;
  let completedPoints = 0;
  let startedIssues = 0;
  let completedIssues = 0;

  for (const i of issues) {
    const w = weight(i);
    scopePoints += w;
    if (i.status.category === StatusCategory.COMPLETED) {
      completedPoints += w;
      completedIssues += 1;
    } else if (i.status.category === StatusCategory.STARTED) {
      startedPoints += w;
      startedIssues += 1;
    }
  }

  const startedPercent = scopePoints > 0 ? Math.round((startedPoints / scopePoints) * 100) : 0;
  const completedPercent = scopePoints > 0 ? Math.round((completedPoints / scopePoints) * 100) : 0;
  const capacityPercent = scopePoints > 0 ? Math.min(150, Math.round(((completedPoints + startedPoints) / scopePoints) * 100)) : 0;

  const now = new Date();
  const daysToStart = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 86400000));

  // Build day-by-day burn-up series (between 5 and 21 points)
  const totalDays = Math.max(1, Math.min(30, Math.ceil((end.getTime() - start.getTime()) / 86400000)));
  const series: BurnupPoint[] = [];

  for (let d = 0; d <= totalDays; d++) {
    const cur = new Date(start.getTime() + d * 86400000);
    const dayStart = new Date(cur);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(cur);
    dayEnd.setHours(23, 59, 59, 999);

    const dow = cur.getDay();
    const isWeekend = dow === 0 || dow === 6;

    let dayScope = 0;
    let dayStarted = 0;
    let dayCompleted = 0;
    let dailyCompleted = 0;

    for (const iss of issues) {
      const w = weight(iss);
      const createdAt = new Date(iss.createdAt);
      const updatedAt = new Date(iss.updatedAt);

      // Include issues created on or before this day (or before cycle start)
      if (createdAt <= dayEnd || d === 0) {
        dayScope += w;
      }

      if (iss.status.category === StatusCategory.COMPLETED && updatedAt <= dayEnd) {
        dayCompleted += w;
        if (updatedAt >= dayStart && updatedAt <= dayEnd) {
          dailyCompleted += w;
        }
      } else if (
        (iss.status.category === StatusCategory.STARTED || iss.status.category === StatusCategory.COMPLETED) &&
        createdAt <= dayEnd
      ) {
        dayStarted += w;
      }
    }

    series.push({
      date: dayStart.toISOString().slice(0, 10),
      label: fmtShortDate(dayStart),
      isWeekend,
      scope: dayScope,
      started: Math.min(dayScope, dayCompleted + dayStarted),
      completed: dayCompleted,
      dailyCompleted,
    });
  }

  // Breakdowns
  const assigneeMap = new Map<string, CycleBreakdownRow>();
  const labelMap = new Map<string, CycleBreakdownRow>();
  const priorityMap = new Map<string, CycleBreakdownRow>();
  const projectMap = new Map<string, CycleBreakdownRow>();

  for (const iss of issues) {
    const w = weight(iss);
    const isDone = iss.status.category === StatusCategory.COMPLETED;

    // Assignee
    const aId = iss.assignee?.id ?? "unassigned";
    const aRow = assigneeMap.get(aId) ?? {
      id: aId,
      name: iss.assignee?.name ?? "No assignee",
      avatarColor: iss.assignee?.avatarColor,
      totalScope: 0,
      completedScope: 0,
      percent: 0,
    };
    aRow.totalScope += w;
    if (isDone) aRow.completedScope += w;
    assigneeMap.set(aId, aRow);

    // Priority
    const pKey = iss.priority || "NONE";
    const pRow = priorityMap.get(pKey) ?? {
      id: pKey,
      name: pKey,
      totalScope: 0,
      completedScope: 0,
      percent: 0,
    };
    pRow.totalScope += w;
    if (isDone) pRow.completedScope += w;
    priorityMap.set(pKey, pRow);

    // Project
    if (iss.project) {
      const prRow = projectMap.get(iss.project.id) ?? {
        id: iss.project.id,
        name: iss.project.name,
        color: iss.project.color,
        totalScope: 0,
        completedScope: 0,
        percent: 0,
      };
      prRow.totalScope += w;
      if (isDone) prRow.completedScope += w;
      projectMap.set(iss.project.id, prRow);
    }

    // Labels
    for (const l of iss.labels ?? []) {
      const lRow = labelMap.get(l.label.id) ?? {
        id: l.label.id,
        name: l.label.name,
        color: l.label.color,
        totalScope: 0,
        completedScope: 0,
        percent: 0,
      };
      lRow.totalScope += w;
      if (isDone) lRow.completedScope += w;
      labelMap.set(l.label.id, lRow);
    }
  }

  const finalize = (m: Map<string, CycleBreakdownRow>) =>
    Array.from(m.values())
      .map((r) => ({
        ...r,
        percent: r.totalScope > 0 ? Math.round((r.completedScope / r.totalScope) * 100) : 0,
      }))
      .sort((a, b) => b.totalScope - a.totalScope);

  return {
    scopePoints,
    startedPoints,
    completedPoints,
    totalIssues: issues.length,
    startedIssues,
    completedIssues,
    startedPercent,
    completedPercent,
    capacityPercent,
    daysToStart,
    usesPoints,
    series,
    breakdowns: {
      assignees: finalize(assigneeMap),
      labels: finalize(labelMap),
      priorities: finalize(priorityMap),
      projects: finalize(projectMap),
    },
  };
}
