"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Kanban, Repeat, Bookmark, Settings, ArrowRight } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import type { IssueDTO } from "@/lib/types";

interface CommandPaletteProps {
  onClose: () => void;
  onQuickCreate: () => void;
}

export function CommandPalette({ onClose, onQuickCreate }: CommandPaletteProps) {
  const router = useRouter();
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<IssueDTO[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = query.trim()
          ? `/api/internal/issues?search=${encodeURIComponent(query.trim())}`
          : `/api/internal/issues`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          setIssues((json.issues || []).slice(0, 8));
        }
      } catch {
        // ignore abort
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-1 border border-border-default rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3.5 py-2.5 border-b border-border-subtle flex items-center gap-2.5">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari tiket (misal: SDG-1), saved view, atau perintah..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-zinc-400 font-mono">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          <div>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Actions
            </p>
            <button
              onClick={onQuickCreate}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-zinc-200 hover:bg-surface-3 transition"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Buat Tiket Baru (Quick Create)
              </span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-zinc-400 font-mono">C</kbd>
            </button>
            <button
              onClick={() => navigate("/board")}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:bg-surface-3 transition"
            >
              <Kanban className="w-3.5 h-3.5 text-zinc-400" />
              Buka Kanban Board & List View
            </button>
            <button
              onClick={() => navigate("/cycles")}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:bg-surface-3 transition"
            >
              <Repeat className="w-3.5 h-3.5 text-emerald-400" />
              Buka Cycles (Sprints)
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:bg-surface-3 transition"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              Workspace Settings (API Keys, Webhooks, Workflow)
            </button>
          </div>

          {/* Saved Views */}
          {data && data.savedViews.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Saved Views
              </p>
              {data.savedViews.map((v) => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/views/${v.id}`)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-zinc-300 hover:bg-surface-3 transition"
                >
                  <span className="flex items-center gap-2">
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    {v.name}
                  </span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
              ))}
            </div>
          )}

          {/* Matching Issues */}
          <div>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Issues ({issues.length})
            </p>
            {issues.map((issue) => (
              <button
                key={issue.id}
                onClick={() => navigate(`/issues/${issue.identifier}`)}
                className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-xs hover:bg-surface-3 transition text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-zinc-400 shrink-0">{issue.identifier}</span>
                  <span className="text-zinc-200 truncate">{issue.title}</span>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: `${issue.status.color}20`,
                    color: issue.status.color,
                  }}
                >
                  {issue.status.name}
                </span>
              </button>
            ))}
            {issues.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-zinc-500 text-center">Tidak ada tiket yang cocok</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
