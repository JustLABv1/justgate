"use client";

import type { TenantSummary } from "@/lib/contracts";
import { Button, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { PenSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

interface UpdateTenantFormProps {
  tenant: TenantSummary;
  label?: string;
  disabled?: boolean;
}

function toFormState(tenant: TenantSummary | undefined) {
  return {
    headerName: tenant?.headerName || "X-Scope-OrgID",
    name: tenant?.name || "",
    tenantID: tenant?.tenantID || "",
    upstreamURL: tenant?.upstreamURL || "",
  };
}

export function UpdateTenantForm({ tenant, label = "Edit", disabled = false }: UpdateTenantFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(tenant));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        authMode: "header",
        headerName: formState.headerName,
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
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Modal>
      <Button className="h-8 rounded-full px-3 text-foreground" isDisabled={disabled} size="sm" variant="ghost">
        <PenSquare size={14} />
        {label}
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <div>
                <Modal.Heading className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Edit tenant</Modal.Heading>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Change the upstream target or header for {tenant.tenantID}.
                </p>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-4" onSubmit={handleSubmit}>
                <TextField className="grid gap-2">
                  <Label>Tenant name</Label>
                  <Input onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} value={formState.name} />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Tenant ID</Label>
                  <Input onChange={(event) => setFormState((current) => ({ ...current, tenantID: event.target.value }))} value={formState.tenantID} />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Upstream URL</Label>
                  <Input onChange={(event) => setFormState((current) => ({ ...current, upstreamURL: event.target.value }))} value={formState.upstreamURL} />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Injected header</Label>
                  <Input onChange={(event) => setFormState((current) => ({ ...current, headerName: event.target.value }))} value={formState.headerName} />
                </TextField>
                {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{error}</div> : null}
                {success ? <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">{success}</div> : null}
                <Button className="mt-2 w-full bg-foreground text-background" isDisabled={isPending} type="submit">
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