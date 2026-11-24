"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Plus, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ViewEditorModal } from "@/components/ViewEditorModal";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SavedViewDTO } from "@/lib/types";

export default function AllViewsPage() {
  const router = useRouter();
  const { data, refresh, showToast } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingView, setEditingView] = useState<SavedViewDTO | null>(null);

  async function handleDelete(view: SavedViewDTO) {
    if (!confirm(`Hapus View "${view.name}"?`)) return;
    const res = await fetch(`/api/internal/views?id=${view.id}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
      showToast(`View "${view.name}" dihapus`);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <header className="h-11 px-4 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bookmark aria-hidden="true" className="w-4 h-4 text-muted-foreground shrink-0" />
          <h1 className="text-[13px] font-semibold tracking-tight text-foreground truncate">
            Custom &amp; Saved Views
          </h1>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditingView(null);
            setModalOpen(true);
          }}
        >
          <Plus aria-hidden="true" className="w-3.5 h-3.5" />
          Tambah View
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          Buat papan tampilan khusus per divisi atau alur kerja (misal:{" "}
          <strong className="text-foreground">Mobile Development</strong>,{" "}
          <strong className="text-foreground">QC Mobile</strong>,{" "}
          <strong className="text-foreground">Web Development &amp; API</strong>,{" "}
          <strong className="text-foreground">QC Web &amp; API</strong>) lengkap dengan Inspector Sidebar otomatis.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {data?.savedViews.map((view) => {
            const projBadges = (view.filters?.projectIds ?? [])
              .map((pid) => data.projects.find((p) => p.id === pid))
              .filter(Boolean);
            const statusBadges = (view.filters?.statusIds ?? [])
              .map((sid) => data.statuses.find((s) => s.id === sid))
              .filter(Boolean);

            return (
              <SpotlightCard
                key={view.id}
                onClick={() => router.push(`/views/${view.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/views/${view.id}`);
                  }
                }}
                className="p-4 flex flex-col justify-between gap-3 cursor-pointer hover:border-foreground/25 transition-colors shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2 min-w-0">
                      <Bookmark aria-hidden="true" className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{view.name}</span>
                    </span>
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditingView(view);
                          setModalOpen(true);
                        }}
                        aria-label={`Edit view ${view.name}`}
                        title="Edit View"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(view)}
                        aria-label={`Hapus view ${view.name}`}
                        title="Hapus View"
                        className="text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {view.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{view.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {projBadges.map((p) => (
                      <Badge key={p!.id} variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                        {p!.key}
                      </Badge>
                    ))}
                    {statusBadges.map((s) => (
                      <span
                        key={s!.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: `${s!.color}20`, color: s!.color }}
                      >
                        {s!.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">Owner: {view.owner.name}</span>
                  <Link
                    href={`/views/${view.id}`}
                    className="inline-flex items-center gap-1 text-foreground hover:underline font-medium shrink-0"
                  >
                    Buka View <ArrowRight aria-hidden="true" className="w-3 h-3" />
                  </Link>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <ViewEditorModal
          existingView={editingView}
          onClose={() => setModalOpen(false)}
          onSaved={async (saved) => {
            setModalOpen(false);
            await refresh();
            showToast(`View "${saved.name}" berhasil disimpan`);
            if (!editingView) {
              router.push(`/views/${saved.id}`);
            }
          }}
        />
      )}
    </div>
  );
}
