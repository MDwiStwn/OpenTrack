"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat, Triangle, CheckCircle2 } from "lucide-react";
import {
  ESTIMATE_OPTIONS,
  PRIORITIES,
  getInitials,
  type IssueDTO,
  type PriorityValue,
  type StatusDTO,
} from "@/lib/types";
import type { MemberDTO } from "./WorkspaceProvider";
import { PriorityIcon } from "./IssueCard";

interface ListViewProps {
  issues: IssueDTO[];
  statuses: StatusDTO[];
  members: MemberDTO[];
  groupBy: "status" | "priority";
  issueLinkQuery?: string;
  onUpdateIssue: (
    issue: IssueDTO,
    patch: {
      statusId?: string;
      priority?: PriorityValue;
      assigneeId?: string | null;
      estimate?: number | null;
    }
  ) => void;
  onQuickCreateInStatus?: (statusId: string) => void;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function StatusGlyph({ status }: { status: StatusDTO }) {
  if (status.category === "COMPLETED") {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: status.color }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="w-3 h-3 rounded-full border-2 shrink-0 inline-block"
      style={{ borderColor: status.color }}
    />
  );
}

export function ListView({
  issues,
  statuses,
  members,
  groupBy,
  issueLinkQuery = "",
  onUpdateIssue,
  onQuickCreateInStatus,
}: ListViewProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<{
    issueId: string;
    field: "status" | "priority" | "estimate" | "assignee";
  } | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    function close() {
      setOpenMenu(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenu]);

  const groups = useMemo(() => {
    if (groupBy === "priority") {
      return PRIORITIES.map((p) => {
        const items = issues.filter((i) => i.priority === p.value);
        return {
          key: p.value,
          title: p.label,
          color: p.color,
          status: null as StatusDTO | null,
          items,
          points: items.reduce((s, i) => s + (i.estimate ?? 0), 0),
        };
      }).filter((g) => g.items.length > 0);
    }

    return statuses
      .map((s) => {
        const items = issues.filter((i) => i.statusId === s.id);
        return {
          key: s.id,
          title: s.name,
          color: s.color,
          status: s,
          items,
          points: items.reduce((sum, i) => sum + (i.estimate ?? 0), 0),
        };
      })
      .filter((g) => g.items.length > 0);
  }, [issues, statuses, groupBy]);

  if (issues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-zinc-500 py-16">
        <p>Tidak ada tiket yang cocok dengan filter saat ini.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f0f12]">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Flat Linear Group Header */}
          <div className="h-9 px-4 bg-[#141419] border-y border-[#1e1e26] flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              {group.status ? (
                <StatusGlyph status={group.status} />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              )}
              <span className="text-xs font-medium text-zinc-200">{group.title}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-zinc-500 ml-1">
                <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-600" />
                {group.points}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-zinc-600">
                ({group.items.length})
              </span>
            </div>

            {group.status && onQuickCreateInStatus && (
              <button
                type="button"
                onClick={() => onQuickCreateInStatus(group.status!.id)}
                aria-label={`Tambah tiket ke ${group.title}`}
                title={`Tambah tiket ke ${group.title}`}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1e1e27] transition"
              >
                <Plus aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Flat Linear Issue Rows */}
          <div className="divide-y divide-[#181820]">
            {group.items.map((issue) => (
              <div
                key={issue.id}
                onClick={() =>
                  router.push(`/issues/${encodeURIComponent(issue.identifier)}${issueLinkQuery}`)
                }
                className="group relative h-11 px-4 hover:bg-[#15151c] flex items-center gap-2.5 text-xs transition-colors cursor-pointer"
              >
                {/* 1. Priority Icon (clickable popover) */}
                <div
                  className="relative shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(
                      openMenu?.issueId === issue.id && openMenu.field === "priority"
                        ? null
                        : { issueId: issue.id, field: "priority" }
                    );
                  }}
                >
                  <button
                    type="button"
                    aria-label="Ubah prioritas"
                    className="p-1 rounded hover:bg-[#22222c] flex items-center justify-center"
                  >
                    <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
                  </button>
                  {openMenu?.issueId === issue.id && openMenu.field === "priority" && (
                    <div className="absolute left-0 top-7 z-30 w-36 rounded-lg bg-[#16161d] border border-[#2a2a38] shadow-2xl py-1">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            onUpdateIssue(issue, { priority: p.value });
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#22222e] flex items-center gap-2"
                        >
                          <PriorityIcon priority={p.value} className="w-3.5 h-3.5" />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Identifier */}
                <span className="font-mono text-[11px] text-zinc-500 tabular-nums w-16 shrink-0">
                  {issue.identifier}
                </span>

                {/* 3. Status Ring (clickable popover) */}
                <div
                  className="relative shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(
                      openMenu?.issueId === issue.id && openMenu.field === "status"
                        ? null
                        : { issueId: issue.id, field: "status" }
                    );
                  }}
                >
                  <button
                    type="button"
                    aria-label="Ubah status"
                    className="p-1 rounded hover:bg-[#22222c] flex items-center justify-center"
                  >
                    <StatusGlyph status={issue.status} />
                  </button>
                  {openMenu?.issueId === issue.id && openMenu.field === "status" && (
                    <div className="absolute left-0 top-7 z-30 w-44 rounded-lg bg-[#16161d] border border-[#2a2a38] shadow-2xl py-1">
                      {statuses.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            onUpdateIssue(issue, { statusId: s.id });
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#22222e] flex items-center gap-2"
                        >
                          <StatusGlyph status={s} />
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Title */}
                <span className="flex-1 min-w-0 text-[13px] font-medium text-zinc-200 group-hover:text-white truncate">
                  {issue.title}
                </span>

                {/* Right Metadata Pills (1:1 Linear style) */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  {/* Labels */}
                  {issue.labels.slice(0, 2).map((lbl) => (
                    <span
                      key={lbl.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#14141a] border border-[#23232e] text-[11px] text-zinc-300"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: lbl.color }}
                      />
                      <span className="truncate max-w-[90px]">{lbl.name}</span>
                    </span>
                  ))}

                  {/* Project Pill */}
                  <span className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#14141a] border border-[#23232e] text-[11px] text-zinc-400">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: issue.project.color }}
                    />
                    <span className="truncate max-w-[110px]">{issue.project.name}</span>
                  </span>

                  {/* Cycle Pill */}
                  {issue.cycle && (
                    <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#14141a] border border-[#23232e] text-[11px] text-zinc-400">
                      <Repeat aria-hidden="true" className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                      <span className="truncate max-w-[110px]">{issue.cycle.name}</span>
                    </span>
                  )}
                </div>

                {/* Estimate (clickable) */}
                <div
                  className="relative shrink-0 w-10 flex justify-end"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(
                      openMenu?.issueId === issue.id && openMenu.field === "estimate"
                        ? null
                        : { issueId: issue.id, field: "estimate" }
                    );
                  }}
                >
                  <button
                    type="button"
                    aria-label="Ubah estimate point"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#22222c] font-mono tabular-nums text-[11px] text-zinc-400"
                  >
                    <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-500" />
                    {issue.estimate ?? "-"}
                  </button>
                  {openMenu?.issueId === issue.id && openMenu.field === "estimate" && (
                    <div className="absolute right-0 top-7 z-30 w-24 rounded-lg bg-[#16161d] border border-[#2a2a38] shadow-2xl py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onUpdateIssue(issue, { estimate: null });
                        }}
                        className="w-full px-2.5 py-1 text-left text-xs text-zinc-400 hover:bg-[#22222e]"
                      >
                        None
                      </button>
                      {ESTIMATE_OPTIONS.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            onUpdateIssue(issue, { estimate: pt });
                          }}
                          className="w-full px-2.5 py-1 text-left text-xs font-mono text-zinc-200 hover:bg-[#22222e]"
                        >
                          {pt} pts
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assignee Avatar (clickable) */}
                <div
                  className="relative shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(
                      openMenu?.issueId === issue.id && openMenu.field === "assignee"
                        ? null
                        : { issueId: issue.id, field: "assignee" }
                    );
                  }}
                >
                  <button
                    type="button"
                    aria-label={issue.assignee ? `Assignee: ${issue.assignee.name}` : "Assign tiket"}
                    title={issue.assignee ? issue.assignee.name : "Unassigned"}
                    className="rounded-full p-0.5 hover:ring-2 hover:ring-[#3a3a4a]"
                  >
                    {issue.assignee ? (
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white"
                        style={{ backgroundColor: issue.assignee.avatarColor }}
                      >
                        {getInitials(issue.assignee.name)}
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-dashed border-zinc-600 flex items-center justify-center text-[9px] text-zinc-500">
                        ?
                      </span>
                    )}
                  </button>
                  {openMenu?.issueId === issue.id && openMenu.field === "assignee" && (
                    <div className="absolute right-0 top-7 z-30 w-44 rounded-lg bg-[#16161d] border border-[#2a2a38] shadow-2xl py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onUpdateIssue(issue, { assigneeId: null });
                        }}
                        className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-400 hover:bg-[#22222e]"
                      >
                        Unassigned
                      </button>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setOpenMenu(null);
                            onUpdateIssue(issue, { assigneeId: m.id });
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#22222e] flex items-center gap-2"
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                            style={{ backgroundColor: m.avatarColor }}
                          >
                            {getInitials(m.name)}
                          </span>
                          <span className="truncate">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Short Date */}
                <span className="hidden sm:inline-block text-[11px] font-mono tabular-nums text-zinc-500 w-12 text-right shrink-0">
                  {formatShortDate(issue.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
