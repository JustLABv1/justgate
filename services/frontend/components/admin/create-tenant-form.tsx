"use client";

import type { TenantSummary } from "@/lib/contracts";
import type { ReactNode } from "react";
import { Button, Chip, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateTenantFormProps {
  existingCount: number;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  onCreated?: (tenant: TenantSummary) => void;
}

function toFormState() {
  return {
    headerName: "X-Scope-OrgID",
    name: "",
    tenantID: "",
    upstreamURL: "",
  };
}

export function CreateTenantForm({ existingCount, disabled = false, isOpen, onOpenChange, trigger, onCreated }: CreateTenantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [createdTenant, setCreatedTenant] = useState<TenantSummary>();
  const [formState, setFormState] = useState(() => toFormState());

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState());
      setError(undefined);
      setCreatedTenant(undefined);
    }

    onOpenChange?.(open);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      const payload = {
        name: formState.name,
        tenantID: formState.tenantID,
        upstreamURL: formState.upstreamURL,
        headerName: formState.headerName,
        authMode: "header",
      };

      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as TenantSummary | { error?: string } | null;

      if (!response.ok) {
        setCreatedTenant(undefined);
        setError(result && "error" in result ? result.error || "tenant creation failed" : "tenant creation failed");
        return;
      }

      setCreatedTenant(result as TenantSummary);
      setFormState(toFormState());
      onCreated?.(result as TenantSummary);
      onOpenChange?.(false);
      router.refresh();
    });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Plus size={16} />
          New tenant
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Step 1</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">Create tenant</Modal.Heading>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    First define the tenant itself. Routes and tokens depend on this record.
                  </p>
                </div>
                <Chip className="border border-border bg-panel text-foreground">{existingCount} configured</Chip>
              </div>
              <div className="enterprise-panel mt-5 w-full px-4 py-3">
                <div className="enterprise-kicker">Boundary</div>
                <div className="mt-1 text-sm font-semibold text-foreground">Each tenant maps to one upstream endpoint and one injected header identity.</div>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Tenant name</Label>
                    <Input placeholder="Acme Observability" required value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
                    <div className="enterprise-note">Readable label for operators.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Tenant ID</Label>
                    <Input placeholder="acme-prod" required value={formState.tenantID} onChange={(event) => setFormState((current) => ({ ...current, tenantID: event.target.value }))} />
                    <div className="enterprise-note">Stable machine identifier.</div>
                  </TextField>
                </div>
                <div className="enterprise-panel grid gap-4 p-4">
                  <TextField className="grid gap-2">
                    <Label>Upstream URL</Label>
                    <Input placeholder="https://mimir.internal.example" required type="url" value={formState.upstreamURL} onChange={(event) => setFormState((current) => ({ ...current, upstreamURL: event.target.value }))} />
                    <div className="enterprise-note">Base upstream origin for tenant traffic.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Injected header</Label>
                    <Input required value={formState.headerName} onChange={(event) => setFormState((current) => ({ ...current, headerName: event.target.value }))} />
                    <div className="enterprise-note">Tenant identity header added upstream.</div>
                  </TextField>
                </div>
                {error ? <div className="enterprise-feedback enterprise-feedback--error">{error}</div> : null}
                {createdTenant ? (
                  <div className="enterprise-feedback enterprise-feedback--success">
                    Tenant {createdTenant.tenantID} is available and will appear in the Go-backed inventory after refresh.
                  </div>
                ) : null}
                <Button className="mt-1 h-11 w-full rounded-[1rem] bg-foreground text-background" isDisabled={isPending} type="submit">
                  {isPending ? "Creating tenant..." : "Create tenant and continue"}
                </Button>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}