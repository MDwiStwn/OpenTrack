"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  Repeat,
  Settings,
  Search,
  Plus,
  LogOut,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Check,
  Building2,
  UserPlus,
  X,
  Loader2,
  SquarePen,
  CircleDot,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Inbox,
  Box,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import { ViewEditorModal } from "./ViewEditorModal";
import { getInitials } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data, refresh, bumpIssueVersion, openCreateModal, openCommandPalette, showToast } =
    useWorkspace();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [newWsModalOpen, setNewWsModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsProjName, setNewWsProjName] = useState("Core Platform");
  const [newWsProjKey, setNewWsProjKey] = useState("CORE");
  const [creatingWs, setCreatingWs] = useState(false);
  const [wsError, setWsError] = useState("");
  const [newViewModalOpen, setNewViewModalOpen] = useState(false);

  const [viewsExpanded, setViewsExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [cyclesExpanded, setCyclesExpanded] = useState(true);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSwitcherOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleSwitchWorkspace(workspaceId: string, workspaceName: string) {
    if (workspaceId === data?.workspace.id) {
      setSwitcherOpen(false);
      return;
    }
    setSwitchingId(workspaceId);
    try {
      const res = await fetch("/api/internal/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        setSwitcherOpen(false);
        setMobileOpen(false);
        await refresh();
        bumpIssueVersion();
        showToast(`Berpindah ke workspace ${workspaceName}`);
        router.push("/board");
        router.refresh();
      } else {
        showToast("Gagal berpindah workspace", { type: "error" });
      }
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreatingWs(true);
    setWsError("");
    try {
      const res = await fetch("/api/internal/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWsName.trim(),
          projectName: newWsProjName.trim() || "Core Platform",
          projectKey: newWsProjKey.trim().toUpperCase() || "CORE",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWsError(json.error || "Gagal membuat workspace");
        return;
      }
      setNewWsModalOpen(false);
      setNewWsName("");
      setSwitcherOpen(false);
      setMobileOpen(false);
      await refresh();
      bumpIssueVersion();
      showToast(`Workspace "${json.workspace.name}" berhasil dibuat`);
      router.push("/board");
      router.refresh();
    } catch {
      setWsError("Terjadi kesalahan jaringan");
    } finally {
      setCreatingWs(false);
    }
  }

  const canManage = data?.role === "OWNER" || data?.role === "ADMIN";
  const activeCycle = data?.cycles.find((c) => c.status === "ACTIVE");
  const upcomingCycle = data?.cycles.find((c) => c.status === "UPCOMING");
  const currentProjectId = searchParams.get("projectId");
  const currentAssigneeId = searchParams.get("assigneeId");
  const currentCycleId = searchParams.get("cycleId");

  const isMyIssues = pathname === "/board" && Boolean(data?.user.id) && currentAssigneeId === data?.user.id;
  const isAllIssues = pathname === "/board" && !currentProjectId && !currentAssigneeId && !currentCycleId;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground/80 select-none">
      {/* Top Row: Workspace Switcher + Search + Quick Create */}
      <div className="relative h-11 px-2.5 flex items-center justify-between gap-1 shrink-0" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-expanded={switcherOpen}
          aria-label="Pilih atau pindah workspace"
          className={`flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-sidebar-accent transition min-w-0 ${
            collapsed ? "justify-center w-full" : "flex-1"
          }`}
        >
          <span className="w-5 h-5 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0 text-[10px] font-semibold text-foreground">
            {data?.workspace.name ? data.workspace.name[0].toUpperCase() : "O"}
          </span>
          {!collapsed && (
            <>
              <span className="text-[13px] font-medium text-foreground truncate">
                {data?.workspace.name ?? "OpenTrack"}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${
                  switcherOpen ? "rotate-180" : ""
                }`}
              />
            </>
          )}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={openCommandPalette}
              aria-label="Cari dan Command Palette (Ctrl+K)"
              title="Search (Ctrl+K)"
              className="text-muted-foreground hover:text-foreground"
            >
              <Search aria-hidden="true" className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => openCreateModal()}
              aria-label="Buat tiket baru (C)"
              title="New Issue (C)"
            >
              <SquarePen aria-hidden="true" className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Switcher Dropdown */}
        {switcherOpen && data && (
          <div className="absolute left-2.5 right-2.5 top-11 z-40 rounded-lg bg-popover text-popover-foreground border border-border shadow-xl overflow-hidden py-1 min-w-[210px]">
            <div className="px-3 py-1.5 border-b border-border">
              <p className="text-[10px] font-medium text-muted-foreground">
                Workspaces ({data.workspaces?.length ?? 1})
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{data.user.email}</p>
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              {(data.workspaces ?? []).map((ws) => {
                const isCurrent = ws.id === data.workspace.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    disabled={switchingId !== null}
                    onClick={() => handleSwitchWorkspace(ws.id, ws.name)}
                    className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-xs transition ${
                      isCurrent ? "bg-[#20202a] text-zinc-100" : "text-zinc-300 hover:bg-[#1c1c24]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded bg-[#272733] flex items-center justify-center text-[10px] font-semibold text-zinc-200 shrink-0">
                        {ws.name[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0 text-left">
                        <p className="truncate font-medium">{ws.name}</p>
                        <p className="text-[10px] text-zinc-500">{ws.role}</p>
                      </div>
                    </div>
                    {switchingId === ws.id ? (
                      <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin text-zinc-400 shrink-0" />
                    ) : isCurrent ? (
                      <Check aria-hidden="true" className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-[#22222b] pt-1 mt-1 px-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setSwitcherOpen(false);
                  setNewWsModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-[#1e1e27] hover:text-zinc-100 transition"
              >
                <Building2 aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" />
                Buat Workspace Baru
              </button>
              {canManage && (
                <Link
                  href="/settings?tab=members"
                  onClick={() => {
                    setSwitcherOpen(false);
                    setMobileOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-[#1e1e27] hover:text-zinc-100 transition"
                >
                  <UserPlus aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" />
                  Undang Anggota
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Nav */}
      <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-2 py-1.5 space-y-4">
        {/* Primary Links */}
        <div className="space-y-0.5">
          <Link
            href="/inbox"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Inbox" : undefined}
            aria-label={collapsed ? "Inbox" : undefined}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[13px] transition ${
              pathname === "/inbox"
                ? "bg-[#1a1a22] text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Inbox aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">Inbox</span>}
            </span>
            {!collapsed && (data?.unreadNotificationCount ?? 0) > 0 && (
              <Badge variant="default" className="h-4 px-1.5 rounded-full text-[10px] font-mono tabular-nums">
                {data?.unreadNotificationCount}
              </Badge>
            )}
          </Link>

          {data?.user.id && (
            <Link
              href={`/board?assigneeId=${data.user.id}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "My Issues" : undefined}
              aria-label={collapsed ? "My Issues" : undefined}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition ${
                isMyIssues
                  ? "bg-[#1a1a22] text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
              }`}
            >
              <User aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">My Issues</span>}
            </Link>
          )}

          <Link
            href="/board"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "All Issues" : undefined}
            aria-label={collapsed ? "All Issues" : undefined}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition ${
              isAllIssues
                ? "bg-[#1a1a22] text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
            }`}
          >
            <CircleDot aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span className="truncate">All Issues</span>}
          </Link>
        </div>

        {/* Workspace Group */}
        <div>
          {!collapsed && (
            <div className="px-2 mb-1 text-[11px] font-medium text-zinc-500">Workspace</div>
          )}
          <div className="space-y-0.5">
            <Link
              href="/projects"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Projects" : undefined}
              aria-label={collapsed ? "Projects" : undefined}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition ${
                pathname === "/projects"
                  ? "bg-[#1a1a22] text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
              }`}
            >
              <Box aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">Projects</span>}
            </Link>

            <Link
              href="/views"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Views" : undefined}
              aria-label={collapsed ? "Views" : undefined}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition ${
                pathname === "/views"
                  ? "bg-[#1a1a22] text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
              }`}
            >
              <Layers aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">Views</span>}
            </Link>

            {/* Cycles with Current / Upcoming sub-links */}
            <div>
              <div className="flex items-center">
                <Link
                  href="/cycles"
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? "Cycles" : undefined}
                  aria-label={collapsed ? "Cycles" : undefined}
                  className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition ${
                    pathname === "/cycles"
                      ? "bg-[#1a1a22] text-zinc-100 font-medium"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
                  }`}
                >
                  <Repeat aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                  {!collapsed && <span className="truncate">Cycles</span>}
                </Link>
                {!collapsed && (activeCycle || upcomingCycle) && (
                  <button
                    type="button"
                    onClick={() => setCyclesExpanded((v) => !v)}
                    aria-label="Toggle sub-menu Cycles"
                    aria-expanded={cyclesExpanded}
                    className="p-1 text-zinc-500 hover:text-zinc-300"
                  >
                    {cyclesExpanded ? (
                      <ChevronDown aria-hidden="true" className="w-3 h-3" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              {!collapsed && cyclesExpanded && (activeCycle || upcomingCycle) && (
                <div className="ml-4 pl-2.5 border-l border-sidebar-border mt-0.5 space-y-0.5">
                  {activeCycle && (
                    <Link
                      href={`/cycles/${activeCycle.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-2 py-1 rounded-md text-xs transition ${
                        pathname === `/cycles/${activeCycle.id}`
                          ? "bg-sidebar-accent text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      Current
                    </Link>
                  )}
                  {upcomingCycle && (
                    <Link
                      href={`/cycles/${upcomingCycle.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-2 py-1 rounded-md text-xs transition ${
                        pathname === `/cycles/${upcomingCycle.id}`
                          ? "bg-sidebar-accent text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      Upcoming
                    </Link>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Settings" : undefined}
              aria-label={collapsed ? "Settings" : undefined}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition ${
                pathname.startsWith("/settings")
                  ? "bg-[#1a1a22] text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
              }`}
            >
              <Settings aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">Settings</span>}
            </Link>
          </div>
        </div>

        {/* Saved Views Group */}
        {!collapsed && (
          <div>
            <div className="px-2 mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewsExpanded((v) => !v)}
                aria-expanded={viewsExpanded}
                className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition"
              >
                {viewsExpanded ? (
                  <ChevronDown aria-hidden="true" className="w-3 h-3" />
                ) : (
                  <ChevronRight aria-hidden="true" className="w-3 h-3" />
                )}
                Saved Views
              </button>
              <button
                type="button"
                onClick={() => setNewViewModalOpen(true)}
                aria-label="Tambah View Baru"
                title="Tambah View Baru"
                className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1a22] transition"
              >
                <Plus aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            </div>
            {viewsExpanded && (
              <div className="space-y-0.5">
                {data?.savedViews.map((view) => {
                  const active = pathname === `/views/${view.id}`;
                  return (
                    <Link
                      key={view.id}
                      href={`/views/${view.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition ${
                        active
                          ? "bg-[#1a1a22] text-zinc-100 font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
                      }`}
                    >
                      <LayoutGrid aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{view.name}</span>
                    </Link>
                  );
                })}
                {data && data.savedViews.length === 0 && (
                  <p className="px-2 py-1 text-[11px] text-zinc-600">Belum ada view</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Projects Group */}
        {!collapsed && (
          <div>
            <div className="px-2 mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setProjectsExpanded((v) => !v)}
                aria-expanded={projectsExpanded}
                className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition"
              >
                {projectsExpanded ? (
                  <ChevronDown aria-hidden="true" className="w-3 h-3" />
                ) : (
                  <ChevronRight aria-hidden="true" className="w-3 h-3" />
                )}
                Projects
              </button>
              <Link
                href="/projects"
                aria-label="Kelola Projects"
                title="Kelola Projects"
                className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1a22] transition"
              >
                <Plus aria-hidden="true" className="w-3.5 h-3.5" />
              </Link>
            </div>
            {projectsExpanded && (
              <div className="space-y-0.5">
                {data?.projects.map((proj) => {
                  const active = pathname === `/projects/${proj.id}`;
                  return (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition ${
                        active
                          ? "bg-[#1a1a22] text-zinc-100 font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-[#14141a]"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span className="truncate">{proj.name}</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-2">{proj.key}</span>
                    </Link>
                  );
                })}
                {data && data.projects.length === 0 && (
                  <Link
                    href="/projects"
                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    <FolderKanban aria-hidden="true" className="w-3 h-3" /> Buat Project
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom Footer: User + Collapse Toggle + Logout */}
      <div className="p-2 border-t border-[#18181f] flex items-center justify-between gap-1.5">
        {data && !collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
              style={{ backgroundColor: data.user.avatarColor }}
            >
              {getInitials(data.user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate" title={data.user.email}>
                {data.user.email}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{data.role}</p>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-0.5 ${collapsed ? "w-full justify-center" : "shrink-0"}`}>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Buka sidebar" : "Perkecil sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-[#16161c] transition"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="w-3.5 h-3.5" />
            )}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari akun"
              title="Keluar"
              className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-[#16161c] transition"
            >
              <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header Bar (visible on phones / small screens) */}
      <div className="md:hidden sticky top-0 z-30 h-12 px-3 border-b border-sidebar-border bg-sidebar/95 backdrop-blur flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={mobileOpen}
          >
            <Menu aria-hidden="true" className="w-4 h-4" />
          </Button>
          <span className="w-5 h-5 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0 text-[10px] font-semibold text-foreground">
            {data?.workspace.name ? data.workspace.name[0].toUpperCase() : "O"}
          </span>
          <span className="text-xs font-semibold text-foreground truncate">
            {data?.workspace.name ?? "OpenTrack"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={openCommandPalette}
            aria-label="Cari tiket"
          >
            <Search aria-hidden="true" className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => openCreateModal()}
            aria-label="Buat tiket baru"
          >
            <SquarePen aria-hidden="true" className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Sheet */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-72 max-w-[85vw] h-full border-r border-sidebar-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Rail */}
      <aside
        className={`hidden md:block shrink-0 h-screen sticky top-0 border-r border-sidebar-border transition-[width] duration-150 ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Create New Workspace Modal */}
      {newWsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNewWsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card text-card-foreground border border-border rounded-xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Buat Workspace Baru</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setNewWsModalOpen(false)}
                aria-label="Tutup modal"
                className="text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Setiap workspace memiliki isolasi data penuh (proyek, tiket, workflow, cycle, dan API key terpisah). Anda akan otomatis menjadi <strong className="text-foreground">OWNER</strong>.
            </p>

            {wsError && (
              <div className="mb-3 px-3 py-2 rounded-md bg-destructive/15 border border-destructive/40 text-xs text-red-300">
                {wsError}
              </div>
            )}

            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label htmlFor="ws-name" className="block text-xs text-muted-foreground mb-1">
                  Nama Workspace / Perusahaan
                </label>
                <Input
                  id="ws-name"
                  autoFocus
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="Nama perusahaan atau tim"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label htmlFor="ws-proj-name" className="block text-xs text-muted-foreground mb-1">
                    Project Awal
                  </label>
                  <Input
                    id="ws-proj-name"
                    value={newWsProjName}
                    onChange={(e) => setNewWsProjName(e.target.value)}
                    placeholder="Core Platform"
                  />
                </div>
                <div>
                  <label htmlFor="ws-proj-key" className="block text-xs text-muted-foreground mb-1">
                    Prefix Key
                  </label>
                  <Input
                    id="ws-proj-key"
                    value={newWsProjKey}
                    onChange={(e) => setNewWsProjKey(e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder="CORE"
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNewWsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={creatingWs || !newWsName.trim()}
                >
                  {creatingWs && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
                  Buat dan Pindah
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New View Modal */}
      {newViewModalOpen && (
        <ViewEditorModal
          onClose={() => setNewViewModalOpen(false)}
          onSaved={async (saved) => {
            setNewViewModalOpen(false);
            await refresh();
            showToast(`View "${saved.name}" berhasil dibuat`);
            router.push(`/views/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
