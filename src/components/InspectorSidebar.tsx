"use client";

import { useState, useMemo } from "react";
import { LayoutGrid, Building2, Triangle, Pencil, X } from "lucide-react";
import { getInitials, type IssueDTO, type SavedViewDTO } from "@/lib/types";
import { useWorkspace } from "./WorkspaceProvider";

interface InspectorSidebarProps {
  title: string;
  description?: string;
  owner?: SavedViewDTO["owner"] | null;
  issues: IssueDTO[];
  onEditView?: () => void;
  onClose?: () => void;
}

type TabKey = "assignees" | "labels" | "projects";

export function InspectorSidebar({
  title,
  description,
  owner,
  issues,
  onEditView,
  onClose,
}: InspectorSidebarProps) {
  const { data } = useWorkspace();
  const [tab, setTab] = useState<TabKey>("assignees");

  const summary = useMemo(() => {
    const assigneeMap = new Map<
      string,
      { id: string; name: string; color: string; count: number; points: number }
    >();
    for (const issue of issues) {
      const key = issue.assignee?.id ?? "unassigned";
      const existing = assigneeMap.get(key) ?? {
        id: key,
        name: issue.assignee?.name ?? "Unassigned",
        color: issue.assignee?.avatarColor ?? "#52525b",
        count: 0,
        points: 0,
      };
      existing.count += 1;
      existing.points += issue.estimate ?? 0;
      assigneeMap.set(key, existing);
    }

    const labelMap = new Map<
      string,
      { id: string; name: string; color: string; count: number; points: number }
    >();
    for (const issue of issues) {
      if (issue.labels.length === 0) {
        const existing = labelMap.get("unlabeled") ?? {
          id: "unlabeled",
          name: "No Label",
          color: "#52525b",
          count: 0,
          points: 0,
        };
        existing.count += 1;
        existing.points += issue.estimate ?? 0;
        labelMap.set("unlabeled", existing);
      } else {
        for (const lbl of issue.labels) {
          const existing = labelMap.get(lbl.id) ?? {
            id: lbl.id,
            name: lbl.name,
            color: lbl.color,
            count: 0,
            points: 0,
          };
          existing.count += 1;
          existing.points += issue.estimate ?? 0;
          labelMap.set(lbl.id, existing);
        }
      }
    }

    const projectMap = new Map<
      string,
      { id: string; name: string; key: string; color: string; count: number; points: number }
    >();
    for (const issue of issues) {
      const existing = projectMap.get(issue.project.id) ?? {
        id: issue.project.id,
        name: issue.project.name,
        key: issue.project.key,
        color: issue.project.color,
        count: 0,
        points: 0,
      };
      existing.count += 1;
      existing.points += issue.estimate ?? 0;
      projectMap.set(issue.project.id, existing);
    }

    return {
      assignees: Array.from(assigneeMap.values()).sort(
        (a, b) => b.points - a.points || b.count - a.count
      ),
      labels: Array.from(labelMap.values()).sort(
        (a, b) => b.points - a.points || b.count - a.count
      ),
      projects: Array.from(projectMap.values()).sort(
        (a, b) => b.points - a.points || b.count - a.count
      ),
    };
  }, [issues]);

  return (
    <aside className="w-[300px] shrink-0 border-l border-[#1c1c24] bg-[#0f0f12] p-2.5 overflow-y-auto hidden lg:flex flex-col gap-2.5">
      {/* Top Info Card (Linear Inspector style) */}
      <div className="rounded-xl bg-[#141419] border border-[#202029] p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutGrid aria-hidden="true" className="w-4 h-4 text-zinc-400 shrink-0" />
            <h2 className="text-[13px] font-semibold text-zinc-100 truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onEditView && (
              <button
                type="button"
                onClick={onEditView}
                aria-label="Edit konfigurasi view"
                title="Edit View"
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1e1e27]"
              >
                <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup panel Inspector"
                title="Tutup Inspector"
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1e1e27]"
              >
                <X aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {description && (
          <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
        )}

        <div className="pt-2 border-t border-[#202029] space-y-2.5 text-xs">
          <div className="grid grid-cols-3 items-center gap-2">
            <span className="text-zinc-500">Visibility</span>
            <span className="col-span-2 flex items-center gap-1.5 text-zinc-200 truncate">
              <Building2 aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{data?.workspace.name ?? "Workspace"}</span>
            </span>
          </div>

          {owner && (
            <div className="grid grid-cols-3 items-center gap-2">
              <span className="text-zinc-500">Owner</span>
              <span className="col-span-2 flex items-center gap-1.5 text-zinc-200 truncate">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: owner.avatarColor }}
                >
                  {getInitials(owner.name)}
                </span>
                <span className="truncate">{owner.name}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Card with Segmented Pill Tabs */}
      <div className="rounded-xl bg-[#141419] border border-[#202029] p-3 flex-1 flex flex-col">
        <div
          role="tablist"
          aria-label="Rekapitulasi tiket"
          className="grid grid-cols-3 p-0.5 rounded-lg bg-[#0d0d11] border border-[#1e1e26] text-[11px] mb-3"
        >
          {(["assignees", "labels", "projects"] as TabKey[]).map((key) => {
            const active = tab === key;
            const label =
              key === "assignees" ? "Assignees" : key === "labels" ? "Labels" : "Projects";
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={`py-1.5 rounded-md font-medium transition ${
                  active
                    ? "bg-[#22222c] text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 flex-1">
          {tab === "assignees" &&
            summary.assignees.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-[#1a1a22] text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.id === "unassigned" ? "?" : getInitials(item.name)}
                  </span>
                  <span className="text-zinc-200 truncate">{item.name}</span>
                </div>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-zinc-400 shrink-0">
                  <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-500" />
                  {item.points}
                </span>
              </div>
            ))}

          {tab === "labels" &&
            summary.labels.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-[#1a1a22] text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-zinc-200 truncate">{item.name}</span>
                </div>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-zinc-400 shrink-0">
                  <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-500" />
                  {item.points}
                </span>
              </div>
            ))}

          {tab === "projects" &&
            summary.projects.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-[#1a1a22] text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-zinc-200 truncate">{item.name}</span>
                </div>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-zinc-400 shrink-0">
                  <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-500" />
                  {item.points}
                </span>
              </div>
            ))}

          {issues.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-6">
              Belum ada tiket pada filter ini.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
