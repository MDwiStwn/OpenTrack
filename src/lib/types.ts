export type PriorityValue = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type StatusCategoryValue = "BACKLOG" | "UNSTARTED" | "STARTED" | "COMPLETED";
export type CycleStatusValue = "UPCOMING" | "ACTIVE" | "COMPLETED";

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface ProjectMilestoneRef {
  id: string;
  name: string;
  description?: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  key: string;
  summary?: string;
  description: string;
  color: string;
  status?: string;
  health?: string;
  priority?: PriorityValue;
  lead?: UserRef | null;
  startDate?: string | null;
  targetDate?: string | null;
  issueCounter: number;
  milestones?: ProjectMilestoneRef[];
  _count?: { issues: number };
}

export interface StatusDTO {
  id: string;
  name: string;
  slug: string;
  category: StatusCategoryValue;
  color: string;
  position: number;
}

export interface LabelDTO {
  id: string;
  name: string;
  color: string;
}

export interface CycleDTO {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: CycleStatusValue;
  stats?: {
    totalIssues: number;
    completedIssues: number;
    totalPoints: number;
    completedPoints: number;
    issueProgress: number;
    pointProgress: number;
  };
}

export interface IssueDTO {
  id: string;
  identifier: string;
  number: number;
  title: string;
  description: string;
  priority: PriorityValue;
  estimate: number | null;
  sortOrder: number;
  statusId: string;
  projectId: string;
  assigneeId: string | null;
  cycleId: string | null;
  milestoneId?: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; key: string; color: string };
  status: StatusDTO;
  assignee: UserRef | null;
  reporter?: UserRef | null;
  cycle: { id: string; name: string; status: CycleStatusValue } | null;
  milestone?: { id: string; name: string } | null;
  parent?: { id: string; identifier: string; title: string } | null;
  labels: LabelDTO[];
  subIssueCount: number;
  commentCount: number;
}

export interface FilterState {
  search?: string;
  statusIds?: string[];
  priorities?: PriorityValue[];
  assigneeIds?: string[];
  labelIds?: string[];
  projectIds?: string[];
  cycleId?: string | null;
}

export interface SavedViewDTO {
  id: string;
  name: string;
  description: string;
  isShared: boolean;
  filters: FilterState;
  displayConfig: {
    viewMode?: "kanban" | "list";
    swimlane?: "none" | "priority" | "assignee";
  };
  owner: UserRef;
  createdAt: string;
}

export const PRIORITIES: Array<{
  value: PriorityValue;
  label: string;
  shortLabel: string;
  color: string;
  bgClass: string;
  textClass: string;
}> = [
  { value: "URGENT", label: "Urgent", shortLabel: "Urgent", color: "#ef4444", bgClass: "bg-red-500/15 border-red-500/30", textClass: "text-red-400" },
  { value: "HIGH", label: "High", shortLabel: "High", color: "#f97316", bgClass: "bg-orange-500/15 border-orange-500/30", textClass: "text-orange-400" },
  { value: "MEDIUM", label: "Medium", shortLabel: "Medium", color: "#eab308", bgClass: "bg-yellow-500/15 border-yellow-500/30", textClass: "text-yellow-400" },
  { value: "LOW", label: "Low", shortLabel: "Low", color: "#3b82f6", bgClass: "bg-blue-500/15 border-blue-500/30", textClass: "text-blue-400" },
  { value: "NONE", label: "No Priority", shortLabel: "None", color: "#71717a", bgClass: "bg-zinc-500/10 border-zinc-700", textClass: "text-zinc-400" },
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.value, p])) as Record<
  PriorityValue,
  (typeof PRIORITIES)[number]
>;

export const ESTIMATE_OPTIONS = [1, 2, 3, 5, 8, 13];

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
