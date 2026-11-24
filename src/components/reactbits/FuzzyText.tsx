"use client";

import React, { useEffect, useRef } from "react";

interface FuzzyTextProps {
  children: React.ReactNode;
  fontSize?: number | string;
  fontWeight?: string | number;
  fontFamily?: string;
  color?: string;
  enableHover?: boolean;
  baseIntensity?: number;
  hoverIntensity?: number;
  className?: string;
}

/**
 * React Bits inspired FuzzyText component (https://github.com/DavidHDev/react-bits)
 * Renders crisp typography on canvas with subtle horizontal scanline fuzzing.
 */
export function FuzzyText({
  children,
  fontSize = "clamp(3.5rem, 11vw, 7rem)",
  fontWeight = 800,
  fontFamily = "inherit",
  color = "#fafafa",
  enableHover = true,
  baseIntensity = 0.16,
  hoverIntensity = 0.45,
  className,
}: FuzzyTextProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animationFrameId = 0;
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const init = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (isCancelled) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const computedFontFamily =
        fontFamily === "inherit"
          ? window.getComputedStyle(canvas).fontFamily || "sans-serif"
          : fontFamily;

      const fontSizeStr = typeof fontSize === "number" ? `${fontSize}px` : fontSize;
      let numericFontSize = 96;
      if (typeof fontSize === "number") {
        numericFontSize = fontSize;
      } else {
        const temp = document.createElement("span");
        temp.style.fontSize = fontSize;
        temp.style.visibility = "hidden";
        document.body.appendChild(temp);
        numericFontSize = parseFloat(window.getComputedStyle(temp).fontSize) || 96;
        document.body.removeChild(temp);
      }

      const text = React.Children.toArray(children).join("");
      const offscreen = document.createElement("canvas");
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;

      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      offCtx.textBaseline = "alphabetic";
      const metrics = offCtx.measureText(text);

      const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
      const actualRight = metrics.actualBoundingBoxRight ?? metrics.width;
      const actualAscent = metrics.actualBoundingBoxAscent ?? numericFontSize;
      const actualDescent = metrics.actualBoundingBoxDescent ?? numericFontSize * 0.2;

      const textWidth = Math.ceil(actualLeft + actualRight);
      const tightHeight = Math.ceil(actualAscent + actualDescent);
      const extraWidthBuffer = 16;

      offscreen.width = textWidth + extraWidthBuffer;
      offscreen.height = tightHeight;

      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      offCtx.textBaseline = "alphabetic";
      offCtx.fillStyle = color;
      offCtx.fillText(text, extraWidthBuffer / 2 + actualLeft, actualAscent);

      const horizontalMargin = 32;
      const verticalMargin = 8;
      canvas.width = offscreen.width + horizontalMargin * 2;
      canvas.height = offscreen.height + verticalMargin * 2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(horizontalMargin, verticalMargin);

      let isHovering = false;
      const fuzzRange = 26;

      const drawFrame = () => {
        if (isCancelled) return;
        ctx.clearRect(
          -horizontalMargin,
          -verticalMargin,
          canvas.width,
          canvas.height
        );

        if (prefersReducedMotion) {
          ctx.drawImage(offscreen, 0, 0);
          return;
        }

        const intensity = isHovering ? hoverIntensity : baseIntensity;
        for (let j = 0; j < tightHeight; j++) {
          const dx = Math.floor(intensity * (Math.random() - 0.5) * fuzzRange);
          ctx.drawImage(offscreen, 0, j, offscreen.width, 1, dx, j, offscreen.width, 1);
        }
        animationFrameId = window.requestAnimationFrame(drawFrame);
      };

      const onEnter = () => {
        if (enableHover) isHovering = true;
      };
      const onLeave = () => {
        isHovering = false;
      };

      canvas.addEventListener("mouseenter", onEnter);
      canvas.addEventListener("mouseleave", onLeave);

      drawFrame();

      return () => {
        canvas.removeEventListener("mouseenter", onEnter);
        canvas.removeEventListener("mouseleave", onLeave);
      };
    };

    let cleanupListeners: (() => void) | undefined;
    void init().then((fn) => {
      cleanupListeners = fn;
    });

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      cleanupListeners?.();
    };
  }, [children, fontSize, fontWeight, fontFamily, color, enableHover, baseIntensity, hoverIntensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={React.Children.toArray(children).join("")}
      className={className}
    />
  );
}
