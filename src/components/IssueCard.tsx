"use client";

import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  MessageSquare,
  GitBranch,
  AlertCircle,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Minus,
  Triangle,
} from "lucide-react";
import { getInitials, PRIORITY_MAP, type IssueDTO, type PriorityValue } from "@/lib/types";

export function PriorityIcon({
  priority,
  className = "w-3.5 h-3.5",
}: {
  priority: PriorityValue;
  className?: string;
}) {
  switch (priority) {
    case "URGENT":
      return <AlertCircle aria-hidden="true" className={`${className} text-red-400`} />;
    case "HIGH":
      return <SignalHigh aria-hidden="true" className={`${className} text-orange-400`} />;
    case "MEDIUM":
      return <SignalMedium aria-hidden="true" className={`${className} text-amber-400`} />;
    case "LOW":
      return <SignalLow aria-hidden="true" className={`${className} text-zinc-400`} />;
    default:
      return <Minus aria-hidden="true" className={`${className} text-zinc-600`} />;
  }
}

export function IssueCardContent({
  issue,
  isDragging,
  onOpen,
}: {
  issue: IssueDTO;
  isDragging?: boolean;
  onOpen?: () => void;
}) {
  const prio = PRIORITY_MAP[issue.priority];

  return (
    <div
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={`group rounded-lg bg-[#141419] border border-[#202028] hover:border-[#2f2f3c] hover:bg-[#17171e] p-3 transition-colors select-none cursor-pointer ${
        isDragging ? "shadow-xl ring-1 ring-[#5e6ad2]/70 bg-[#1a1a22]" : ""
      }`}
    >
      {/* Top row: identifier + assignee avatar */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
          {issue.identifier}
        </span>

        {issue.assignee ? (
          <div
            title={issue.assignee.name}
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
            style={{ backgroundColor: issue.assignee.avatarColor }}
          >
            {getInitials(issue.assignee.name)}
          </div>
        ) : (
          <div
            title="Unassigned"
            className="w-[18px] h-[18px] rounded-full border border-dashed border-zinc-700 flex items-center justify-center text-[8px] text-zinc-600"
          >
            ?
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white leading-snug line-clamp-2 mb-2.5 transition-colors">
        {issue.title}
      </p>

      {/* Bottom metadata row: priority + estimate + labels + counts */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          title={prio.label}
          className="inline-flex items-center justify-center w-5 h-5 rounded border border-[#252530] bg-[#101014]"
        >
          <PriorityIcon priority={issue.priority} className="w-3 h-3" />
        </span>

        {issue.estimate !== null && (
          <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded border border-[#252530] bg-[#101014] text-[10px] font-mono tabular-nums text-zinc-400">
            <Triangle aria-hidden="true" className="w-2.5 h-2.5 text-zinc-500" />
            {issue.estimate}
          </span>
        )}

        {issue.labels.slice(0, 2).map((lbl) => (
          <span
            key={lbl.id}
            className="inline-flex items-center gap-1 px-1.5 h-5 rounded border border-[#252530] bg-[#101014] text-[10px] text-zinc-400"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lbl.color }} />
            <span className="truncate max-w-[90px]">{lbl.name}</span>
          </span>
        ))}

        {(issue.subIssueCount > 0 || issue.commentCount > 0) && (
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-500">
            {issue.subIssueCount > 0 && (
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                <GitBranch aria-hidden="true" className="w-3 h-3" />
                {issue.subIssueCount}
              </span>
            )}
            {issue.commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                <MessageSquare aria-hidden="true" className="w-3 h-3" />
                {issue.commentCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DraggableIssueCard({
  issue,
  issueLinkQuery = "",
}: {
  issue: IssueDTO;
  issueLinkQuery?: string;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  function handleOpen() {
    if (isDragging) return;
    router.push(`/issues/${encodeURIComponent(issue.identifier)}${issueLinkQuery}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-pointer active:cursor-grabbing touch-none ${isDragging ? "opacity-30" : ""}`}
    >
      <IssueCardContent issue={issue} onOpen={handleOpen} />
    </div>
  );
}
