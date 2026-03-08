"use client";

import type { TenantSummary } from "@/lib/contracts";
import type { ReactNode } from "react";
import { Button, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { PenSquare } from "lucide-react";
import { useRouter } from "next/navigation";
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
    name: tenant?.name || "",
    tenantID: tenant?.tenantID || "",
    upstreamURL: tenant?.upstreamURL || "",
  };
}

export function UpdateTenantForm({ tenant, label = "Edit", disabled = false, isOpen, onOpenChange, trigger }: UpdateTenantFormProps) {
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
    onOpenChange?.(false);
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
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
                    <Label>Upstream URL</Label>
                    <Input onChange={(event) => setFormState((current) => ({ ...current, upstreamURL: event.target.value }))} value={formState.upstreamURL} />
                    <div className="enterprise-note">Tenant traffic destination origin.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Injected header</Label>
                    <Input onChange={(event) => setFormState((current) => ({ ...current, headerName: event.target.value }))} value={formState.headerName} />
                    <div className="enterprise-note">Identity header attached upstream.</div>
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