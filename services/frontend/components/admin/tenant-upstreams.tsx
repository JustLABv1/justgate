"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { TenantUpstream } from "@/lib/contracts";
import { Button, Form, Input, Label, TextField } from "@heroui/react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

interface TenantUpstreamsProps {
  tenantInternalID: string;
}

export function TenantUpstreams({ tenantInternalID }: TenantUpstreamsProps) {
  const [upstreams, setUpstreams] = useState<TenantUpstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [isAdding, setIsAdding] = useState(false);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [form, setForm] = useState({ upstreamURL: "", weight: "1", isPrimary: false });
  const [editForm, setEditForm] = useState({ upstreamURL: "", weight: "1", isPrimary: false });
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
      const payload = {
        upstreamURL: form.upstreamURL.trim(),
        weight: Number(form.weight) || 1,
        isPrimary: form.isPrimary,
      };
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantInternalID)}/upstreams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(body?.error || "Failed to add upstream");
        return;
      }
      setForm({ upstreamURL: "", weight: "1", isPrimary: false });
      setIsAdding(false);
      await load();
    });
  }

  function startEdit(u: TenantUpstream) {
    setEditingID(u.id);
    setEditForm({ upstreamURL: u.upstreamURL, weight: String(u.weight), isPrimary: u.isPrimary });
    setEditError(undefined);
  }

  function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingID) return;
    startEditTransition(async () => {
      setEditError(undefined);
      const payload = {
        upstreamURL: editForm.upstreamURL.trim(),
        weight: Number(editForm.weight) || 1,
        isPrimary: editForm.isPrimary,
      };
      const res = await fetch(`/api/admin/tenant-upstream/${encodeURIComponent(editingID)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Layers size={12} />
          Load-balancing upstreams
        </div>
        <Button
          className="h-6 rounded-full px-2.5 text-[11px]"
          size="sm"
          variant="ghost"
          onPress={() => { setIsAdding((v) => !v); setFormError(undefined); }}
        >
          <Plus size={11} />
          Add
        </Button>
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground/50">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger">{error}</div>
      ) : upstreams.length === 0 && !isAdding ? (
        <div className="text-[11px] text-muted-foreground/50">No load-balancing upstreams — the default upstream URL is used.</div>
      ) : (
        <div className="space-y-1">
          {upstreams.map((u) =>
            editingID === u.id ? (
              <Form key={u.id} className="grid gap-3 rounded-lg border border-accent/40 bg-panel p-3" onSubmit={handleEdit}>
                <TextField className="grid gap-1">
                  <Label className="text-[11px]">Upstream URL</Label>
                  <Input
                    placeholder="https://backend.internal.example"
                    required
                    type="url"
                    value={editForm.upstreamURL}
                    onChange={(e) => setEditForm((f) => ({ ...f, upstreamURL: e.target.value }))}
                  />
                </TextField>
                <div className="grid grid-cols-2 gap-3">
                  <TextField className="grid gap-1">
                    <Label className="text-[11px]">Weight</Label>
                    <Input
                      min={1}
                      type="number"
                      value={editForm.weight}
                      onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                    />
                  </TextField>
                  <div className="flex items-end pb-0.5">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                      <input
                        className="h-3.5 w-3.5 rounded"
                        type="checkbox"
                        checked={editForm.isPrimary}
                        onChange={(e) => setEditForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                      />
                      Set as primary
                    </label>
                  </div>
                </div>
                {editError && <div className="text-[11px] text-danger">{editError}</div>}
                <div className="flex gap-2">
                  <Button className="h-7 flex-1 rounded-[0.6rem] bg-foreground text-[11px] text-background" isDisabled={isEditPending} type="submit">
                    {isEditPending ? "Saving…" : "Save changes"}
                  </Button>
                  <Button className="h-7 rounded-[0.6rem] text-[11px]" variant="ghost" type="button" onPress={() => setEditingID(null)}>
                    Cancel
                  </Button>
                </div>
              </Form>
            ) : (
              <div key={u.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-panel px-3 py-2 text-[11px]">
                {u.isPrimary && (
                  <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">primary</span>
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-foreground/80">{u.upstreamURL}</span>
                <span className="shrink-0 text-muted-foreground">w:{u.weight}</span>
                <Button
                  className="h-5 w-5 min-w-5 rounded-md px-0 text-muted-foreground hover:text-foreground"
                  size="sm"
                  variant="ghost"
                  aria-label="Edit upstream"
                  onPress={() => startEdit(u)}
                >
                  <Pencil size={10} />
                </Button>
                <ConfirmDialog
                  trigger={(open) => (
                    <Button
                      className="h-5 w-5 min-w-5 rounded-md px-0 text-muted-foreground hover:text-danger"
                      size="sm"
                      variant="ghost"
                      aria-label="Delete upstream"
                      onPress={open}
                    >
                      <Trash2 size={10} />
                    </Button>
                  )}
                  title="Delete upstream?"
                  description="This removes the upstream from load balancing. Traffic will immediately stop being routed to it."
                  confirmLabel="Delete upstream"
                  onConfirm={() => handleDelete(u.id)}
                />
              </div>
            ),
          )}
        </div>
      )}

      {isAdding && (
        <Form className="grid gap-3 rounded-lg border border-border/60 bg-panel p-3" onSubmit={handleAdd}>
          <TextField className="grid gap-1">
            <Label className="text-[11px]">Upstream URL</Label>
            <Input
              placeholder="https://secondary.internal.example"
              required
              type="url"
              value={form.upstreamURL}
              onChange={(e) => setForm((f) => ({ ...f, upstreamURL: e.target.value }))}
            />
          </TextField>
          <div className="grid grid-cols-2 gap-3">
            <TextField className="grid gap-1">
              <Label className="text-[11px]">Weight</Label>
              <Input
                min={1}
                type="number"
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              />
            </TextField>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  className="h-3.5 w-3.5 rounded"
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                />
                Set as primary
              </label>
            </div>
          </div>
          {formError && <div className="text-[11px] text-danger">{formError}</div>}
          <div className="flex gap-2">
            <Button className="h-7 flex-1 rounded-[0.6rem] bg-foreground text-[11px] text-background" isDisabled={isPending} type="submit">
              {isPending ? "Adding…" : "Add upstream"}
            </Button>
            <Button className="h-7 rounded-[0.6rem] text-[11px]" variant="ghost" type="button" onPress={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
}

