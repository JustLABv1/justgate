"use client";

import type { SearchResults } from "@/lib/contracts";
import { Globe, KeyRound, Search, Users2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as SearchResults;
        setResults(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  const hasResults =
    results &&
    (Array.isArray(results.routes) && results.routes.length > 0 ||
      Array.isArray(results.tenants) && results.tenants.length > 0 ||
      Array.isArray(results.tokens) && results.tokens.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted-foreground transition-colors hover:bg-panel"
      >
        <Search size={13} />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-1 hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setOpen(false);
              setQuery("");
              setResults(null);
            }}
            onKeyDown={() => {}}
            role="presentation"
          />

          {/* Dialog */}
          <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-background p-0 shadow-xl">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={16} className="text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search routes, tenants, tokens…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResults(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2">
              {loading && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Searching…
                </div>
              )}

              {!loading && query.length >= 2 && !hasResults && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No results found
                </div>
              )}

              {!loading && hasResults && (
                <div className="space-y-2">
                  {results!.routes?.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Routes
                      </div>
                      {results!.routes.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate("/routes")}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
                        >
                          <Globe size={14} className="shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground">{r.slug}</span>
                          <span className="text-xs text-muted-foreground">{r.targetPath}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results!.tenants?.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Tenants
                      </div>
                      {results!.tenants.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => navigate("/tenants")}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
                        >
                          <Users2 size={14} className="shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground">{t.name}</span>
                          <span className="text-xs text-muted-foreground">{t.tenantID}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results!.tokens?.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Tokens
                      </div>
                      {results!.tokens.map((tk) => (
                        <button
                          key={tk.id}
                          type="button"
                          onClick={() => navigate("/tokens")}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
                        >
                          <KeyRound size={14} className="shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground">{tk.name}</span>
                          <span className="text-xs text-muted-foreground">{tk.preview}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!loading && query.length < 2 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
