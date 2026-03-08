"use client";

import type { IssuedToken } from "@/lib/contracts";
import type { ReactNode } from "react";
import { Button, Chip, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateTokenFormProps {
  existingCount: number;
  tenantIDs: string[];
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  initialTenantID?: string;
  initialScopes?: string;
  onCreated?: (token: IssuedToken) => void;
}

function toApiExpiry(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return trimmed;
}

function toFormState(initialTenantID = "", initialScopes = "") {
  return {
    expiresAt: "",
    name: "",
    scopes: initialScopes,
    tenantID: initialTenantID,
  };
}

export function CreateTokenForm({
  existingCount,
  tenantIDs,
  disabled = false,
  isOpen,
  onOpenChange,
  trigger,
  initialTenantID,
  initialScopes,
  onCreated,
}: CreateTokenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<IssuedToken>();
  const [formState, setFormState] = useState(() => toFormState(initialTenantID, initialScopes));

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState(initialTenantID, initialScopes));
      setError(undefined);
      setIssuedToken(undefined);
    }

    onOpenChange?.(open);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const payload = {
      name: formState.name,
      tenantID: formState.tenantID,
      scopes: formState.scopes,
      expiresAt: toApiExpiry(formState.expiresAt),
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
    setFormState(toFormState(initialTenantID, initialScopes));
    startTransition(() => {
      router.refresh();
    });
    onCreated?.(result as IssuedToken);
    onOpenChange?.(false);
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Plus size={16} />
          Issue token
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <Modal.Heading className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Issue token</Modal.Heading>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Go generates the credential, stores only the hash, and returns the secret once for operator handoff.
                  </p>
                </div>
                <Chip className="bg-foreground text-background">{existingCount} known</Chip>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-4" onSubmit={handleSubmit}>
                <TextField className="grid gap-2">
                  <Label>Token name</Label>
                  <Input placeholder="grafana-writer" required value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
                  <div className="text-xs text-muted-foreground">Use a name that explains who will use this token, for example `grafana-prod-agent`.</div>
                </TextField>
                <Select className="w-full" isRequired placeholder="Select tenant" value={formState.tenantID} variant="secondary" onChange={(value) => setFormState((current) => ({ ...current, tenantID: String(value) }))}>
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
                <div className="text-xs text-muted-foreground">This token will only work for the selected tenant.</div>
                <TextField className="grid gap-2">
                  <Label>Scopes</Label>
                  <Input placeholder="metrics:write, rules:read" required value={formState.scopes} onChange={(event) => setFormState((current) => ({ ...current, scopes: event.target.value }))} />
                  <div className="text-xs text-muted-foreground">Enter one or more permissions as a comma-separated list. They must match the scopes your routes require.</div>
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Expiration</Label>
                  <Input required type="datetime-local" value={formState.expiresAt} onChange={(event) => setFormState((current) => ({ ...current, expiresAt: event.target.value }))} />
                  <div className="text-xs text-muted-foreground">Pick the exact local date and time when this token should expire.</div>
                </TextField>
                {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{error}</div> : null}
                {issuedToken ? (
                  <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <div className="font-medium">One-time secret</div>
                    <div className="mt-2 font-mono text-sm break-all">{issuedToken.secret}</div>
                    <div className="mt-2">Preview: {issuedToken.token.preview}</div>
                  </div>
                ) : null}
                <Button className="mt-2 w-full bg-foreground text-background" isDisabled={isPending} type="submit">
                  {isPending ? "Issuing token..." : "Issue token"}
                </Button>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}