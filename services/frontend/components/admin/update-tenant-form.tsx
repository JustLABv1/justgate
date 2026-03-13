"use client";

import type { TenantSummary } from "@/lib/contracts";
import { Button, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { PenSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { type FormEvent, useState, useTransition } from "react";

interface UpdateTenantFormProps {
  tenant: TenantSummary;
  label?: string;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
}

function toFormState(tenant: TenantSummary | undefined) {
  return {
    headerName: tenant?.headerName || "X-Scope-OrgID",
    healthCheckPath: tenant?.healthCheckPath || "",
    name: tenant?.name || "",
    tenantID: tenant?.tenantID || "",
    upstreamURL: tenant?.upstreamURL || "",
    authMode: tenant?.authMode || "header",
  };
}

export function UpdateTenantForm({ tenant, label = "Edit", disabled = false, isOpen: controlledIsOpen, onOpenChange: controlledOnOpenChange, trigger }: UpdateTenantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(tenant));
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  function handleOpenChange(open: boolean) {
    if (!isControlled) setInternalOpen(open);
    controlledOnOpenChange?.(open);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      setSuccess(undefined);

      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authMode: formState.authMode,
          headerName: formState.headerName,
          healthCheckPath: formState.healthCheckPath || undefined,
          name: formState.name,
          tenantID: formState.tenantID,
          upstreamURL: formState.upstreamURL,
        }),
      });

      const result = (await response.json().catch(() => null)) as TenantSummary | { error?: string } | null;
      if (!response.ok) {
        setError(result && "error" in result ? result.error || "tenant update failed" : "tenant update failed");
        return;
      }

      setSuccess(`Updated tenant ${formState.tenantID}.`);
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="h-8 rounded-full px-3 text-foreground" isDisabled={disabled} size="sm" variant="ghost">
          <PenSquare size={14} />
          {label}
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div>
                <div className="enterprise-kicker">Update tenant</div>
                <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">Edit tenant</Modal.Heading>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Change the upstream target or header for {tenant.tenantID}.
                </p>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Tenant name</Label>
                    <Input onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} value={formState.name} />
                    <div className="enterprise-note">Readable operator label.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Tenant ID</Label>
                    <Input onChange={(event) => setFormState((current) => ({ ...current, tenantID: event.target.value }))} value={formState.tenantID} />
                    <div className="enterprise-note">Stable machine identifier.</div>
                  </TextField>
                </div>
                <div className="enterprise-panel grid gap-4 p-4">
                  <TextField className="grid gap-2">
                    <Label>Default Upstream URL</Label>
                    <Input onChange={(event) => setFormState((current) => ({ ...current, upstreamURL: event.target.value }))} value={formState.upstreamURL} />
                    <div className="enterprise-note">Fallback origin used when no load-balancing upstreams are configured. Load-balancing upstreams (configured below) take precedence over this URL.</div>
                  </TextField>
                  <Select
                    className="w-full"
                    placeholder="Select auth mode"
                    value={formState.authMode}
                    variant="secondary"
                    onChange={(value) => setFormState((current) => ({ ...current, authMode: String(value) }))}
                  >
                    <Label>Auth mode</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="header" textValue="header">header<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="bearer" textValue="bearer">bearer<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="none" textValue="none">none<ListBox.ItemIndicator /></ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <div className="enterprise-note md:col-span-2">header — inject tenant header; bearer — forward token; none — no auth injection.</div>
                  <TextField className="grid gap-2">
                    <Label>Injected header</Label>
                    <Input onChange={(event) => setFormState((current) => ({ ...current, headerName: event.target.value }))} value={formState.headerName} />
                    <div className="enterprise-note">Identity header attached upstream.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Health check path</Label>
                    <Input placeholder="/ready" onChange={(event) => setFormState((current) => ({ ...current, healthCheckPath: event.target.value }))} value={formState.healthCheckPath} />
                    <div className="enterprise-note">Optional path to probe for upstream health.</div>
                  </TextField>
                </div>
                {error ? <div className="enterprise-feedback enterprise-feedback--error">{error}</div> : null}
                {success ? <div className="enterprise-feedback enterprise-feedback--success">{success}</div> : null}
                <Button className="mt-1 h-11 w-full rounded-[1rem] bg-foreground text-background" isDisabled={isPending} type="submit">
                  {isPending ? "Saving tenant..." : "Save tenant changes"}
                </Button>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}