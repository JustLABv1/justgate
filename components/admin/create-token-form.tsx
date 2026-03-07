"use client";

import type { IssuedToken } from "@/lib/contracts";
import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateTokenFormProps {
  existingCount: number;
  tenantIDs: string[];
}

export function CreateTokenForm({ existingCount, tenantIDs }: CreateTokenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<IssuedToken>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      scopes: String(formData.get("scopes") || ""),
      expiresAt: String(formData.get("expiresAt") || ""),
    };

    const response = await fetch("/api/admin/tokens", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | IssuedToken
      | { error?: string }
      | null;

    if (!response.ok) {
      setIssuedToken(undefined);
      setError(result && "error" in result ? result.error || "token issue failed" : "token issue failed");
      return;
    }

    setIssuedToken(result as IssuedToken);
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
            <Card.Title className="font-display text-2xl text-slate-950">Issue token</Card.Title>
            <Card.Description className="mt-2 max-w-xl text-sm leading-7 text-slate-600">
              Go generates the credential, stores only the hash, and returns the secret once for operator handoff.
            </Card.Description>
          </div>
          <Chip className="bg-slate-950 text-white">{existingCount} known</Chip>
        </div>
      </Card.Header>
      <Card.Content className="space-y-5 pt-6">
        <Form className="grid gap-4" onSubmit={handleSubmit}>
          <TextField className="grid gap-2">
            <Label>Token name</Label>
            <Input name="name" placeholder="grafana-writer" required />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Tenant ID</Label>
            <Input list="tenant-token-options" name="tenantID" placeholder="northstar-int" required />
          </TextField>
          <datalist id="tenant-token-options">
            {tenantIDs.map((tenantID) => (
              <option key={tenantID} value={tenantID} />
            ))}
          </datalist>
          <TextField className="grid gap-2">
            <Label>Scopes</Label>
            <Input name="scopes" placeholder="metrics:write, rules:read" required />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Expiration</Label>
            <Input name="expiresAt" required type="datetime-local" />
          </TextField>
          <Button className="mt-2 w-full bg-slate-950 text-white" isDisabled={isPending} type="submit">
            {isPending ? "Issuing token..." : "Issue token"}
          </Button>
        </Form>
        {error ? <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">{error}</div> : null}
        {issuedToken ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
            <div className="font-medium text-emerald-990">One-time secret</div>
            <div className="mt-2 font-mono text-sm break-all">{issuedToken.secret}</div>
            <div className="mt-2 text-emerald-900">Preview: {issuedToken.token.preview}</div>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}