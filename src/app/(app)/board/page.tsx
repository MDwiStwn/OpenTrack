"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { IssuesWorkspace } from "@/components/IssuesWorkspace";

function BoardInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const cycleId = searchParams.get("cycleId") || undefined;
  const assigneeId = searchParams.get("assigneeId") || undefined;

  const title = assigneeId ? "My Issues" : "Issues";

  return (
    <IssuesWorkspace
      key={`${projectId ?? "all"}-${cycleId ?? "all"}-${assigneeId ?? "all"}`}
      title={title}
      defaultViewMode="list"
      description="Daftar dan papan kerja tiket aktif, backlog, dan seluruh sprint."
      initialFilters={{
        projectIds: projectId ? [projectId] : undefined,
        cycleId: cycleId ?? undefined,
        assigneeIds: assigneeId ? [assigneeId] : undefined,
      }}
    />
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-500">Memuat papan kerja...</div>}>
      <BoardInner />
    </Suspense>
  );
}
