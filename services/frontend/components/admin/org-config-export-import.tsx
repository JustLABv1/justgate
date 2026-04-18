"use client";

import type { ExportedOrgConfig, ImportResult } from "@/lib/contracts";
import { AlertCircle, CheckCircle2, Download, FileJson, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

export function OrgConfigExportImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, startExport] = useTransition();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExportedOrgConfig | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, startImport] = useTransition();

  function handleExport() {
    setExportError(null);
    startExport(async () => {
      try {
        const res = await fetch("/api/admin/export");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setExportError((body as { error?: string }).error ?? `Export failed (${res.status})`);
          return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") ?? "";
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        const filename = match?.[1] ?? `justgate-config-${Date.now()}.json`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setExportError("Unexpected error during export.");
      }
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPreview(null);
    setPreviewError(null);
    setImportResult(null);
    setImportError(null);
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as ExportedOrgConfig;
        if (!Array.isArray(parsed.tenants) || !Array.isArray(parsed.routes)) {
          setPreviewError("Invalid config file: missing tenants or routes arrays.");
          return;
        }
        setPreview(parsed);
      } catch {
        setPreviewError("Could not parse file as JSON.");
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!preview) return;
    setImportError(null);
    setImportResult(null);
    startImport(async () => {
      try {
        const res = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenants: preview.tenants, routes: preview.routes }),
        });
        const body = await res.json();
        if (!res.ok) {
          setImportError((body as { error?: string }).error ?? `Import failed (${res.status})`);
          return;
        }
        setImportResult(body as ImportResult);
        setPreview(null);
        setImportFile(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch {
        setImportError("Unexpected error during import.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Export section */}
      <div className="rounded-xl border border-border bg-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Export Configuration</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Download all tenants and routes as a JSON file for backup or migration.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-panel disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export JSON"}
          </button>
        </div>
        {exportError && (
          <div className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {exportError}
          </div>
        )}
      </div>

      {/* Import section */}
      <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Import Configuration</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Import tenants and routes from a previously exported JSON file.
          </p>
        </div>

        {/* File picker */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-surface/50 px-4 py-3 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors">
            <FileJson className="h-4 w-4" />
            <span>{importFile ? importFile.name : "Choose a .json file…"}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {importFile && (
            <button
              type="button"
              onClick={() => {
                setImportFile(null);
                setPreview(null);
                setPreviewError(null);
                setImportResult(null);
                setImportError(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {previewError && (
          <div className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {previewError}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Import preview — review before confirming</p>
              {preview.exportedAt && (
                <span className="text-[11px] text-muted-foreground/60">
                  Exported {new Date(preview.exportedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Tenants list */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {preview.tenants.length} Tenant{preview.tenants.length !== 1 ? "s" : ""}
              </p>
              <div className="overflow-hidden rounded-lg border border-border/60 divide-y divide-border/40">
                {preview.tenants.map((t) => (
                  <div key={t.tenantID} className="flex items-center gap-2 bg-panel/50 px-3 py-1.5 text-xs">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">{t.tenantID}</span>
                    <span className="ml-auto rounded-md border border-border/50 bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                      {t.authMode}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Routes list */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {preview.routes.length} Route{preview.routes.length !== 1 ? "s" : ""}
              </p>
              <div className="overflow-hidden rounded-lg border border-border/60 divide-y divide-border/40">
                {preview.routes.map((r) => (
                  <div key={r.slug} className="flex items-center gap-2 bg-panel/50 px-3 py-1.5 text-xs">
                    <span className="font-mono font-medium text-foreground/90">/{r.slug}</span>
                    <span className="text-muted-foreground/40">→</span>
                    <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/70">
                      {r.upstreamURL}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">{r.tenantID}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing…" : "Confirm Import"}
            </button>
          </div>
        )}

        {importError && (
          <div className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {importError}
          </div>
        )}

        {importResult && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Import successful
            </div>
            <p className="text-xs text-muted-foreground">
              Created {importResult.tenantsCreated} tenant{importResult.tenantsCreated !== 1 ? "s" : ""} and {importResult.routesCreated} route{importResult.routesCreated !== 1 ? "s" : ""}.
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-warning">
                {importResult.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
