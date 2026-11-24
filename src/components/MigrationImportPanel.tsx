"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface ParsedImportItem {
  sourceId?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  estimate?: number | null;
  labels?: string[];
  assignee?: string;
}

/** RFC-4180 compliant CSV parser supporting quoted commas & multiline fields */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function detectAndMapCsv(rows: string[][]): {
  source: "linear" | "jira" | "generic";
  items: ParsedImportItem[];
} {
  if (rows.length < 2) return { source: "generic", items: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase());

  const isJira = headers.includes("issue key") || headers.includes("summary");
  const isLinear =
    !isJira &&
    headers.includes("id") &&
    headers.includes("title") &&
    (headers.includes("state") || headers.includes("status"));

  const source: "linear" | "jira" | "generic" = isJira
    ? "jira"
    : isLinear
      ? "linear"
      : "generic";

  const idxOf = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iId = idxOf("issue key", "id", "key", "identifier");
  const iTitle = idxOf("summary", "title", "judul", "name");
  const iDesc = idxOf("description", "deskripsi", "body");
  const iStatus = idxOf("status", "state");
  const iPriority = idxOf("priority", "prioritas");
  const iEstimate = idxOf("estimate", "story points", "custom field (story points)", "points");
  const iAssignee = idxOf("assignee", "pic");

  // Jira exports can have multiple "Labels" columns
  const labelIndices = headers
    .map((h, i) => (h === "labels" || h === "label" ? i : -1))
    .filter((i) => i !== -1);

  const items: ParsedImportItem[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const title = (iTitle !== -1 ? cols[iTitle] : cols[0] || "").trim();
    if (!title) continue;

    const labels: string[] = [];
    for (const li of labelIndices) {
      const raw = (cols[li] || "").trim();
      if (!raw) continue;
      for (const part of raw.split(/[,;]/)) {
        const t = part.trim();
        if (t && !labels.includes(t)) labels.push(t);
      }
    }

    const estRaw = iEstimate !== -1 ? cols[iEstimate]?.trim() : "";
    const estNum = estRaw ? parseInt(estRaw, 10) : NaN;

    items.push({
      sourceId: iId !== -1 ? cols[iId]?.trim() || undefined : undefined,
      title,
      description: iDesc !== -1 ? cols[iDesc]?.trim() || "" : "",
      status: iStatus !== -1 ? cols[iStatus]?.trim() || undefined : undefined,
      priority: iPriority !== -1 ? cols[iPriority]?.trim() || undefined : undefined,
      estimate: Number.isFinite(estNum) && estNum >= 0 ? estNum : null,
      labels,
      assignee: iAssignee !== -1 ? cols[iAssignee]?.trim() || undefined : undefined,
    });
  }

  return { source, items };
}

