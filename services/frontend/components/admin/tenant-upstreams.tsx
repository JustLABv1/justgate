"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { TenantUpstream } from "@/lib/contracts";
import { Button, Form, Input, Label, TextField } from "@heroui/react";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

interface TenantUpstreamsProps {
  tenantInternalID: string;
}

const COLORS = ["var(--accent)", "var(--success)", "var(--warning)", "var(--muted-foreground)"];

function hostLabel(url: string) {
  try { return new URL(url).host; } catch { return url; }
}

export function TenantUpstreams({ tenantInternalID }: TenantUpstreamsProps) {
  const [upstreams, setUpstreams] = useState<TenantUpstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [isAdding, setIsAdding] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [form, setForm] = useState({ upstreamURL: "", weight: "1" });
  const [editForm, setEditForm] = useState({ upstreamURL: "", weight: "1" });
  const [formError, setFormError] = useState<string>();
  const [editError, setEditError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [isEditPending, startEditTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantInternalID)}/upstreams`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Error ${res.status}`);
      }
      setUpstreams((await res.json()) as TenantUpstream[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load upstreams");
    } finally {
      setLoading(false);
    }
  }, [tenantInternalID]);

  useEffect(() => { void load(); }, [load]);

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setFormError(undefined);
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantInternalID)}/upstreams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ upstreamURL: form.upstreamURL.trim(), weight: Number(form.weight) || 1 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(body?.error || "Failed to add upstream");
        return;
      }
      setForm({ upstreamURL: "", weight: "1" });
      setIsAdding(false);
      await load();
    });
  }

  function startEdit(u: TenantUpstream) {
    setEditingID(u.id);
    setEditForm({ upstreamURL: u.upstreamURL, weight: String(u.weight) });
    setEditError(undefined);
  }

  function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingID) return;
    startEditTransition(async () => {
      setEditError(undefined);
      const res = await fetch(`/api/admin/tenant-upstream/${encodeURIComponent(editingID)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ upstreamURL: editForm.upstreamURL.trim(), weight: Number(editForm.weight) || 1 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setEditError(body?.error || "Failed to update upstream");
        return;
      }
      setEditingID(null);
      await load();
    });
  }

  async function handleDelete(upstreamID: string) {
    const res = await fetch(`/api/admin/tenant-upstream/${encodeURIComponent(upstreamID)}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      if (editingID === upstreamID) setEditingID(null);
      await load();
    }
  }

  const total = upstreams.reduce((s, u) => s + u.weight, 0) || 1;

  return (
    <div className="mt-3 space-y-3">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Load-balancing upstreams
        </span>
        <Button
          className="h-6 gap-1 rounded-full px-2.5 text-[11px]"
          size="sm"
          variant="ghost"
          onPress={() => { setIsAdding((v) => !v); setFormError(undefined); }}
        >
          <Plus size={11} />
          Add
        </Button>
      </div>

      {/* ── Routing note ────────────────────────────────────────── */}
      {!loading && upstreams.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg bg-warning/8 px-2.5 py-2 text-[11px] text-warning/80">
          <Info size={11} className="mt-0.5 shrink-0" />
          <span>This pool has full routing control. The tenant&apos;s default upstream URL is bypassed while any upstream is configured here.</span>
        </div>
      )}

      {loading ? (
        <div className="text-[11px] text-muted-foreground/50">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger">{error}</div>
      ) : upstreams.length === 0 && !isAdding ? (
        <div className="rounded-lg border border-dashed border-border/60 px-3 py-3 text-center text-[11px] text-muted-foreground/50">
          No load-balancing upstreams — default upstream URL is used.
        </div>
      ) : (
        <>
          {/* ── Traffic split bar ─────────────────────────────── */}
          {upstreams.length > 1 && (
            <div className="space-y-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-border/40">
                {upstreams.map((u, i) => (
                  <div
                    key={u.id}
                    style={{ width: `${(u.weight / total) * 100}%`, background: COLORS[i % COLORS.length] }}
                    title={`${u.upstreamURL} — ${Math.round((u.weight / total) * 100)}%`}
                    className="transition-all duration-300"
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {upstreams.map((u, i) => (
                  <span key={u.id} className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {hostLabel(u.upstreamURL)} — {Math.round((u.weight / total) * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Upstream cards ────────────────────────────────── */}
          <div className="overflow-hidden rounded-xl border border-border/70">
            {upstreams.map((u, i) =>
              editingID === u.id ? (
                /* ── Edit form ──────────────────────────────── */
                <Form
                  key={u.id}
                  className="grid gap-3 border-b border-border/60 bg-panel px-4 py-3 last:border-b-0"
                  onSubmit={handleEdit}
                >
                  <TextField className="grid gap-1.5">
                    <Label className="text-[11px] text-muted-foreground">Upstream URL</Label>
                    <Input
                      placeholder="https://backend.internal.example"
                      required
                      type="url"
                      value={editForm.upstreamURL}
                      onChange={(e) => setEditForm((f) => ({ ...f, upstreamURL: e.target.value }))}
                    />
                  </TextField>
                  <TextField className="grid gap-1.5">
                    <Label className="text-[11px] text-muted-foreground">Weight</Label>
                    <Input
                      min={1}
                      type="number"
                      value={editForm.weight}
                      onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                    />
                  </TextField>
                  {editError && <div className="text-[11px] text-danger">{editError}</div>}
                  <div className="flex gap-2">
                    <Button className="h-7 flex-1 rounded-lg bg-foreground text-[11px] text-background" isDisabled={isEditPending} type="submit">
                      {isEditPending ? "Saving…" : "Save"}
                    </Button>
                    <Button className="h-7 rounded-lg text-[11px]" variant="ghost" type="button" onPress={() => setEditingID(null)}>
                      Cancel
                    </Button>
                  </div>
                </Form>
              ) : (
                /* ── View card ──────────────────────────────── */
                <div
                  key={u.id}
                  className="relative flex items-center gap-3 border-b border-border/60 bg-surface px-4 py-3 last:border-b-0"
                >
                  {/* Left color strip */}
                  <div
                    className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[12px] text-foreground/85" title={u.upstreamURL}>
                      {u.upstreamURL}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/55">
                      {upstreams.length > 1
                        ? `${Math.round((u.weight / total) * 100)}% of traffic · weight ${u.weight}`
                        : `weight ${u.weight}`}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      className="h-6 w-6 min-w-6 rounded-md px-0 text-muted-foreground/60 hover:text-foreground"
                      size="sm"
                      variant="ghost"
                      aria-label="Edit upstream"
                      onPress={() => startEdit(u)}
                    >
                      <Pencil size={11} />
                    </Button>
                    <ConfirmDialog
                      trigger={(open) => (
                        <Button
                          className="h-6 w-6 min-w-6 rounded-md px-0 text-muted-foreground/60 hover:text-danger"
                          size="sm"
                          variant="ghost"
                          aria-label="Delete upstream"
                          onPress={open}
                        >
                          <Trash2 size={11} />
                        </Button>
                      )}
                      title="Delete upstream?"
                      description="This removes the upstream from load balancing. Traffic will immediately stop being routed to it."
                      confirmLabel="Delete upstream"
                      onConfirm={() => handleDelete(u.id)}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {/* ── Add form ───────────────────────────────────────────── */}
      {isAdding && (
        <Form className="grid gap-3 rounded-xl border border-border/70 bg-panel px-4 py-3" onSubmit={handleAdd}>
          <TextField className="grid gap-1.5">
            <Label className="text-[11px] text-muted-foreground">Upstream URL</Label>
            <Input
              autoFocus
              placeholder="https://secondary.internal.example"
              required
              type="url"
              value={form.upstreamURL}
              onChange={(e) => setForm((f) => ({ ...f, upstreamURL: e.target.value }))}
            />
          </TextField>
          <TextField className="grid gap-1.5">
            <Label className="text-[11px] text-muted-foreground">Weight</Label>
            <Input
              min={1}
              type="number"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            />
          </TextField>
          {formError && <div className="text-[11px] text-danger">{formError}</div>}
          <div className="flex gap-2">
            <Button className="h-7 flex-1 rounded-lg bg-foreground text-[11px] text-background" isDisabled={isPending} type="submit">
              {isPending ? "Adding…" : "Add upstream"}
            </Button>
            <Button className="h-7 rounded-lg text-[11px]" variant="ghost" type="button" onPress={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
}
