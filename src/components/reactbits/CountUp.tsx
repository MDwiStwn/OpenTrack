"use client";

import { useEffect, useState } from "react";

interface CountUpProps {
  to: number;
  from?: number;
  durationMs?: number;
  suffix?: string;
  className?: string;
}

/**
 * React Bits inspired CountUp (https://github.com/DavidHDev/react-bits)
 * Smoothly animates tabular numbers, respecting prefers-reduced-motion.
 */
export function CountUp({
  to,
  from = 0,
  durationMs = 550,
  suffix = "",
  className,
}: CountUpProps) {
  const [val, setVal] = useState(to);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || from === to) {
      setVal(to);
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [to, from, durationMs]);

  return (
    <span className={className}>
      {val}
      {suffix}
    </span>
  );
}
