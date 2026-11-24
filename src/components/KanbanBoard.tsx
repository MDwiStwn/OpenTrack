"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, ChevronDown, ChevronRight, Triangle } from "lucide-react";
import {
  PRIORITIES,
  getInitials,
  type IssueDTO,
  type PriorityValue,
  type StatusDTO,
} from "@/lib/types";
import type { MemberDTO } from "./WorkspaceProvider";
import { DraggableIssueCard, IssueCardContent, PriorityIcon } from "./IssueCard";

export type SwimlaneMode = "none" | "priority" | "assignee";

interface KanbanBoardProps {
  issues: IssueDTO[];
  statuses: StatusDTO[];
  members: MemberDTO[];
  swimlane: SwimlaneMode;
  issueLinkQuery?: string;
  onMoveIssue: (
    issue: IssueDTO,
    patch: { statusId?: string; priority?: PriorityValue; assigneeId?: string | null }
  ) => void;
  onQuickCreateInStatus: (statusId: string) => void;
}

function DroppableCell({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${
        isOver ? "bg-[#5e6ad2]/10 ring-1 ring-inset ring-[#5e6ad2]/40" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function KanbanBoard({
  issues,
  statuses,
  members,
  swimlane,
  issueLinkQuery = "",
  onMoveIssue,
  onQuickCreateInStatus,
}: KanbanBoardProps) {
  const [activeIssue, setActiveIssue] = useState<IssueDTO | null>(null);
  const [collapsedRows, setCollapsedRows] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  };

  function toggleRow(key: string) {
    setCollapsedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const statusStats = useMemo(() => {
    const map: Record<string, { count: number; points: number }> = {};
    for (const s of statuses) map[s.id] = { count: 0, points: 0 };
    for (const issue of issues) {
      if (!map[issue.statusId]) map[issue.statusId] = { count: 0, points: 0 };
      map[issue.statusId].count += 1;
      map[issue.statusId].points += issue.estimate ?? 0;
    }
    return map;
  }, [issues, statuses]);

  const swimlaneRows = useMemo(() => {
    if (swimlane === "none") {
      return [{ key: "all", label: "All Issues", type: "none" as const }];
    }
    if (swimlane === "priority") {
      return PRIORITIES.map((p) => ({
        key: p.value,
        label: p.label,
        type: "priority" as const,
        priority: p.value,
      }));
    }
    return [
      ...members.map((m) => ({
        key: m.id,
        label: m.name,
        type: "assignee" as const,
        avatarColor: m.avatarColor,
      })),
      { key: "unassigned", label: "Unassigned", type: "assignee" as const, avatarColor: "#52525b" },
    ];
  }, [swimlane, members]);

  function handleDragStart(event: DragStartEvent) {
    const issue = event.active.data.current?.issue as IssueDTO | undefined;
    if (issue) setActiveIssue(issue);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const issue = active.data.current?.issue as IssueDTO | undefined;
    if (!issue) return;

    const droppableId = String(over.id);
    const [targetStatusId, targetSwimlaneKey] = droppableId.split("::");
    if (!targetStatusId) return;

    const patch: { statusId?: string; priority?: PriorityValue; assigneeId?: string | null } = {};
    let changed = false;

    if (targetStatusId !== issue.statusId) {
      patch.statusId = targetStatusId;
      changed = true;
    }

    if (swimlane === "priority" && targetSwimlaneKey && targetSwimlaneKey !== issue.priority) {
      patch.priority = targetSwimlaneKey as PriorityValue;
      changed = true;
    }

    if (swimlane === "assignee" && targetSwimlaneKey) {
      const nextAssignee = targetSwimlaneKey === "unassigned" ? null : targetSwimlaneKey;
      if (nextAssignee !== issue.assigneeId) {
        patch.assigneeId = nextAssignee;
        changed = true;
      }
    }

    if (changed) {
      onMoveIssue(issue, patch);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="inline-flex flex-col min-w-full">
          {/* Flat Linear Column Headers */}
          <div className="flex sticky top-0 z-10 bg-[#0f0f12] border-b border-[#1c1c24]">
            {statuses.map((status) => {
              const stat = statusStats[status.id] ?? { count: 0, points: 0 };
              return (
                <div
                  key={status.id}
                  className="w-[276px] shrink-0 h-10 px-3 flex items-center justify-between border-r border-[#181820]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
                      style={{ borderColor: status.color }}
                    />
                    <span className="text-xs font-medium text-zinc-200 truncate">
                      {status.name}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-zinc-500">
                      {stat.count}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickCreateInStatus(status.id)}
                    aria-label={`Tambah tiket ke ${status.name}`}
                    title={`Tambah tiket ke ${status.name}`}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1b1b23] transition"
                  >
                    <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Swimlane Rows */}
          <div>
            {swimlaneRows.map((row) => {
              const rowIssues = issues.filter((i) => {
                if (swimlane === "none") return true;
                if (swimlane === "priority") return i.priority === row.key;
                if (swimlane === "assignee") {
                  return row.key === "unassigned" ? i.assigneeId === null : i.assigneeId === row.key;
                }
                return true;
              });

              const rowPoints = rowIssues.reduce((sum, i) => sum + (i.estimate ?? 0), 0);
              const isCollapsed = Boolean(collapsedRows[row.key]);

              return (
                <div key={row.key} className="border-b border-[#181820]">
                  {swimlane !== "none" && (
                    <button
                      type="button"
                      onClick={() => toggleRow(row.key)}
                      aria-expanded={!isCollapsed}
                      className="w-full h-9 px-3 bg-[#131318] hover:bg-[#17171e] border-b border-[#1c1c24] flex items-center gap-2 text-left transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      {row.type === "priority" && (
                        <PriorityIcon priority={row.priority} className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {row.type === "assignee" && (
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: row.avatarColor }}
                        >
                          {row.key === "unassigned" ? "?" : getInitials(row.label)}
                        </span>
                      )}
                      <span className="text-xs font-medium text-zinc-200">{row.label}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-zinc-500 ml-1">
                        <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-600" />
                        {rowPoints}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-zinc-600">
                        ({rowIssues.length})
                      </span>
                    </button>
                  )}

                  {!isCollapsed && (
                    <div className="flex">
                      {statuses.map((status) => {
                        const cellIssues = rowIssues.filter((i) => i.statusId === status.id);
                        const cellId = `${status.id}::${row.key}`;

                        return (
                          <DroppableCell
                            key={cellId}
                            id={cellId}
                            className={`w-[276px] shrink-0 p-2.5 border-r border-[#181820] flex flex-col gap-2 ${
                              swimlane === "none" ? "min-h-[calc(100vh-140px)]" : "min-h-[148px]"
                            }`}
                          >
                            {cellIssues.map((issue) => (
                              <DraggableIssueCard
                                key={issue.id}
                                issue={issue}
                                issueLinkQuery={issueLinkQuery}
                              />
                            ))}
                          </DroppableCell>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeIssue ? (
          <div className="w-[260px]">
            <IssueCardContent issue={activeIssue} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
