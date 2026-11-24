"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SquaresBackground } from "@/components/reactbits/SquaresBackground";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login gagal");
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

      {/* Left Showcase Column (Desktop - Real Product UI Fragment per taste-skill) */}
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
              Issue tracking, sprint cycles, dan kolaborasi tim dalam satu workspace.
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kelola project, milestone, time tracking, dan papan Kanban multi-workspace langsung di infrastruktur server Anda sendiri.
            </p>
          </div>

          {/* Live Product UI Preview Card */}
          <SpotlightCard className="p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between text-xs border-b border-border pb-2.5">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <PlayCircle aria-hidden="true" className="w-3.5 h-3.5 text-indigo-400" />
                Current Cycle
              </span>
              <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                82% completed
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="inline-flex items-center gap-2 text-foreground truncate">
                  <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] text-muted-foreground">OT-14</span>
                  <span className="truncate">Migrasi autentikasi session &amp; audit API</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">3 pts</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="inline-flex items-center gap-2 text-foreground truncate">
                  <Circle aria-hidden="true" className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-mono text-[11px] text-muted-foreground">OT-18</span>
                  <span className="truncate">Sinkronisasi milestone &amp; grafik burn-up</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">5 pts</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-[82%] bg-foreground/85 rounded-full" />
            </div>
          </SpotlightCard>
        </div>

        <p className="text-xs text-muted-foreground">
          Self-hosted · Open Source · Multi-Workspace
        </p>
      </div>

      {/* Right Auth Form Column */}
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
              Masuk ke Akun
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              Masukkan email dan kata sandi akun workspace Anda.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 px-3 py-2.5 rounded-md bg-destructive/15 border border-destructive/40 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Email
                </label>
                <Input
                  id="login-email"
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
                  htmlFor="login-password"
                  className="block text-xs font-medium text-muted-foreground mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
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
                    Masuk <ArrowRight aria-hidden="true" className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Belum punya akun?</span>
              <Link href="/register" className="text-foreground hover:underline font-medium">
                Buat Workspace Baru
              </Link>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
