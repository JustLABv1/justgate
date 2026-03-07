"use client";

import type { TenantSummary } from "@/lib/contracts";
import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateTenantFormProps {
  existingCount: number;
}

export function CreateTenantForm({ existingCount }: CreateTenantFormProps) {
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
    <Card className="border border-slate-900/10 bg-white/85 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]">
      <Card.Header className="flex flex-col gap-3 border-b border-slate-900/10 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Card.Title className="font-display text-2xl text-slate-950">Create tenant</Card.Title>
            <Card.Description className="mt-2 max-w-xl text-sm leading-7 text-slate-600">
              Register a new upstream target that Go can bind to token and route policy.
            </Card.Description>
          </div>
          <Chip className="bg-slate-950 text-white">{existingCount} configured</Chip>
        </div>
      </Card.Header>
      <Card.Content className="space-y-5 pt-6">
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
          <Button className="mt-2 w-full bg-slate-950 text-white" isDisabled={isPending} type="submit">
            {isPending ? "Creating tenant..." : "Create tenant"}
          </Button>
        </Form>
        {error ? <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">{error}</div> : null}
        {createdTenant ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
            Tenant {createdTenant.tenantID} is available and will appear in the Go-backed inventory after refresh.
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}