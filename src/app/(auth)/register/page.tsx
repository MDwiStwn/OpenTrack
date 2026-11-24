"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, ArrowRight, Loader2, Eye, EyeOff, FolderKanban, Repeat, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SquaresBackground } from "@/components/reactbits/SquaresBackground";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email,
          password,
          workspaceName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registrasi gagal");
        return;
      }
      router.push("/board");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Coba beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh grid grid-cols-1 lg:grid-cols-2 bg-background overflow-hidden">
      <SquaresBackground />

      {/* Left Onboarding Context Column (Desktop) */}
      <div className="relative z-10 hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-border bg-card/30 backdrop-blur-[2px]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center">
            <Layers aria-hidden="true" className="w-4 h-4 text-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">OpenTrack</span>
        </div>

        <div className="max-w-lg space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-tight text-balance">
              Siapkan workspace tim Anda dalam hitungan detik.
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Setiap workspace terisolasi penuh. Anda langsung menjadi Owner dan dapat mengundang anggota, mengatur kode tiket seragam, atau impor tiket dari Jira dan Linear.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card/70">
              <FolderKanban aria-hidden="true" className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-foreground">Projects &amp; Milestones</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Kelompokkan tiket per modul, pantau health update, dan lacak progres tiap milestone.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card/70">
              <Repeat aria-hidden="true" className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-foreground">Cycles &amp; Burn-Up Chart</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pantau kecepatan sprint harian dan breakdown progres per anggota atau label.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card/70">
              <Users aria-hidden="true" className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-foreground">Multi-Workspace &amp; RBAC</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Satu akun untuk berbagai tim dengan kontrol peran Owner, Admin, dan Member.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Self-hosted · Open Source · Multi-Workspace
        </p>
      </div>

      {/* Right Registration Form Column */}
      <div className="relative z-10 flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden flex-col items-center text-center mb-7">
            <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3 shadow-sm">
              <Layers aria-hidden="true" className="w-5 h-5 text-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">OpenTrack</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Self-Hosted Issue &amp; Project Tracker
            </p>
          </div>

          <SpotlightCard className="p-6 sm:p-7">
            <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1">
              Buat Akun &amp; Workspace
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              Siapkan workspace baru beserta workflow standar secara otomatis.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 px-3 py-2.5 rounded-md bg-destructive/15 border border-destructive/40 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Email
                </label>
                <Input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Nama Tampilan <span className="text-muted-foreground/70">(opsional)</span>
                </label>
                <Input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kosongkan untuk memakai alamat email"
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-ws"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Nama Workspace
                </label>
                <Input
                  id="reg-ws"
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Nama organisasi atau tim"
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-pass"
                  className="block text-xs font-medium text-muted-foreground mb-1"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Input
                    id="reg-pass"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="h-10 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="w-4 h-4" />
                    ) : (
                      <Eye aria-hidden="true" className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 text-sm">
                {loading ? (
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Buat Workspace <ArrowRight aria-hidden="true" className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Sudah punya akun?</span>
              <Link href="/login" className="text-foreground hover:underline font-medium">
                Masuk di sini
              </Link>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
