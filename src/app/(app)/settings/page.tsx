"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Settings,
  FolderKanban,
  Workflow,
  Users,
  Tag,
  KeyRound,
  Webhook,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Link2,
  Crown,
  Shield,
  Building2,
  AlertTriangle,
  FileText,
  Upload,
} from "lucide-react";
import { useWorkspace, type WorkspaceRoleValue } from "@/components/WorkspaceProvider";
import { MigrationImportPanel } from "@/components/MigrationImportPanel";
import { getIssueTemplates } from "@/lib/issue-templates";
import type { StatusCategoryValue } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SettingsTab =
  | "general"
  | "projects"
  | "workflow"
  | "templates"
  | "members"
  | "labels"
  | "import"
  | "api-keys"
  | "webhooks";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface InvitationRow {
  id: string;
  email: string | null;
  role: WorkspaceRoleValue;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: { id: string; name: string; email: string };
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  deliveries: Array<{
    id: string;
    event: string;
    statusCode: number | null;
    success: boolean;
    error: string | null;
    createdAt: string;
  }>;
}

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "general";
  const { data, refresh, bumpIssueVersion } = useWorkspace();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // General workspace edit / delete state
  const [wsNameDraft, setWsNameDraft] = useState("");
  const [issuePrefixDraft, setIssuePrefixDraft] = useState("SDG");
  const [renameExistingIssues, setRenameExistingIssues] = useState(true);
  const [savingPrefix, setSavingPrefix] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingWs, setDeletingWs] = useState(false);

  useEffect(() => {
    if (data?.workspace.name) {
      setWsNameDraft(data.workspace.name);
      setIssuePrefixDraft(data.workspace.issuePrefix || "SDG");
      setDeleteConfirmName("");
    }
  }, [data?.workspace.id, data?.workspace.name, data?.workspace.issuePrefix]);

  useEffect(() => {
    const q = searchParams.get("tab") as SettingsTab | null;
    if (q) setTab(q);
  }, [searchParams]);

  // Projects state
  const [projName, setProjName] = useState("");
  const [projKey, setProjKey] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projColor, setProjColor] = useState("#6366f1");

  // Workflow state
  const [stName, setStName] = useState("");
  const [stCategory, setStCategory] = useState<StatusCategoryValue>("STARTED");
  const [stColor, setStColor] = useState("#3b82f6");

  // Invitations state
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<WorkspaceRoleValue>("MEMBER");
  const [invDays, setInvDays] = useState(7);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Direct add member state
  const [memName, setMemName] = useState("");
  const [memEmail, setMemEmail] = useState("");
  const [memPassword, setMemPassword] = useState("");
  const [memRole, setMemRole] = useState<WorkspaceRoleValue>("MEMBER");

  // Templates state
  const [tplId, setTplId] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplContent, setTplContent] = useState("");
  const [tplIsDefault, setTplIsDefault] = useState(false);

  // Labels state
  const [lblName, setLblName] = useState("");
  const [lblColor, setLblColor] = useState("#3b82f6");

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([
    "issue.created",
    "issue.updated",
    "issue.status_changed",
  ]);

  const isOwner = data?.role === "OWNER";
  const isAdmin = data?.role === "OWNER" || data?.role === "ADMIN";

  const loadAdminResources = useCallback(async () => {
    if (!isAdmin) return;
    const [kRes, wRes, iRes] = await Promise.all([
      fetch("/api/internal/api-keys", { cache: "no-store" }),
      fetch("/api/internal/webhooks", { cache: "no-store" }),
      fetch("/api/internal/invitations", { cache: "no-store" }),
    ]);
    if (kRes.ok) setApiKeys((await kRes.json()).apiKeys ?? []);
    if (wRes.ok) setWebhooks((await wRes.json()).webhooks ?? []);
    if (iRes.ok) setInvitations((await iRes.json()).invitations ?? []);
  }, [isAdmin]);

  useEffect(() => {
    void loadAdminResources();
  }, [loadAdminResources, data?.workspace.id]);

  function flash(msg: string, isErr = false) {
    if (isErr) {
      setError(msg);
      setMessage("");
    } else {
      setMessage(msg);
      setError("");
    }
    setTimeout(() => {
      setMessage("");
      setError("");
    }, 4500);
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // --- Handlers ---
  async function handleRenameWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!wsNameDraft.trim()) return;
    const res = await fetch("/api/internal/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wsNameDraft.trim() }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal memperbarui nama workspace", true);
    await refresh();
    flash("Nama workspace berhasil diperbarui");
  }

  async function handleUpdateIssuePrefix(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = issuePrefixDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 2) {
      return flash("Kode tiket minimal 2 huruf atau angka", true);
    }
    setSavingPrefix(true);
    try {
      const res = await fetch("/api/internal/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuePrefix: cleaned,
          renameExistingIssues,
        }),
      });
      const json = await res.json();
      if (!res.ok) return flash(json.error || "Gagal memperbarui kode tiket", true);
      await refresh();
      bumpIssueVersion();
      flash(
        renameExistingIssues
          ? `Kode tiket diubah menjadi ${cleaned} dan seluruh tiket telah diseragamkan (${cleaned}-1, ${cleaned}-2, ...)`
          : `Kode tiket baru diubah menjadi ${cleaned}`
      );
    } finally {
      setSavingPrefix(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!data) return;
    if (deleteConfirmName.trim() !== data.workspace.name) {
      return flash("Ketik nama workspace dengan tepat untuk konfirmasi penghapusan", true);
    }
    setDeletingWs(true);
    try {
      const res = await fetch(`/api/internal/workspaces?id=${data.workspace.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        flash(json.error || "Gagal menghapus workspace", true);
        return;
      }
      await refresh();
      bumpIssueVersion();
      router.push("/board");
      router.refresh();
    } finally {
      setDeletingWs(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projName, key: projKey, description: projDesc, color: projColor }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal membuat proyek", true);
    setProjName("");
    setProjKey("");
    setProjDesc("");
    await refresh();
    flash(`Proyek ${json.project.key} berhasil dibuat`);
  }

  async function handleCreateStatus(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: stName, category: stCategory, color: stColor }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal menambah status", true);
    setStName("");
    await refresh();
    flash("Workflow status ditambahkan");
  }

  async function handleMoveStatus(index: number, direction: -1 | 1) {
    if (!data) return;
    const list = [...data.statuses];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    [list[index], list[targetIdx]] = [list[targetIdx], list[index]];
    const res = await fetch("/api/internal/statuses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: list.map((s) => s.id) }),
    });
    if (res.ok) await refresh();
  }

  async function handleDeleteStatus(id: string) {
    const res = await fetch(`/api/internal/statuses?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal menghapus status", true);
    await refresh();
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invEmail.trim() || undefined,
        role: invRole,
        expiresInDays: invDays,
      }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal membuat undangan", true);
    const fullUrl = `${window.location.origin}${json.invitePath}`;
    setLatestInviteUrl(fullUrl);
    setInvEmail("");
    await loadAdminResources();
    flash("Tautan undangan berhasil dibuat");
  }

  async function handleDeleteInvitation(id: string) {
    const res = await fetch(`/api/internal/invitations?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadAdminResources();
      flash("Undangan dicabut");
    }
  }

  async function handleDirectAddMember(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: memName, email: memEmail, password: memPassword, role: memRole }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal menambah anggota", true);
    setMemName("");
    setMemEmail("");
    await refresh();
    flash(`Anggota ${json.member.name} ditambahkan ke workspace`);
  }

  async function handleChangeRole(membershipId: string, role: WorkspaceRoleValue) {
    const res = await fetch("/api/internal/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId, role }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal mengubah role", true);
    await refresh();
    flash("Hak akses anggota diperbarui");
  }

  async function handleRemoveMember(membershipId: string, memberName: string) {
    if (!confirm(`Keluarkan ${memberName} dari workspace ini?`)) return;
    const res = await fetch(`/api/internal/members?id=${membershipId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal menghapus anggota", true);
    await refresh();
    flash(`${memberName} dikeluarkan dari workspace`);
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!tplName.trim()) return;
    const method = tplId ? "PATCH" : "POST";
    const res = await fetch("/api/internal/templates", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: tplId ?? undefined,
        name: tplName.trim(),
        description: tplDesc.trim(),
        content: tplContent,
        isDefault: tplIsDefault,
      }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal menyimpan template", true);
    setTplId(null);
    setTplName("");
    setTplDesc("");
    setTplContent("");
    setTplIsDefault(false);
    await refresh();
    flash(method === "PATCH" ? "Template diperbarui" : "Template baru dibuat");
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Hapus template ini?")) return;
    const res = await fetch(`/api/internal/templates?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
      flash("Template dihapus");
    }
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lblName, color: lblColor }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal membuat label", true);
    setLblName("");
    await refresh();
    flash("Label berhasil dibuat");
  }

  async function handleCreateApiKey(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: keyName }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal membuat API key", true);
    setKeyName("");
    setNewlyCreatedKey(json.rawKey);
    await loadAdminResources();
  }

  async function handleRevokeApiKey(id: string) {
    const res = await fetch(`/api/internal/api-keys?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadAdminResources();
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/internal/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: whName, url: whUrl, events: whEvents }),
    });
    const json = await res.json();
    if (!res.ok) return flash(json.error || "Gagal membuat webhook", true);
    setWhName("");
    setWhUrl("");
    await loadAdminResources();
    flash("Webhook berhasil didaftarkan");
  }

  async function handleDeleteWebhook(id: string) {
    const res = await fetch(`/api/internal/webhooks?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadAdminResources();
  }

  const tabs: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
    { key: "general", label: "General", icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: "projects", label: "Projects", icon: <FolderKanban className="w-3.5 h-3.5" /> },
    { key: "workflow", label: "Workflow Statuses", icon: <Workflow className="w-3.5 h-3.5" /> },
    { key: "templates", label: "Issue Templates", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "members", label: "Members & Invitations", icon: <Users className="w-3.5 h-3.5" /> },
    { key: "labels", label: "Labels", icon: <Tag className="w-3.5 h-3.5" /> },
    { key: "import", label: "Import / Migrasi", icon: <Upload className="w-3.5 h-3.5" /> },
    { key: "api-keys", label: "API Keys", icon: <KeyRound className="w-3.5 h-3.5" /> },
    { key: "webhooks", label: "Webhooks", icon: <Webhook className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="h-12 px-5 border-b border-border-subtle bg-surface-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          <h1 className="text-sm font-semibold text-zinc-100">
            Workspace Settings - {data?.workspace.name}
          </h1>
        </div>
        {data && (
          <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
            Role: {data.role}
          </Badge>
        )}
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-background">
        {/* Settings Sub-nav */}
        <nav
          aria-label="Menu pengaturan"
          className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/30 p-2.5 flex md:flex-col gap-1 overflow-x-auto"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        {/* Tab Panel */}
        <div className="flex-1 p-4 sm:p-6 max-w-5xl space-y-5 overflow-y-auto">
          {message && (
            <div className="px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300">
              {message}
            </div>
          )}
          {error && (
            <div className="px-3.5 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* GENERAL WORKSPACE TAB */}
          {tab === "general" && data && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">Pengaturan Workspace</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atur nama workspace, kode prefix tiket seragam untuk seluruh project, atau hapus workspace yang tidak digunakan.
                </p>
              </div>

              {/* Rename Workspace */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Nama Workspace</CardTitle>
                  <CardDescription>Slug: <span className="font-mono">{data.workspace.slug}</span></CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRenameWorkspace} className="flex items-center gap-2.5">
                    <Input
                      id="ws-rename"
                      required
                      disabled={!isAdmin}
                      value={wsNameDraft}
                      onChange={(e) => setWsNameDraft(e.target.value)}
                      className="flex-1"
                    />
                    {isAdmin && (
                      <Button type="submit">
                        Simpan Nama
                      </Button>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Unified Ticket Prefix */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Kode Tiket Seragam (Issue Prefix)</CardTitle>
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {(issuePrefixDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "SDG")}-1,{" "}
                      {(issuePrefixDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "SDG")}-2
                    </Badge>
                  </div>
                  <CardDescription>
                    Satu kode awalan untuk seluruh tiket di semua project pada workspace ini (misal: SDG, ENG, OPS).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateIssuePrefix} className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Input
                        id="ws-issue-prefix"
                        required
                        disabled={!isAdmin}
                        maxLength={10}
                        value={issuePrefixDraft}
                        onChange={(e) =>
                          setIssuePrefixDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                        }
                        placeholder="SDG"
                        className="max-w-[180px] font-mono uppercase"
                      />
                      {isAdmin && (
                        <Button type="submit" disabled={savingPrefix}>
                          {savingPrefix ? "Menyimpan..." : "Simpan Kode Tiket"}
                        </Button>
                      )}
                    </div>
                    {isAdmin && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={renameExistingIssues}
                          onChange={(e) => setRenameExistingIssues(e.target.checked)}
                          className="accent-foreground"
                        />
                        Seragamkan juga seluruh tiket yang sudah ada ke kode ini
                      </label>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Danger Zone: Delete Workspace */}
              {isOwner && (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-red-400 flex items-center gap-2">
                      <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0" />
                      Danger Zone: Hapus Workspace
                    </CardTitle>
                    <CardDescription>
                      Menghapus workspace <strong className="text-foreground">{data.workspace.name}</strong> akan menghapus secara permanen seluruh proyek, tiket, komentar, cycle, saved views, API keys, dan webhook di dalamnya.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                      <Input
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        placeholder={`Ketik "${data.workspace.name}" untuk konfirmasi`}
                        className="flex-1 border-destructive/40"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deletingWs || deleteConfirmName.trim() !== data.workspace.name}
                        onClick={handleDeleteWorkspace}
                        className="shrink-0"
                      >
                        {deletingWs ? "Menghapus..." : "Hapus Workspace"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* PROJECTS TAB */}
          {tab === "projects" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Projects & Prefix Key</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Setiap proyek memiliki kode awalan unik (misal: SDG, MOB, API) untuk penomoran tiket otomatis.
                </p>
              </div>

              {isAdmin && (
                <form
                  onSubmit={handleCreateProject}
                  className="rounded-xl bg-surface-1 border border-border-subtle p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
                >
                  <input
                    required
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    placeholder="Nama Proyek"
                    className="sm:col-span-2 px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                  />
                  <input
                    required
                    value={projKey}
                    onChange={(e) => setProjKey(e.target.value.toUpperCase())}
                    placeholder="Key (misal: CBT)"
                    maxLength={10}
                    className="px-3 py-1.5 text-xs font-mono uppercase bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={projColor}
                      onChange={(e) => setProjColor(e.target.value)}
                      className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                    >
                      <Plus className="w-3.5 h-3.5" /> Buat
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-xl border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
                {data?.projects.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <div>
                        <p className="font-medium text-zinc-100">
                          {p.name}{" "}
                          <span className="ml-1.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-3 text-indigo-300">
                            {p.key}
                          </span>
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Total tiket: {p._count?.issues ?? 0} · Sequence counter: #{p.issueCounter}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WORKFLOW TAB */}
          {tab === "workflow" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Custom Workflow Status Engine</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Atur tahapan status tim dan kelompokkan ke 4 kategori dasar (Backlog, Unstarted, Started, Completed).
                </p>
              </div>

              {isAdmin && (
                <form
                  onSubmit={handleCreateStatus}
                  className="rounded-xl bg-surface-1 border border-border-subtle p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
                >
                  <input
                    required
                    value={stName}
                    onChange={(e) => setStName(e.target.value)}
                    placeholder="Nama status baru..."
                    className="sm:col-span-2 px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                  />
                  <select
                    value={stCategory}
                    onChange={(e) => setStCategory(e.target.value as StatusCategoryValue)}
                    className="px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                  >
                    <option value="BACKLOG">BACKLOG</option>
                    <option value="UNSTARTED">UNSTARTED</option>
                    <option value="STARTED">STARTED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={stColor}
                      onChange={(e) => setStColor(e.target.value)}
                      className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-xl border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
                {data?.statuses.map((s, idx) => (
                  <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-zinc-600 w-4">{idx + 1}.</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-medium text-zinc-100">{s.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-zinc-400">
                        {s.category}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveStatus(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-surface-3 disabled:opacity-30 text-zinc-400"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveStatus(idx, 1)}
                          disabled={idx === (data?.statuses.length ?? 0) - 1}
                          className="p-1 rounded hover:bg-surface-3 disabled:opacity-30 text-zinc-400"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStatus(s.id)}
                          className="p-1 rounded hover:bg-red-500/15 text-zinc-500 hover:text-red-400 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ISSUE TEMPLATES TAB */}
          {tab === "templates" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Issue Templates</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Atur template deskripsi tiket yang tampil di tombol &quot;Isi Template Standar&quot; dan dropdown editor. Jika belum ada template kustom, format standar bawaan tetap digunakan.
                </p>
              </div>

              {isAdmin && (
                <form
                  onSubmit={handleSaveTemplate}
                  className="rounded-xl bg-surface-1 border border-border-subtle p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-zinc-200">
                      {tplId ? "Edit Template" : "Buat Template Baru"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const std = getIssueTemplates()[0];
                        if (std) {
                          setTplName(tplName || std.name);
                          setTplDesc(tplDesc || std.description);
                          setTplContent(std.content);
                        }
                      }}
                      className="text-[11px] px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 border border-border-default text-zinc-300"
                    >
                      Salin Format Standar Bawaan
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      required
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="Nama template (misal: Feature Request, Bug Report)"
                      className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                    <input
                      value={tplDesc}
                      onChange={(e) => setTplDesc(e.target.value)}
                      placeholder="Deskripsi singkat (opsional)"
                      className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                  </div>

                  <textarea
                    required
                    rows={8}
                    value={tplContent}
                    onChange={(e) => setTplContent(e.target.value)}
                    placeholder="Isi format Markdown template (tabel, checklist, heading)..."
                    className="w-full p-3 text-xs font-mono bg-surface-2 border border-border-default rounded-lg text-zinc-200"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={tplIsDefault}
                        onChange={(e) => setTplIsDefault(e.target.checked)}
                        className="accent-[#5e6ad2]"
                      />
                      Jadikan template utama (&quot;Isi Template Standar&quot;)
                    </label>
                    <div className="flex items-center gap-2">
                      {tplId && (
                        <button
                          type="button"
                          onClick={() => {
                            setTplId(null);
                            setTplName("");
                            setTplDesc("");
                            setTplContent("");
                            setTplIsDefault(false);
                          }}
                          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Batal Edit
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#5e6ad2] hover:bg-[#6c77e0] text-xs font-medium text-white"
                      >
                        {tplId ? "Simpan Perubahan" : "Simpan Template"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="rounded-xl border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
                {(data?.templates ?? []).map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-100 flex items-center gap-2">
                        <span className="truncate">{t.name}</span>
                        {t.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Default
                          </span>
                        )}
                      </p>
                      {t.description && (
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">{t.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setTplId(t.id);
                            setTplName(t.name);
                            setTplDesc(t.description);
                            setTplContent(t.content);
                            setTplIsDefault(t.isDefault);
                          }}
                          className="px-2.5 py-1 rounded bg-surface-2 hover:bg-surface-3 text-zinc-200 text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {(data?.templates ?? []).length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-zinc-500">
                    Belum ada template kustom. Saat ini menggunakan template standar bawaan.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MEMBERS & INVITATIONS TAB */}
          {tab === "members" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Members, Roles & Invitations</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Undang anggota baru via email atau tautan undangan. 1 akun email global dapat bergabung ke banyak workspace perusahaan berbeda dengan hak akses <strong className="text-zinc-200">OWNER</strong>, <strong className="text-zinc-200">ADMIN</strong>, atau <strong className="text-zinc-200">MEMBER</strong>.
                </p>
              </div>

              {/* Invitation Link / Email Generator */}
              {isAdmin && (
                <div className="rounded-xl bg-surface-1 border border-border-subtle p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-semibold text-zinc-100">
                      Buat Tautan Undangan (Email / Shareable Link)
                    </h3>
                  </div>

                  <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <input
                      type="email"
                      value={invEmail}
                      onChange={(e) => setInvEmail(e.target.value)}
                      placeholder="Email tujuan (kosongkan untuk tautan umum)"
                      className="sm:col-span-5 px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                    <select
                      value={invRole}
                      onChange={(e) => setInvRole(e.target.value as WorkspaceRoleValue)}
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                      {isOwner && <option value="OWNER">OWNER</option>}
                    </select>
                    <select
                      value={invDays}
                      onChange={(e) => setInvDays(parseInt(e.target.value, 10))}
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    >
                      <option value={1}>1 hari</option>
                      <option value={7}>7 hari</option>
                      <option value={30}>30 hari</option>
                    </select>
                    <button
                      type="submit"
                      className="sm:col-span-3 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                    >
                      Buat Tautan Undangan
                    </button>
                  </form>

                  {latestInviteUrl && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1.5">
                      <p className="text-[11px] font-medium text-emerald-300">
                        Tautan undangan siap dibagikan:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-2.5 py-1.5 rounded bg-surface-0 font-mono text-[11px] text-emerald-200 break-all">
                          {latestInviteUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(latestInviteUrl, "latest")}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-zinc-200 flex items-center gap-1 shrink-0"
                        >
                          {copiedId === "latest" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedId === "latest" ? "Disalin" : "Salin Link"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active Invitations List */}
                  {invitations.length > 0 && (
                    <div className="pt-2 border-t border-border-subtle space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Tautan Undangan Aktif ({invitations.length})
                      </p>
                      <div className="divide-y divide-border-subtle/60">
                        {invitations.map((inv) => {
                          const url =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/invite/${inv.token}`
                              : `/invite/${inv.token}`;
                          const expired = new Date(inv.expiresAt).getTime() < Date.now();
                          return (
                            <div
                              key={inv.id}
                              className="py-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="text-zinc-200 flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {inv.email ?? "Tautan Umum (Siapa saja dengan link)"}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-indigo-300 font-mono">
                                    {inv.role}
                                  </span>
                                  {inv.acceptedAt && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                                      Diterima
                                    </span>
                                  )}
                                  {expired && !inv.acceptedAt && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                                      Kedaluwarsa
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                  Berlaku s/d {new Date(inv.expiresAt).toLocaleDateString("id-ID")} · oleh{" "}
                                  {inv.invitedBy.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(url, inv.id)}
                                  className="px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-[11px] text-zinc-300 flex items-center gap-1"
                                >
                                  {copiedId === inv.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInvitation(inv.id)}
                                  className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                                  title="Cabut undangan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Direct Add Member (Optional shortcut) */}
              {isAdmin && (
                <details className="rounded-xl bg-surface-1 border border-border-subtle p-4">
                  <summary className="text-xs font-medium text-zinc-300 cursor-pointer select-none">
                    + Tambah Anggota Langsung (tanpa tautan undangan)
                  </summary>
                  <form
                    onSubmit={handleDirectAddMember}
                    className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    <input
                      required
                      value={memName}
                      onChange={(e) => setMemName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                    <input
                      required
                      type="email"
                      value={memEmail}
                      onChange={(e) => setMemEmail(e.target.value)}
                      placeholder="email@perusahaan.com"
                      className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                    <input
                      type="password"
                      value={memPassword}
                      onChange={(e) => setMemPassword(e.target.value)}
                      placeholder="Password awal (jika akun baru)"
                      className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                    <div className="flex gap-2">
                      <select
                        value={memRole}
                        onChange={(e) => setMemRole(e.target.value as WorkspaceRoleValue)}
                        className="px-2.5 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                      >
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                        {isOwner && <option value="OWNER">OWNER</option>}
                      </select>
                      <button
                        type="submit"
                        className="flex-1 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-xs font-medium text-zinc-100"
                      >
                        Tambahkan
                      </button>
                    </div>
                  </form>
                </details>
              )}

              {/* Members Table */}
              <div className="rounded-xl border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
                {data?.members.map((m) => {
                  const isSelf = m.id === data.user.id;
                  const canEditRole = isAdmin && (!isSelf) && (isOwner || m.role !== "OWNER");
                  return (
                    <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100 flex items-center gap-1.5">
                          <span className="truncate">{m.name}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-zinc-400">
                              Anda
                            </span>
                          )}
                          {m.role === "OWNER" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Crown className="w-2.5 h-2.5" /> OWNER
                            </span>
                          )}
                          {m.role === "ADMIN" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              <Shield className="w-2.5 h-2.5" /> ADMIN
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">{m.email}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canEditRole ? (
                          <select
                            value={m.role}
                            onChange={(e) =>
                              handleChangeRole(m.membershipId, e.target.value as WorkspaceRoleValue)
                            }
                            className="text-xs bg-surface-2 border border-border-default rounded px-2 py-1 text-zinc-200"
                          >
                            {isOwner && <option value="OWNER">OWNER</option>}
                            <option value="ADMIN">ADMIN</option>
                            <option value="MEMBER">MEMBER</option>
                          </select>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-surface-2 text-zinc-400">
                            {m.role}
                          </span>
                        )}

                        {canEditRole && (
                          <button
                            onClick={() => handleRemoveMember(m.membershipId, m.name)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                            title="Keluarkan dari workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LABELS TAB */}
          {tab === "labels" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Labels / Modul</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Kategori modul untuk pengelompokan tiket dan analisis Inspector Sidebar.
                </p>
              </div>

              <form
                onSubmit={handleCreateLabel}
                className="rounded-xl bg-surface-1 border border-border-subtle p-4 flex items-center gap-3"
              >
                <input
                  required
                  value={lblName}
                  onChange={(e) => setLblName(e.target.value)}
                  placeholder="Nama label (misal: Platform Core, Exam/CBT)"
                  className="flex-1 px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                />
                <input
                  type="color"
                  value={lblColor}
                  onChange={(e) => setLblColor(e.target.value)}
                  className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                >
                  Tambah
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {data?.labels.map((l) => (
                  <div
                    key={l.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 border border-border-subtle text-xs text-zinc-200"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API KEYS TAB */}
          {tab === "api-keys" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">REST API Keys</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Gunakan header <code className="text-indigo-300">Authorization: Bearer &lt;KEY&gt;</code> atau{" "}
                  <code className="text-indigo-300">X-API-Key: &lt;KEY&gt;</code> untuk mengakses{" "}
                  <code>/api/v1/*</code> dari sistem eksternal maupun otomasi internal.
                </p>
              </div>

              {!isAdmin ? (
                <p className="text-xs text-zinc-500">Hanya Owner/Admin yang dapat mengelola API Keys.</p>
              ) : (
                <>
                  <form
                    onSubmit={handleCreateApiKey}
                    className="rounded-xl bg-surface-1 border border-border-subtle p-4 flex items-center gap-3"
                  >
                    <input
                      required
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="Nama token (misal: Production Sync, CI/CD Integration)"
                      className="flex-1 px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                    >
                      Generate Key
                    </button>
                  </form>

                  {newlyCreatedKey && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
                      <p className="text-xs font-semibold text-emerald-300">
                        API Key baru berhasil dibuat! Salin sekarang — token ini tidak akan ditampilkan lagi.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded bg-surface-0 font-mono text-xs text-emerald-200 break-all">
                          {newlyCreatedKey}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(newlyCreatedKey);
                            setCopiedKey(true);
                            setTimeout(() => setCopiedKey(false), 2000);
                          }}
                          className="px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-zinc-200 flex items-center gap-1"
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="px-4 py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-medium text-zinc-100">
                            {k.name}{" "}
                            {k.revokedAt && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                                Revoked
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-500">
                            {k.keyPrefix}•••••••• · Last used:{" "}
                            {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("id-ID") : "Never"}
                          </p>
                        </div>
                        {!k.revokedAt && (
                          <button
                            onClick={() => handleRevokeApiKey(k.id)}
                            className="px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px]"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Quick API Docs */}
                  <div className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-2 text-xs">
                    <p className="font-semibold text-zinc-200">Endpoint REST API v1 Tersedia:</p>
                    <ul className="space-y-1 font-mono text-[11px] text-zinc-400">
                      <li><span className="text-emerald-400">GET</span> /api/v1/issues?cycle_id=...&status=...&assignee=...&updated_after=...</li>
                      <li><span className="text-emerald-400">GET</span> /api/v1/issues/:identifier</li>
                      <li><span className="text-amber-400">PATCH</span> /api/v1/issues/:identifier/status  {`{ "status": "QC Demo" }`}</li>
                      <li><span className="text-emerald-400">GET</span> /api/v1/cycles/active</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* WEBHOOKS TAB */}
          {tab === "webhooks" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Outbound Webhooks</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Kirim HTTP POST + HMAC-SHA256 signature ke layanan eksternal saat tiket dibuat atau berubah status.
                </p>
              </div>

              {!isAdmin ? (
                <p className="text-xs text-zinc-500">Hanya Owner/Admin yang dapat mengelola Webhooks.</p>
              ) : (
                <>
                  <form
                    onSubmit={handleCreateWebhook}
                    className="rounded-xl bg-surface-1 border border-border-subtle p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        required
                        value={whName}
                        onChange={(e) => setWhName(e.target.value)}
                        placeholder="Nama Webhook (misal: External Sync Listener)"
                        className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                      />
                      <input
                        required
                        type="url"
                        value={whUrl}
                        onChange={(e) => setWhUrl(e.target.value)}
                        placeholder="https://api.example.com/webhooks/opentrack"
                        className="px-3 py-1.5 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-zinc-300">
                        {["issue.created", "issue.updated", "issue.status_changed"].map((ev) => (
                          <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={whEvents.includes(ev)}
                              onChange={(e) =>
                                setWhEvents((prev) =>
                                  e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)
                                )
                              }
                            />
                            <span className="font-mono text-[11px]">{ev}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white"
                      >
                        Daftarkan Webhook
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {webhooks.map((wh) => (
                      <div
                        key={wh.id}
                        className="rounded-xl border border-border-subtle bg-surface-1 p-4 space-y-2.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-100">{wh.name}</p>
                            <p className="font-mono text-[11px] text-indigo-300 break-all">{wh.url}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">
                              Events: {wh.events.join(", ")} · Secret: <code>{wh.secret}</code>
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteWebhook(wh.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {wh.deliveries.length > 0 && (
                          <div className="pt-2 border-t border-border-subtle space-y-1">
                            <p className="text-[10px] font-semibold uppercase text-zinc-500">
                              Recent Deliveries
                            </p>
                            {wh.deliveries.slice(0, 5).map((d) => (
                              <div key={d.id} className="flex items-center justify-between text-[11px] font-mono">
                                <span className={d.success ? "text-emerald-400" : "text-red-400"}>
                                  {d.success ? "OK" : "FAIL"} ({d.statusCode ?? "ERR"}) · {d.event}
                                </span>
                                <span className="text-zinc-500">
                                  {new Date(d.createdAt).toLocaleTimeString("id-ID")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* IMPORT / MIGRATION TAB */}
          {tab === "import" && <MigrationImportPanel />}

        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-500">Memuat pengaturan...</div>}>
      <SettingsInner />
    </Suspense>
  );
}
