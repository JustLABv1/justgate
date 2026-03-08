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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | TenantSummary
      | { error?: string }
      | null;

    if (!response.ok) {
      setCreatedTenant(undefined);
      setError(result && "error" in result ? result.error || "tenant creation failed" : "tenant creation failed");
      return;
    }

    setCreatedTenant(result as TenantSummary);
    setFormState(toFormState());
    startTransition(() => {
      router.refresh();
    });
    onCreated?.(result as TenantSummary);
    onOpenChange?.(false);
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
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Step 1</div>
                  <Modal.Heading className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">Create tenant</Modal.Heading>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    First define the tenant itself. Routes and tokens depend on this record.
                  </p>
                </div>
                <Chip className="bg-foreground text-background">{existingCount} configured</Chip>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-4" onSubmit={handleSubmit}>
                <TextField className="grid gap-2">
                  <Label>Tenant name</Label>
                  <Input placeholder="Acme Observability" required value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Tenant ID</Label>
                  <Input placeholder="acme-prod" required value={formState.tenantID} onChange={(event) => setFormState((current) => ({ ...current, tenantID: event.target.value }))} />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Upstream URL</Label>
                  <Input placeholder="https://mimir.internal.example" required type="url" value={formState.upstreamURL} onChange={(event) => setFormState((current) => ({ ...current, upstreamURL: event.target.value }))} />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Injected header</Label>
                  <Input required value={formState.headerName} onChange={(event) => setFormState((current) => ({ ...current, headerName: event.target.value }))} />
                </TextField>
                {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{error}</div> : null}
                {createdTenant ? (
                  <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                    Tenant {createdTenant.tenantID} is available and will appear in the Go-backed inventory after refresh.
                  </div>
                ) : null}
                <Button className="mt-2 w-full bg-foreground text-background" isDisabled={isPending} type="submit">
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