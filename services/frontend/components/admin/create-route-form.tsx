"use client";

import { Button, Chip, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { type FormEvent, useState, useTransition } from "react";

interface CreateRouteFormProps {
  existingCount: number;
  tenantIDs: string[];
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  initialTenantID?: string;
  onCreated?: (slug: string) => void;
}

function toFormState(initialTenantID = "") {
  return {
    slug: "",
    tenantID: initialTenantID,
    targetPath: "",
    requiredScope: "",
    methods: "",
    rateLimitRPM: 0,
    rateLimitBurst: 0,
    allowCIDRs: "",
    denyCIDRs: "",
  };
}

export function CreateRouteForm({
  existingCount,
  tenantIDs,
  disabled = false,
  isOpen,
  onOpenChange,
  trigger,
  initialTenantID,
  onCreated,
}: CreateRouteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(initialTenantID));

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState(initialTenantID));
      setError(undefined);
      setSuccess(undefined);
    }

    onOpenChange?.(open);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      setSuccess(undefined);
      const payload = {
        slug: formState.slug,
        tenantID: formState.tenantID,
        targetPath: formState.targetPath,
        requiredScope: formState.requiredScope,
        methods: formState.methods,
        rateLimitRPM: formState.rateLimitRPM || undefined,
        rateLimitBurst: formState.rateLimitBurst || undefined,
        allowCIDRs: formState.allowCIDRs || undefined,
        denyCIDRs: formState.denyCIDRs || undefined,
      };

      const response = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { error?: string; slug?: string } | null;
      if (!response.ok) {
        setError(result?.error || "Failed to create route.");
        return;
      }

      setSuccess(`Created /proxy/${result?.slug || payload.slug}.`);
      setFormState(toFormState(initialTenantID));
      onCreated?.(result?.slug || payload.slug);
      onOpenChange?.(false);
      router.refresh();
    });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Plus size={16} />
          New route
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Create route</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] leading-none tracking-[-0.04em] text-foreground">Register a route</Modal.Heading>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Publish a stable proxy slug and bind it to one tenant-specific upstream path with a narrow method and scope contract.
                  </p>
                </div>
                <Chip className="w-fit border border-border bg-panel text-foreground">{existingCount} existing routes</Chip>
              </div>
              <div className="enterprise-stat-grid mt-5 w-full">
                <div className="enterprise-panel px-4 py-3">
                  <div className="enterprise-kicker">Exposure</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">Public entry via /proxy/&lt;slug&gt;</div>
                </div>
                <div className="enterprise-panel px-4 py-3">
                  <div className="enterprise-kicker">Policy</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">Tenant, scope, and method contract</div>
                </div>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Proxy slug</Label>
                    <Input
                      placeholder="metrics-ingest"
                      required
                      value={formState.slug}
                      onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
                    />
                    <div className="enterprise-note">Stable operator-facing path segment. No slashes — use hyphens instead.</div>
                  </TextField>
                  <Select
                    className="w-full"
                    isRequired
                    placeholder="Select tenant"
                    value={formState.tenantID}
                    variant="secondary"
                    onChange={(value) => setFormState((current) => ({ ...current, tenantID: String(value) }))}
                  >
                    <Label>Tenant ID</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {tenantIDs.map((tenantID) => (
                          <ListBox.Item key={tenantID} id={tenantID} textValue={tenantID}>
                            {tenantID}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <div className="enterprise-note md:col-span-2">The route is bound to exactly one tenant inventory record.</div>
                </div>

                <div className="enterprise-panel grid gap-4 p-4">
                  <TextField className="grid gap-2">
                    <Label>Target path</Label>
                    <Input
                      placeholder="/api/v1/push"
                      required
                      value={formState.targetPath}
                      onChange={(event) => setFormState((current) => ({ ...current, targetPath: event.target.value }))}
                    />
                    <div className="enterprise-note">Appended to the tenant upstream URL.</div>
                  </TextField>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Required scope</Label>
                      <Input
                        placeholder="metrics:write"
                        required
                        value={formState.requiredScope}
                        onChange={(event) => setFormState((current) => ({ ...current, requiredScope: event.target.value }))}
                      />
                      <div className="enterprise-note">The bearer token must carry this exact scope — requests without it are rejected with 403.</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Allowed methods</Label>
                      <Input
                        placeholder="POST, PUT"
                        required
                        value={formState.methods}
                        onChange={(event) => setFormState((current) => ({ ...current, methods: event.target.value }))}
                      />
                      <div className="enterprise-note">Comma-separated HTTP verbs.</div>
                    </TextField>
                  </div>
                </div>

                <div className="enterprise-panel grid gap-4 p-4">
                  <div className="enterprise-kicker">Rate limiting</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Requests / min</Label>
                      <Input
                        min={0}
                        placeholder="0 = unlimited"
                        type="number"
                        value={formState.rateLimitRPM === 0 ? "" : String(formState.rateLimitRPM)}
                        onChange={(event) => setFormState((current) => ({ ...current, rateLimitRPM: Number(event.target.value) || 0 }))}
                      />
                      <div className="enterprise-note">Sliding-window token bucket replenishment rate.</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Burst size</Label>
                      <Input
                        min={0}
                        placeholder="0 = unlimited"
                        type="number"
                        value={formState.rateLimitBurst === 0 ? "" : String(formState.rateLimitBurst)}
                        onChange={(event) => setFormState((current) => ({ ...current, rateLimitBurst: Number(event.target.value) || 0 }))}
                      />
                      <div className="enterprise-note">Maximum concurrent requests in one window.</div>
                    </TextField>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Allow CIDRs</Label>
                      <Input
                        placeholder="10.0.0.0/8, 192.168.0.0/16"
                        value={formState.allowCIDRs}
                        onChange={(event) => setFormState((current) => ({ ...current, allowCIDRs: event.target.value }))}
                      />
                      <div className="enterprise-note">Comma-separated CIDRs. Only matching IPs are allowed. Empty = allow all.</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Deny CIDRs</Label>
                      <Input
                        placeholder="203.0.113.0/24"
                        value={formState.denyCIDRs}
                        onChange={(event) => setFormState((current) => ({ ...current, denyCIDRs: event.target.value }))}
                      />
                      <div className="enterprise-note">Comma-separated CIDRs that are explicitly blocked.</div>
                    </TextField>
                  </div>
                </div>
                <Button className="mt-1 h-11 w-full rounded-[1rem] bg-foreground text-background" isDisabled={isPending} type="submit">
                  <ArrowUpRight size={16} />
                  {isPending ? "Registering route..." : "Register route"}
                </Button>
                {error ? (
                  <div className="enterprise-feedback enterprise-feedback--error">
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="enterprise-feedback enterprise-feedback--success">
                    {success}
                  </div>
                ) : null}
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}