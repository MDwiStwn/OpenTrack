"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type {
  CycleDTO,
  LabelDTO,
  ProjectDTO,
  SavedViewDTO,
  StatusDTO,
  UserRef,
} from "@/lib/types";
import { QuickCreateModal } from "./QuickCreateModal";
import { CommandPalette } from "./CommandPalette";
import { NotFoundView } from "./reactbits/NotFoundView";

export type WorkspaceRoleValue = "OWNER" | "ADMIN" | "MEMBER";

export interface MemberDTO extends UserRef {
  membershipId: string;
  role: WorkspaceRoleValue;
  joinedAt: string;
}

export interface WorkspaceSummaryDTO {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRoleValue;
}

export interface WorkspaceTemplateDTO {
  id: string;
  name: string;
  description: string;
  content: string;
  isDefault: boolean;
}

export interface BootstrapData {
  user: UserRef;
  workspace: { id: string; name: string; slug: string; issuePrefix: string };
  role: WorkspaceRoleValue;
  unreadNotificationCount?: number;
  templates?: WorkspaceTemplateDTO[];
  workspaces: WorkspaceSummaryDTO[];
  projects: ProjectDTO[];
  statuses: StatusDTO[];
  labels: LabelDTO[];
  cycles: CycleDTO[];
  members: MemberDTO[];
  savedViews: SavedViewDTO[];
}

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
  href?: string;
  hrefLabel?: string;
}

interface WorkspaceContextValue {
  data: BootstrapData | null;
  loading: boolean;
  refresh: () => Promise<void>;
  openCreateModal: (defaults?: { statusId?: string; projectId?: string; cycleId?: string; parentId?: string }) => void;
  openCommandPalette: () => void;
  issueVersion: number;
  bumpIssueVersion: () => void;
  showToast: (message: string, opts?: { type?: "success" | "error"; href?: string; hrefLabel?: string }) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverDisconnected, setServerDisconnected] = useState(false);
  const [issueVersion, setIssueVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    statusId?: string;
    projectId?: string;
    cycleId?: string;
    parentId?: string;
  }>({});
  const [cmdOpen, setCmdOpen] = useState(false);
  const [toast, setToast] = useState<ToastItem | null>(null);

  const showToast = useCallback(
    (message: string, opts?: { type?: "success" | "error"; href?: string; hrefLabel?: string }) => {
      const id = Date.now();
      setToast({
        id,
        message,
        type: opts?.type ?? "success",
        href: opts?.href,
        hrefLabel: opts?.hrefLabel,
      });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 5000);
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/bootstrap", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setServerDisconnected(false);
      } else if (res.status >= 500) {
        setServerDisconnected(true);
      }
    } catch {
      setServerDisconnected(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOffline = () => setServerDisconnected(true);
    const handleOnline = () => {
      setServerDisconnected(false);
      void refresh();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refresh]);

  const bumpIssueVersion = useCallback(() => {
    setIssueVersion((v) => v + 1);
  }, []);

  const openCreateModal = useCallback(
    (defaults?: { statusId?: string; projectId?: string; cycleId?: string; parentId?: string }) => {
      setCreateDefaults(defaults ?? {});
      setCreateOpen(true);
    },
    []
  );

  const openCommandPalette = useCallback(() => {
    setCmdOpen(true);
  }, []);

  // Global keyboard shortcuts: Ctrl+K / Cmd+K and 'C' for quick create
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (!isEditable && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setCreateDefaults({});
        setCreateOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (serverDisconnected) {
    return <NotFoundView mode="disconnected" onRetry={() => void refresh()} />;
  }

  return (
    <WorkspaceContext.Provider
      value={{
        data,
        loading,
        refresh,
        openCreateModal,
        openCommandPalette,
        issueVersion,
        bumpIssueVersion,
        showToast,
      }}
    >
      {children}

      {createOpen && data && (
        <QuickCreateModal
          defaults={createDefaults}
          onClose={() => setCreateOpen(false)}
          onCreated={(createdIssue) => {
            setCreateOpen(false);
            bumpIssueVersion();
            void refresh();
            showToast(`Tiket ${createdIssue.identifier} berhasil dibuat`, {
              type: "success",
              href: `/issues/${createdIssue.identifier}`,
              hrefLabel: "Buka Tiket →",
            });
          }}
        />
      )}

      {cmdOpen && data && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onQuickCreate={() => {
            setCmdOpen(false);
            openCreateModal();
          }}
        />
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border-strong shadow-2xl text-xs text-zinc-100">
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          {toast.href && (
            <Link
              href={toast.href}
              onClick={() => setToast(null)}
              className="ml-1 font-medium text-indigo-400 hover:text-indigo-300 underline"
            >
              {toast.hrefLabel ?? "Lihat"}
            </Link>
          )}
          <button onClick={() => setToast(null)} className="text-zinc-500 hover:text-zinc-200 ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
