"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { OIDCOrgMapping, OrgSummary } from "@/lib/contracts";
import { Button, Form, Input, Label, TextField } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

interface OIDCOrgMappingsProps {
  initialMappings: OIDCOrgMapping[];
}

export function OIDCOrgMappings({ initialMappings }: OIDCOrgMappingsProps) {
  const [mappings, setMappings] = useState<OIDCOrgMapping[]>(initialMappings);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch("/api/admin/orgs")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setOrgs(data as OrgSummary[]); })
      .catch(() => {});
  }, []);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const payload = {
        oidcGroup: String(formData.get("oidcGroup") || "").trim(),
        orgID: String(formData.get("orgID") || "").trim(),
      };

      if (!payload.oidcGroup || !payload.orgID) {
        setError("Both group name and organisation are required.");
        return;
      }

      const res = await fetch("/api/admin/settings/oidc/mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to create mapping.");
        return;
      }

      setMappings((prev) => [data as OIDCOrgMapping, ...prev]);
      form.reset();
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/settings/oidc/mappings/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (res.ok || res.status === 204) {
      setMappings((prev) => prev.filter((m) => m.id !== id));
    }
  }

  function orgName(orgID: string) {
    return orgs.find((o) => o.id === orgID)?.name || orgID;
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">Group → Organisation Mapping</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Map OIDC group or realm values to organisations. Users with a matching group claim will be auto-added on login.
        </p>
      </div>
      <div className="px-5 py-5 space-y-4">
        <Form onSubmit={handleAdd} className="flex items-end gap-3">
          <TextField name="oidcGroup" className="flex-1">
            <Label className="text-sm font-medium text-foreground">OIDC Group / Realm</Label>
            <Input
              placeholder="e.g. team-platform"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          </TextField>

          <div className="flex-1">
            <label htmlFor="orgID" className="text-sm font-medium text-foreground">Organisation</label>
            <select
              id="orgID"
              name="orgID"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">Select…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            size="sm"
            className="gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
            isDisabled={isPending}
          >
            <Plus size={14} />
            Add
          </Button>
        </Form>

        {error && <p className="text-sm text-danger">{error}</p>}

        {mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No mappings configured yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                    {mapping.oidcGroup}
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm text-foreground truncate">{orgName(mapping.orgID)}</span>
                </div>
                <ConfirmDialog
                  trigger={(open) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 min-w-7 px-0 text-muted-foreground hover:text-danger"
                      onPress={open}
                      aria-label="Remove mapping"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                  title="Remove mapping?"
                  description={`Remove the mapping for group "${mapping.oidcGroup}"? Users with this group claim will no longer be auto-added to the organisation on login.`}
                  confirmLabel="Remove mapping"
                  onConfirm={() => handleDelete(mapping.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
