"use client";

import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { IssuesWorkspace } from "@/components/IssuesWorkspace";

export default function SavedViewPage() {
  const params = useParams();
  const id = String(params.id);
  const { data, loading } = useWorkspace();

  if (loading || !data) {
    return <div className="p-6 text-xs text-zinc-500">Memuat Saved View...</div>;
  }

  const view = data.savedViews.find((v) => v.id === id);
  if (!view) {
    return (
      <div className="p-8 text-sm text-zinc-400">
        Saved View tidak ditemukan atau Anda tidak memiliki akses.
      </div>
    );
  }

  return (
    <IssuesWorkspace
      key={view.id}
      title={view.name}
      description={view.description}
      savedView={view}
      initialFilters={view.filters}
      defaultInspectorOpen={true}
    />
  );
}
