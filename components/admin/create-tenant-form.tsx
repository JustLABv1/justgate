"use client";

import type { TenantSummary } from "@/lib/contracts";
import { Button, Chip, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateTenantFormProps {
  existingCount: number;
  disabled?: boolean;
}

export function CreateTenantForm({ existingCount, disabled = false }: CreateTenantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [createdTenant, setCreatedTenant] = useState<TenantSummary>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      upstreamURL: String(formData.get("upstreamURL") || ""),
      headerName: String(formData.get("headerName") || ""),
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
    form.reset();
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Modal>
      <Button className="bg-foreground text-background" isDisabled={disabled}>
        <Plus size={16} />
        New tenant
      </Button>
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
                  <Input name="name" placeholder="Acme Observability" required />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Tenant ID</Label>
                  <Input name="tenantID" placeholder="acme-prod" required />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Upstream URL</Label>
                  <Input name="upstreamURL" placeholder="https://mimir.internal.example" required type="url" />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Injected header</Label>
                  <Input name="headerName" defaultValue="X-Scope-OrgID" required />
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