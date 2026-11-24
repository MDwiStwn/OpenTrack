"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Inbox, CheckCheck, Trash2, CheckCircle2, AtSign, MessageSquare } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { PriorityIcon } from "@/components/IssueCard";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials, type PriorityValue } from "@/lib/types";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string; avatarColor: string } | null;
  issue: {
    id: string;
    identifier: string;
    title: string;
    priority: PriorityValue;
    status: { id: string; name: string; color: string; category: string };
  } | null;
}

function formatRelativeShort(iso: string): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
}

export default function InboxPage() {
  const router = useRouter();
  const { refresh, showToast } = useWorkspace();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const url = filter === "unread" ? "/api/internal/notifications?unread=true" : "/api/internal/notifications";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setItems(json.notifications ?? []);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function handleOpenNotification(n: NotificationItem) {
    if (!n.readAt) {
      await fetch("/api/internal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      await refresh();
    }
    if (n.issue) {
      router.push(
        `/issues/${encodeURIComponent(n.issue.identifier)}?fromPath=%2Finbox&fromLabel=Inbox`
      );
    }
  }

  async function handleMarkAllRead() {
    const res = await fetch("/api/internal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (res.ok) {
      await Promise.all([loadNotifications(), refresh()]);
      showToast("Semua notifikasi ditandai sudah dibaca");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/internal/notifications?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await Promise.all([loadNotifications(), refresh()]);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <header className="h-11 px-4 sm:px-6 border-b border-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox aria-hidden="true" className="w-4 h-4 text-muted-foreground shrink-0" />
          <h1 className="text-[13px] font-semibold tracking-tight text-foreground">Inbox</h1>
          {unreadCount > 0 && (
            <Badge variant="default" className="font-mono tabular-nums text-[10px]">
              {unreadCount} belum dibaca
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <TabsList className="h-7">
            <TabsTrigger active={filter === "all"} onClick={() => setFilter("all")} className="px-2.5 py-0.5 text-[11px]">
              Semua
            </TabsTrigger>
            <TabsTrigger active={filter === "unread"} onClick={() => setFilter("unread")} className="px-2.5 py-0.5 text-[11px]">
              Belum dibaca
            </TabsTrigger>
          </TabsList>

          {unreadCount > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck aria-hidden="true" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tandai semua dibaca</span>
            </Button>
          )}
        </div>
      </header>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/70">
        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 sm:p-10 flex items-center justify-center">
            <SpotlightCard className="p-8 text-center max-w-md w-full shadow-sm">
              <Inbox aria-hidden="true" className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Inbox kosong</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Notifikasi akan muncul di sini saat anggota lain menyebut Anda dengan{" "}
                <code className="px-1 py-0.5 rounded bg-secondary text-foreground">@nama</code> di komentar tiket.
              </p>
            </SpotlightCard>
          </div>
        ) : (
          items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void handleOpenNotification(n);
                  }
                }}
                className={`group px-4 sm:px-6 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isUnread
                    ? "bg-secondary/35 hover:bg-secondary/60"
                    : "bg-transparent hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Unread indicator dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isUnread ? "bg-foreground" : "bg-transparent"
                    }`}
                  />

                  {/* Actor Avatar + small icon badge */}
                  <div className="relative shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                      style={{ backgroundColor: n.actor?.avatarColor ?? "#52525b" }}
                    >
                      {n.actor ? getInitials(n.actor.name) : "?"}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center">
                      {n.type === "MENTION" ? (
                        <AtSign aria-hidden="true" className="w-2.5 h-2.5 text-foreground" />
                      ) : (
                        <MessageSquare aria-hidden="true" className="w-2.5 h-2.5 text-muted-foreground" />
                      )}
                    </span>
                  </div>

                  {/* Text content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {n.issue && (
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          {n.issue.identifier}
                        </span>
                      )}
                      <p
                        className={`text-[13px] truncate ${
                          isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                        }`}
                      >
                        {n.issue ? n.issue.title : n.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      <span className="text-foreground/90">{n.actor?.name ?? "Sistem"}</span>:{" "}
                      {n.body || n.title}
                    </p>
                  </div>
                </div>

                {/* Right: status + priority + relative time + delete */}
                <div className="flex items-center gap-2.5 shrink-0">
                  {n.issue && (
                    <>
                      <PriorityIcon priority={n.issue.priority} className="w-3.5 h-3.5" />
                      {n.issue.status.category === "COMPLETED" ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="w-4 h-4"
                          style={{ color: n.issue.status.color }}
                        />
                      ) : (
                        <span
                          className="w-3 h-3 rounded-full border-2"
                          style={{ borderColor: n.issue.status.color }}
                          title={n.issue.status.name}
                        />
                      )}
                    </>
                  )}
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-8 text-right">
                    {formatRelativeShort(n.createdAt)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(n.id);
                    }}
                    aria-label="Hapus notifikasi"
                    className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
