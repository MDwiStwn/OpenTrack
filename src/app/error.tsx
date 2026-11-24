"use client";

import { NotFoundView } from "@/components/reactbits/NotFoundView";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <NotFoundView mode="disconnected" onRetry={reset} />;
}
