"use client";

import { useRef, useEffect } from "react";

interface SquaresBackgroundProps {
  squareSize?: number;
  speed?: number;
  borderColor?: string;
  hoverFillColor?: string;
}

/**
 * React Bits inspired Squares animated grid background (https://github.com/DavidHDev/react-bits)
 * Calm, low-contrast dark Zinc grid with subtle pointer hover illumination.
 */
export function SquaresBackground({
  squareSize = 44,
  speed = 0.25,
  borderColor = "rgba(255, 255, 255, 0.045)",
  hoverFillColor = "rgba(255, 255, 255, 0.04)",
}: SquaresBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animId = 0;
    let offsetX = 0;
    let offsetY = 0;
    let hovered: { x: number; y: number } | null = null;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const startX = -((offsetX % squareSize) + squareSize) % squareSize;
      const startY = -((offsetY % squareSize) + squareSize) % squareSize;

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;

      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
          const gridX = Math.floor((x - startX) / squareSize);
          const gridY = Math.floor((y - startY) / squareSize);
          if (hovered && hovered.x === gridX && hovered.y === gridY) {
            ctx.fillStyle = hoverFillColor;
            ctx.fillRect(x, y, squareSize, squareSize);
          }
          ctx.strokeRect(x, y, squareSize, squareSize);
        }
      }

      // Subtle vignette to keep focus centered
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.72
      );
      gradient.addColorStop(0, "rgba(9, 9, 11, 0)");
      gradient.addColorStop(1, "rgba(9, 9, 11, 0.88)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!prefersReducedMotion) {
        offsetX = (offsetX + speed) % squareSize;
        offsetY = (offsetY + speed) % squareSize;
        animId = window.requestAnimationFrame(draw);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const startX = -((offsetX % squareSize) + squareSize) % squareSize;
      const startY = -((offsetY % squareSize) + squareSize) % squareSize;
      hovered = {
        x: Math.floor((e.clientX - rect.left - startX) / squareSize),
        y: Math.floor((e.clientY - rect.top - startY) / squareSize),
      };
    };

    const onMouseLeave = () => {
      hovered = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    draw();

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [squareSize, speed, borderColor, hoverFillColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
