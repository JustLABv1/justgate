"use client";

import type { RouteSummary } from "@/lib/contracts";
import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateRouteFormProps {
  existingCount: number;
  tenantIDs: string[];
}

export function CreateRouteForm({ existingCount, tenantIDs }: CreateRouteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [createdRoute, setCreatedRoute] = useState<RouteSummary>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      slug: String(formData.get("slug") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      targetPath: String(formData.get("targetPath") || ""),
      requiredScope: String(formData.get("requiredScope") || ""),
      methods: String(formData.get("methods") || ""),
    };

    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | RouteSummary
      | { error?: string }
      | null;

    if (!response.ok) {
      setCreatedRoute(undefined);
      setError(result && "error" in result ? result.error || "route creation failed" : "route creation failed");
      return;
    }

    setCreatedRoute(result as RouteSummary);
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
            <Card.Title className="font-display text-2xl text-slate-950">Create route</Card.Title>
            <Card.Description className="mt-2 max-w-xl text-sm leading-7 text-slate-600">
              Turn any slug into a policy-controlled entry point without exposing raw upstream details to agents.
            </Card.Description>
          </div>
          <Chip className="bg-slate-950 text-white">{existingCount} active</Chip>
        </div>
      </Card.Header>
      <Card.Content className="space-y-5 pt-6">
        <Form className="grid gap-4" onSubmit={handleSubmit}>
          <TextField className="grid gap-2">
            <Label>Proxy slug</Label>
            <Input name="slug" placeholder="mimir-write" required />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Tenant ID</Label>
            <Input list="tenant-route-options" name="tenantID" placeholder="acme-prod" required />
          </TextField>
          <datalist id="tenant-route-options">
            {tenantIDs.map((tenantID) => (
              <option key={tenantID} value={tenantID} />
            ))}
          </datalist>
          <TextField className="grid gap-2">
            <Label>Target path</Label>
            <Input name="targetPath" placeholder="/api/v1/push" required />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Required scope</Label>
            <Input name="requiredScope" placeholder="metrics:write" required />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Allowed methods</Label>
            <Input name="methods" placeholder="POST, PUT" required />
          </TextField>
          <Button className="mt-2 w-full bg-slate-950 text-white" isDisabled={isPending} type="submit">
            {isPending ? "Creating route..." : "Create route"}
          </Button>
        </Form>
        {error ? <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">{error}</div> : null}
        {createdRoute ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
            Route /proxy/{createdRoute.slug} now maps {createdRoute.tenantID} to {createdRoute.targetPath}.
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}