"use client";

import type { RouteSummary, RouteTestResult, TokenSummary } from "@/lib/contracts";
import { ChevronDown, Copy, Play, X } from "lucide-react";
import { useEffect, useState } from "react";

interface RouteTesterProps {
  routes: RouteSummary[];
  tokens: TokenSummary[];
  backendBaseUrl: string;
  defaultOpen?: boolean;
  defaultRouteID?: string;
}

export function RouteTester({ routes, tokens, backendBaseUrl, defaultOpen = false, defaultRouteID = "" }: RouteTesterProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedRouteID, setSelectedRouteID] = useState(defaultRouteID);
  const [tokenSecret, setTokenSecret] = useState("");
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [extraHeaders, setExtraHeaders] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<RouteTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedRoute = routes.find((r) => r.id === selectedRouteID) ?? null;

  // Tokens compatible with the selected route (same tenant, active)
  const compatibleTokens = selectedRoute
    ? tokens.filter((t) => t.tenantID === selectedRoute.tenantID && t.active)
    : tokens.filter((t) => t.active);

  // Resolve the effective base URL — fall back to the current browser origin when
  // NEXTAUTH_URL is not configured and backendBaseUrl arrives as an empty string.
  const effectiveBaseUrl = backendBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  // When route changes, update URL and default method
  useEffect(() => {
    if (selectedRoute) {
      setUrl(`${effectiveBaseUrl}/proxy/${selectedRoute.slug}`);
      const defaultMethod = selectedRoute.methods.includes("GET")
        ? "GET"
        : selectedRoute.methods[0] ?? "GET";
      setMethod(defaultMethod);
    }
  }, [selectedRoute, effectiveBaseUrl]);

  // Reset token when route changes
  useEffect(() => {
    setTokenSecret("");
  }, [selectedRouteID]);

  function buildCurlCommand() {
    if (!url) return "";
    const parts = [`curl -X ${method} "${url}"`];
    if (tokenSecret) parts.push(`  -H "Authorization: Bearer ${tokenSecret}"`);
    if (extraHeaders.trim()) {
      for (const line of extraHeaders.split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) parts.push(`  -H "${line.trim()}"`);
      }
    }
    if (body && method !== "GET" && method !== "HEAD") {
      parts.push(`  -H "Content-Type: application/json"`);
      parts.push(`  -d '${body}'`);
    }
    return parts.join(" \\\n");
  }

  async function handleTest() {
    const testUrl = url.trim();
    if (!testUrl) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const headerMap: Record<string, string> = {};
      if (tokenSecret.trim()) {
        headerMap["Authorization"] = `Bearer ${tokenSecret.trim()}`;
      }
      if (extraHeaders.trim()) {
        for (const line of extraHeaders.split("\n")) {
          const idx = line.indexOf(":");
          if (idx > 0) {
            headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        }
      }
      const res = await fetch("/api/admin/route-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, url: testUrl, headers: headerMap, body }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setResult((await res.json()) as RouteTestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function copyCurl() {
    void navigator.clipboard.writeText(buildCurlCommand()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Play size={12} />
        Route Tester
      </button>
    );
  }

  const allowedMethods = selectedRoute?.methods.length
    ? selectedRoute.methods
    : ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

  const curlCmd = buildCurlCommand();

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Route Tester</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setResult(null); setError(""); }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      {/* Route + Token row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Route</label>
          <div className="relative">
            <select
              value={selectedRouteID}
              onChange={(e) => setSelectedRouteID(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-border bg-panel pl-3 pr-8 text-xs text-foreground outline-none focus:border-accent"
            >
              <option value="">— pick a route or enter URL manually —</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  /{r.slug}  ({r.tenantID})
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {selectedRoute && (
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              {selectedRoute.methods.join(", ")} · scope: {selectedRoute.requiredScope || "none"}
              {selectedRoute.rateLimitRPM > 0 && ` · limit: ${selectedRoute.rateLimitRPM}/min`}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Token secret
            {compatibleTokens.length > 0 && (
              <span className="ml-1.5 text-muted-foreground/40">
                ({compatibleTokens.length} active{selectedRoute ? " for this tenant" : ""})
              </span>
            )}
          </label>
          <input
            type="text"
            value={tokenSecret}
            onChange={(e) => setTokenSecret(e.target.value)}
            placeholder="Paste full token secret…"
            className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-accent"
          />
          {compatibleTokens.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {compatibleTokens.slice(0, 5).map((t) => (
                <span key={t.id} title={`Tenant: ${t.tenantID} · Scopes: ${t.scopes.join(", ")}`} className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                  {t.name} {t.preview}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Method + URL */}
      <div className="flex gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-9 shrink-0 rounded-lg border border-border bg-panel px-2.5 text-xs font-medium text-foreground outline-none"
        >
          {allowedMethods.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={`${backendBaseUrl}/proxy/{route-slug}`}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={handleTest}
          disabled={loading || !url.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 text-xs font-medium text-background transition-opacity disabled:opacity-40"
        >
          <Play size={11} />
          {loading ? "…" : "Send"}
        </button>
      </div>

      {/* Extra headers + body */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Extra headers <span className="text-muted-foreground/40">(Key: Value, one per line)</span>
          </label>
          <textarea
            value={extraHeaders}
            onChange={(e) => setExtraHeaders(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent"
            placeholder={"X-Custom-Header: value"}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Request body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent"
            placeholder={'{"key": "value"}'}
          />
        </div>
      </div>

      {/* cURL preview */}
      {curlCmd && (
        <div className="relative rounded-lg border border-border bg-panel">
          <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[10px] text-muted-foreground leading-relaxed pr-14">{curlCmd}</pre>
          <button
            type="button"
            onClick={copyCurl}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <Copy size={9} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">{error}</div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${result.statusCode < 400 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
              {result.statusCode}
            </span>
            <span className="text-xs text-muted-foreground">{result.latencyMs}ms</span>
          </div>

          {Object.keys(result.headers).length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                Response Headers ({Object.keys(result.headers).length})
              </summary>
              <div className="mt-2 max-h-[120px] overflow-auto rounded-lg border border-border bg-panel p-3 font-mono text-[11px] text-muted-foreground">
                {Object.entries(result.headers).map(([k, v]) => (
                  <div key={k}><span className="text-foreground">{k}:</span> {Array.isArray(v) ? v.join(", ") : v}</div>
                ))}
              </div>
            </details>
          )}

          {result.body && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">Response Body</div>
              <pre className="max-h-[200px] overflow-auto rounded-lg border border-border bg-panel p-3 font-mono text-[11px] text-foreground whitespace-pre-wrap">{result.body}</pre>
            </div>
          )}

          {result.error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">{result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

