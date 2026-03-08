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
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Issue credential</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">Issue token</Modal.Heading>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Go generates the credential, stores only the hash, and returns the secret once for operator handoff.
                  </p>
                </div>
                <Chip className="border border-border bg-panel text-foreground">{existingCount} known</Chip>
              </div>
              <div className="enterprise-panel mt-5 w-full px-4 py-3">
                <div className="enterprise-kicker">Security</div>
                <div className="mt-1 text-sm font-semibold text-foreground">The secret is shown once and only the hash persists in storage.</div>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Token name</Label>
                    <Input placeholder="grafana-writer" required value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} />
                    <div className="enterprise-note">Readable client or workload identifier.</div>
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
                  <div className="enterprise-note md:col-span-2">The token can only authorize calls for the selected tenant.</div>
                </div>
                <div className="enterprise-panel grid gap-4 p-4">
                  <TextField className="grid gap-2">
                    <Label>Scopes</Label>
                    <Input placeholder="metrics:write, rules:read" required value={formState.scopes} onChange={(event) => setFormState((current) => ({ ...current, scopes: event.target.value }))} />
                    <div className="enterprise-note">Comma-separated permissions that must satisfy route policy.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Expiration</Label>
                    <Input required type="datetime-local" value={formState.expiresAt} onChange={(event) => setFormState((current) => ({ ...current, expiresAt: event.target.value }))} />
                    <div className="enterprise-note">Local timestamp when the token becomes invalid.</div>
                  </TextField>
                </div>
                {error ? <div className="enterprise-feedback enterprise-feedback--error">{error}</div> : null}
                {issuedToken ? (
                  <div className="enterprise-feedback enterprise-feedback--success">
                    <div className="font-medium">One-time secret</div>
                    <div className="mt-2 rounded-[0.9rem] border border-border/70 bg-background/75 px-3 py-3 font-mono text-sm break-all text-foreground">{issuedToken.secret}</div>
                    <div className="mt-2">Preview: {issuedToken.token.preview}</div>
                  </div>
                ) : null}
                <Button className="mt-1 h-11 w-full rounded-[1rem] bg-foreground text-background" isDisabled={isPending} type="submit">
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