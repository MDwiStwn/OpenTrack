"use client";

import Link from "next/link";
import { RefreshCw, ArrowLeft, WifiOff } from "lucide-react";
import { SquaresBackground } from "./SquaresBackground";
import { SpotlightCard } from "./SpotlightCard";
import { FuzzyText } from "./FuzzyText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NotFoundViewProps {
  mode?: "not-found" | "disconnected";
  onRetry?: () => void;
}

export function NotFoundView({ mode = "not-found", onRetry }: NotFoundViewProps) {
  const isDisconnected = mode === "disconnected";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4 overflow-hidden">
      <SquaresBackground />

      <SpotlightCard className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-3">
          <Badge variant="outline" className="gap-1.5 text-[11px] text-muted-foreground">
            {isDisconnected ? (
              <>
                <WifiOff aria-hidden="true" className="w-3 h-3 text-amber-400" />
                Server Disconnected / Maintenance
              </>
            ) : (
              "Page Not Found"
            )}
          </Badge>
        </div>

        <div className="flex justify-center my-2">
          <FuzzyText
            fontSize="clamp(4rem, 12vw, 6.25rem)"
            fontWeight={800}
            baseIntensity={0.18}
            hoverIntensity={0.45}
            color="#fafafa"
          >
            404
          </FuzzyText>
        </div>

        <h1 className="text-base font-semibold tracking-tight text-foreground mt-2">
          {isDisconnected
            ? "Koneksi ke server terputus atau sedang dalam perbaikan"
            : "Halaman tidak ditemukan"}
        </h1>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {isDisconnected
            ? "Server OpenTrack sedang tidak dapat dijangkau sementara. Periksa koneksi jaringan Anda atau coba muat ulang beberapa saat lagi."
            : "Tautan yang Anda buka tidak tersedia, sudah dipindahkan, atau Anda tidak memiliki akses ke resource tersebut."}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2.5">
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
              Coba Hubungkan Ulang
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
              Muat Ulang
            </Button>
          )}
          <Link href="/board">
            <Button type="button" variant={onRetry ? "outline" : "default"}>
              <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" />
              Kembali ke Board
            </Button>
          </Link>
        </div>
      </SpotlightCard>
    </div>
  );
}
