"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  onToggleCheckbox?: (checkboxIndex: number) => void;
  className?: string;
}

const VIDEO_EXT_RE = /\.(mp4|webm|mov|ogv)(\?.*)?$/i;

export function toggleMarkdownCheckbox(markdown: string, targetIndex: number): string {
  let current = 0;
  return markdown.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/gm, (match, prefix, state, suffix) => {
    const idx = current++;
    if (idx !== targetIndex) return match;
    const nextState = state.toLowerCase() === "x" ? " " : "x";
    return `${prefix}${nextState}${suffix}`;
  });
}

export function countMarkdownCheckboxes(markdown: string): { total: number; checked: number } {
  const matches = markdown.match(/^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]/gm);
  if (!matches) return { total: 0, checked: 0 };
  const checked = matches.filter((m) => /\[[xX]\]/.test(m)).length;
  return { total: matches.length, checked };
}

export function MarkdownRenderer({ content, onToggleCheckbox, className = "" }: MarkdownRendererProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  let checkboxCounter = 0;

  return (
    <>
      <div className={`markdown-body ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }) => {
              if (href && VIDEO_EXT_RE.test(href)) {
                return (
                  <span className="block my-2.5">
                    <video
                      src={href}
                      controls
                      preload="metadata"
                      className="w-full max-w-2xl max-h-[420px] rounded-lg border border-[#272732] bg-black"
                    />
                    <span className="block text-[11px] text-zinc-500 mt-1">{children}</span>
                  </span>
                );
              }
              return (
                <a
                  href={href}
                  target={href?.startsWith("http") ? "_blank" : undefined}
                  rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                  {...props}
                >
                  {children}
                </a>
              );
            },
            img: ({ src, alt }) => {
              const imgSrc = typeof src === "string" ? src : "";
              if (!imgSrc) return null;
              if (VIDEO_EXT_RE.test(imgSrc)) {
                return (
                  <video
                    src={imgSrc}
                    controls
                    preload="metadata"
                    className="my-2.5 w-full max-w-2xl max-h-[420px] rounded-lg border border-[#272732] bg-black"
                  />
                );
              }
              return (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(imgSrc)}
                  className="block my-2.5 rounded-lg overflow-hidden border border-[#272732] hover:border-[#3d3d4f] bg-[#0b0b0e] transition text-left"
                  title="Klik untuk memperbesar gambar"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={alt || "Lampiran gambar"}
                    className="max-w-full max-h-[420px] object-contain"
                  />
                </button>
              );
            },
            input: ({ type, checked, disabled: _remarkDisabled, ...restProps }) => {
              if (type === "checkbox") {
                const index = checkboxCounter++;
                const isInteractive = Boolean(onToggleCheckbox);
                return (
                  <input
                    {...restProps}
                    type="checkbox"
                    checked={Boolean(checked)}
                    disabled={!isInteractive}
                    onChange={() => onToggleCheckbox?.(index)}
                    onClick={(e) => e.stopPropagation()}
                    className={`mr-2 h-4 w-4 rounded border-zinc-500 bg-surface-2 accent-indigo-500 align-middle transition ${
                      isInteractive
                        ? "cursor-pointer hover:ring-2 hover:ring-indigo-500/40"
                        : "cursor-default opacity-70"
                    }`}
                  />
                );
              }
              return <input type={type} disabled={_remarkDisabled} {...restProps} />;
            },
            table: ({ children, ...props }) => (
              <div className="my-3 overflow-x-auto rounded-lg border border-border-default">
                <table className="w-full border-collapse text-xs" {...props}>
                  {children}
                </table>
              </div>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* Image Zoom Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Tutup pratinjau gambar"
            className="fixed top-4 right-4 p-2 rounded-full bg-[#1a1a22] border border-[#2e2e3b] text-zinc-200 hover:text-white"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Pratinjau gambar"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[90vh] object-contain rounded-lg border border-[#2d2d3a]"
          />
        </div>
      )}
    </>
  );
}
