"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/toast-provider";
import type { OrgIPRule } from "@/lib/contracts";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface OrgIPRulesTableProps {
  rules: OrgIPRule[];
}

export function OrgIPRulesTable({ rules }: OrgIPRulesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [cidr, setCidr] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!cidr.trim()) {
      setAddError("CIDR is required.");
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/org-ip-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cidr: cidr.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error ?? "Failed to add rule.");
        return;
      }
      setCidr("");
      setDescription("");
      toast({ title: "IP rule added", variant: "success" });
      startTransition(() => router.refresh());
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(ruleID: string) {
    const res = await fetch(`/api/admin/org-ip-rules/${encodeURIComponent(ruleID)}`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) {
      toast({ title: "IP rule removed", variant: "success" });
      startTransition(() => router.refresh());
    } else {
      toast({ title: "Failed to remove rule", variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      {/* Add rule form */}
      <form onSubmit={handleAdd} className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Add allowlist entry</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField className="grid gap-1.5 sm:w-56">
            <Label className="text-xs font-medium text-muted-foreground">CIDR *</Label>
            <Input
              placeholder="203.0.113.0/24"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              disabled={isAdding}
            />
          </TextField>
          <TextField className="grid flex-1 gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Description (optional)</Label>
            <Input
              placeholder="Customer office network"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              disabled={isAdding}
            />
          </TextField>
          <Button
            type="submit"
            size="sm"
            className="h-9 shrink-0 rounded-lg bg-foreground px-4 text-sm font-medium text-background"
            isDisabled={isAdding || isPending}
          >
            <Plus size={14} className="mr-1" />
            Add rule
          </Button>
        </div>
        {addError && <p className="mt-2 text-xs text-danger">{addError}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Accepts CIDR notation (e.g. <code>10.0.0.0/8</code>) or a bare IP address. When any
          rules are present, only matching IPs can access any route or app in this organisation.
        </p>
      </form>

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-border bg-surface">
          <p className="text-sm text-muted-foreground">
            No IP rules configured — all IPs are allowed.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  CIDR
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Added
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => (
                <tr
                  key={rule.id}
                  className={i < rules.length - 1 ? "border-b border-border/60" : ""}
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                    {rule.cidr}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {rule.description || <span className="italic text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(rule.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <ConfirmDialog
                      trigger={(open) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 min-w-7 rounded-md p-0 text-muted-foreground hover:text-danger"
                          isDisabled={isPending}
                          onPress={open}
                          aria-label="Remove rule"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                      title="Remove IP rule?"
                      description={`Remove ${rule.cidr} from the organisation allowlist? IPs in this range may lose access.`}
                      confirmLabel="Remove rule"
                      onConfirm={() => handleDelete(rule.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