export function MigrationImportPanel() {
  const { data, refresh, bumpIssueVersion, showToast } = useWorkspace();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState<"linear" | "jira" | "generic">("generic");
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [projectId, setProjectId] = useState(data?.projects[0]?.id ?? "");
  const [defaultStatusId, setDefaultStatusId] = useState(data?.statuses[0]?.id ?? "");
  const [createMissingLabels, setCreateMissingLabels] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const isAdmin = data?.role === "OWNER" || data?.role === "ADMIN";

  async function handleFileSelect(file: File) {
    setErrMsg("");
    setResultMsg("");
    setFileName(file.name);

    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.issues) ? parsed.issues : [];
        const mapped: ParsedImportItem[] = arr
          .map((o: Record<string, unknown>) => ({
            sourceId: typeof o.identifier === "string" ? o.identifier : typeof o.id === "string" ? o.id : undefined,
            title: String(o.title || o.summary || "").trim(),
            description: typeof o.description === "string" ? o.description : "",
            status: typeof o.status === "string" ? o.status : undefined,
            priority: typeof o.priority === "string" ? o.priority : undefined,
            estimate: typeof o.estimate === "number" ? o.estimate : null,
            labels: Array.isArray(o.labels) ? o.labels.map(String) : [],
            assignee: typeof o.assignee === "string" ? o.assignee : undefined,
          }))
          .filter((x: ParsedImportItem) => x.title.length > 0);
        setSource("generic");
        setItems(mapped);
        if (mapped.length === 0) setErrMsg("Tidak ditemukan data tiket valid di file JSON.");
      } else {
        const rows = parseCsvRows(text);
        const res = detectAndMapCsv(rows);
        setSource(res.source);
        setItems(res.items);
        if (res.items.length === 0) {
          setErrMsg("Tidak ditemukan baris tiket valid. Pastikan CSV memiliki kolom Title atau Summary.");
        }
      }
      if (!projectId && data?.projects[0]?.id) setProjectId(data.projects[0].id);
      if (!defaultStatusId && data?.statuses[0]?.id) setDefaultStatusId(data.statuses[0].id);
    } catch {
      setErrMsg("Gagal membaca file. Pastikan format CSV atau JSON valid.");
      setItems([]);
    }
  }

  async function handleImport() {
    if (!projectId || items.length === 0) return;
    setImporting(true);
    setErrMsg("");
    setResultMsg("");

    try {
      const batch = items.slice(0, 500);
      const res = await fetch("/api/internal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          defaultStatusId: defaultStatusId || undefined,
          source,
          createMissingLabels,
          items: batch,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrMsg(json.error || "Gagal mengimpor tiket");
        return;
      }
      setResultMsg(
        `Berhasil mengimpor ${json.importedCount} dari ${json.totalRows} tiket ke workspace (${(json.identifiers || []).slice(0, 5).join(", ")}${json.importedCount > 5 ? ", ..." : ""}).`
      );
      setItems([]);
      setFileName("");
      await refresh();
      bumpIssueVersion();
      showToast(`${json.importedCount} tiket berhasil dimigrasi`);
    } catch {
      setErrMsg("Terjadi kesalahan jaringan saat mengimpor data.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Import &amp; Migrasi dari Jira / Linear
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pindahkan seluruh tiket dari Linear atau Jira ke OpenTrack menggunakan file export CSV atau JSON (maksimal 500 tiket per batch).
        </p>
      </div>

      {/* Panduan Export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Dari Linear</CardTitle>
            <CardDescription>Format kolom otomatis terdeteksi</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>1. Buka Linear: Settings -&gt; Import / Export -&gt; Export CSV.</p>
            <p>2. Unggah file CSV hasil export di bawah ini.</p>
            <p>3. ID lama, status, priority, estimate, label, dan assignee akan dipetakan otomatis.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Dari Jira</CardTitle>
            <CardDescription>Mendukung Export Excel CSV (all fields)</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>1. Buka Jira: Filters -&gt; View all issues -&gt; Export CSV.</p>
            <p>2. Unggah file CSV hasil export di bawah ini.</p>
            <p>3. Kolom Issue key, Summary, Description, Status, Priority, Story Points, dan Labels dipetakan otomatis.</p>
          </CardContent>
        </Card>
      </div>

      {resultMsg && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300">
          <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
          <span>{resultMsg}</span>
        </div>
      )}

      {errMsg && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/15 border border-destructive/40 text-xs text-red-300">
          <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {!isAdmin ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Hanya Owner atau Admin workspace yang dapat menjalankan migrasi data.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Unggah File CSV / JSON</CardTitle>
            <CardDescription>
              ID tiket asal (misal LIN-42 atau PROJ-108) tetap disimpan pada Custom Field tiket hasil import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelect(f);
                e.target.value = "";
              }}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload aria-hidden="true" className="w-3.5 h-3.5" />
                Pilih File CSV / JSON
              </Button>
              {fileName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet aria-hidden="true" className="w-3.5 h-3.5" />
                  <span className="text-foreground font-medium">{fileName}</span>
                  <Badge variant="secondary" className="uppercase text-[10px]">
                    {source}
                  </Badge>
                  <Badge variant="outline" className="font-mono tabular-nums text-[10px]">
                    {items.length} tiket
                  </Badge>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Project Tujuan
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
                    >
                      {data?.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.key})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Fallback Status (jika status asal tidak cocok)
                    </label>
                    <select
                      value={defaultStatusId}
                      onChange={(e) => setDefaultStatusId(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
                    >
                      {data?.statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={createMissingLabels}
                    onChange={(e) => setCreateMissingLabels(e.target.checked)}
                    className="accent-foreground"
                  />
                  Buat label baru secara otomatis jika label dari CSV belum ada di workspace
                </label>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-24">ID Asal</TableHead>
                        <TableHead>Judul</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-24">Priority</TableHead>
                        <TableHead className="w-36">Labels</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.slice(0, 8).map((it, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {it.sourceId || "-"}
                          </TableCell>
                          <TableCell className="font-medium text-foreground max-w-[260px] truncate">
                            {it.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{it.status || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{it.priority || "-"}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[140px]">
                            {it.labels?.join(", ") || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {items.length > 8 && (
                    <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
                      Menampilkan 8 dari {items.length} tiket yang siap diimpor.
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={importing || !projectId}
                    onClick={() => void handleImport()}
                  >
                    {importing && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
                    {importing ? "Mengimpor..." : `Mulai Import (${Math.min(items.length, 500)} Tiket)`}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
