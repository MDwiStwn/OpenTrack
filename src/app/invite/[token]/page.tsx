"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, Building2, Shield, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface InviteInfo {
  id: string;
  email: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  expiresAt: string;
  acceptedAt: string | null;
  expired: boolean;
  workspace: { id: string; name: string; slug: string };
  invitedBy: { id: string; name: string; email: string };
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState("");

  const [authTab, setAuthTab] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const loadInvitation = useCallback(async () => {
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error || "Undangan tidak ditemukan");
        return;
      }
      setInvite(json.invitation);
      setCurrentUser(json.currentUser);
      if (json.invitation.email) {
        setEmail(json.invitation.email);
      }
    } catch {
      setLoadError("Gagal memuat informasi undangan");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  async function handleAcceptAsCurrentUser() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "current" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Gagal menerima undangan");
        return;
      }
      router.push("/board");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuthAndAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: authTab,
          name: authTab === "register" ? name : undefined,
          email,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Gagal bergabung ke workspace");
        return;
      }
      router.push("/board");
      router.refresh();
    } catch {
      setSubmitError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">OpenTrack</h1>
            <p className="text-[11px] text-zinc-500">Workspace Invitation</p>
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 shadow-2xl">
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Memeriksa tautan undangan...
            </div>
          ) : loadError || !invite ? (
            <div className="text-center space-y-4 py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Undangan Tidak Valid</h2>
                <p className="text-xs text-zinc-400 mt-1">{loadError}</p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-zinc-200"
              >
                Kembali ke Login
              </Link>
            </div>
          ) : invite.expired ? (
            <div className="text-center space-y-4 py-4">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Undangan Sudah Kedaluwarsa</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Minta Owner/Admin workspace <strong>{invite.workspace.name}</strong> untuk membuat tautan baru.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Invitation Summary Card */}
              <div className="rounded-lg bg-surface-2 border border-border-default p-4 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">Anda diundang bergabung ke</p>
                    <h2 className="text-base font-semibold text-zinc-100">{invite.workspace.name}</h2>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                    <Shield className="w-3 h-3" /> Role: {invite.role}
                  </span>
                  <span className="text-zinc-500">Diundang oleh {invite.invitedBy.name}</span>
                </div>
                {invite.email && (
                  <p className="text-[11px] text-amber-300/90">
                    Khusus untuk email: <span className="font-mono">{invite.email}</span>
                  </p>
                )}
              </div>

              {submitError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                  {submitError}
                </div>
              )}

              {currentUser ? (
                <div className="space-y-3">
                  <div className="px-3 py-2.5 rounded-lg bg-surface-2/60 border border-border-subtle text-xs text-zinc-300">
                    Masuk sebagai <strong className="text-zinc-100">{currentUser.name}</strong> (
                    <span className="text-zinc-400">{currentUser.email}</span>)
                  </div>
                  <button
                    onClick={handleAcceptAsCurrentUser}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Terima Undangan & Masuk Workspace
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 rounded-lg bg-surface-2 border border-border-default p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setAuthTab("register")}
                      className={`py-1.5 rounded-md font-medium transition ${
                        authTab === "register"
                          ? "bg-surface-4 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Daftar Akun Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab("login")}
                      className={`py-1.5 rounded-md font-medium transition ${
                        authTab === "login"
                          ? "bg-surface-4 text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Akun yang Ada
                    </button>
                  </div>

                  <form onSubmit={handleAuthAndAccept} className="space-y-3">
                    {authTab === "register" && (
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Nama Lengkap</label>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Nama Anda"
                          className="w-full px-3 py-2 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        readOnly={Boolean(invite.email)}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="w-full px-3 py-2 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500 read-only:opacity-75"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Kata Sandi</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={authTab === "register" ? "Minimal 6 karakter" : "••••••••"}
                        className="w-full px-3 py-2 text-xs bg-surface-2 border border-border-default rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {authTab === "register" ? "Daftar & Gabung Workspace" : "Masuk & Gabung Workspace"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
