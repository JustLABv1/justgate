"use client";

import type { IssuedToken } from "@/lib/contracts";
import { Button, Chip, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { Check, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useState, useTransition } from "react";

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
    rateLimitRPM: 0,
    rateLimitBurst: 0,
  };
}

export function CreateTokenForm({
  existingCount,
  tenantIDs,
  disabled = false,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
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
  const [pendingReload, setPendingReload] = useState(false);
  const [copied, setCopied] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const handleCopySecret = useCallback((secret: string) => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState(initialTenantID, initialScopes));
      setError(undefined);
      setIssuedToken(undefined);
      setPendingReload(false);
    } else if (pendingReload) {
      setPendingReload(false);
      router.refresh();
    }
    if (!isControlled) setInternalOpen(open);
    controlledOnOpenChange?.(open);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      const payload = {
        name: formState.name,
        tenantID: formState.tenantID,
        scopes: formState.scopes,
        expiresAt: toApiExpiry(formState.expiresAt),
        rateLimitRPM: formState.rateLimitRPM || undefined,
        rateLimitBurst: formState.rateLimitBurst || undefined,
      };

      const response = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as IssuedToken | { error?: string } | null;

      if (!response.ok) {
        setIssuedToken(undefined);
        setError(result && "error" in result ? result.error || "token issue failed" : "token issue failed");
        return;
      }

      setIssuedToken(result as IssuedToken);
      setFormState(toFormState(initialTenantID, initialScopes));
      setPendingReload(true);
      onCreated?.(result as IssuedToken);
    });
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
                    <div className="enterprise-note">This token will only be accepted on routes whose required scope matches one of these values.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Expiration</Label>
                    <Input required type="datetime-local" value={formState.expiresAt} onChange={(event) => setFormState((current) => ({ ...current, expiresAt: event.target.value }))} />
                    <div className="enterprise-note">Local timestamp when the token becomes invalid.</div>
                  </TextField>
                </div>
                <div className="enterprise-panel grid gap-4 p-4">
                  <div className="enterprise-kicker">Rate limiting</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Requests / min</Label>
                      <Input
                        min={0}
                        placeholder="0 = unlimited"
                        type="number"
                        value={formState.rateLimitRPM === 0 ? "" : String(formState.rateLimitRPM)}
                        onChange={(event) => setFormState((current) => ({ ...current, rateLimitRPM: Number(event.target.value) || 0 }))}
                      />
                      <div className="enterprise-note">Overrides the route-level rate limit for this token.</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Burst size</Label>
                      <Input
                        min={0}
                        placeholder="0 = unlimited"
                        type="number"
                        value={formState.rateLimitBurst === 0 ? "" : String(formState.rateLimitBurst)}
                        onChange={(event) => setFormState((current) => ({ ...current, rateLimitBurst: Number(event.target.value) || 0 }))}
                      />
                      <div className="enterprise-note">Maximum concurrent requests in one window.</div>
                    </TextField>
                  </div>
                </div>
                {error ? <div className="enterprise-feedback enterprise-feedback--error">{error}</div> : null}
                {issuedToken ? (
                  <div className="enterprise-feedback enterprise-feedback--success">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-success">Token issued — copy the secret now</div>
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-warning">Shown once</span>
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <div className="min-w-0 flex-1 rounded-[0.9rem] border border-border/70 bg-background/75 px-3 py-3 font-mono text-sm break-all text-foreground select-all">
                        {issuedToken.secret}
                      </div>
                      <Button
                        className="mt-1 h-9 w-9 min-w-9 shrink-0 rounded-xl border border-border bg-surface px-0 text-muted-foreground hover:text-foreground"
                        onPress={() => handleCopySecret(issuedToken.secret)}
                        size="sm"
                        variant="ghost"
                        aria-label="Copy secret"
                      >
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Preview: {issuedToken.token.preview}</div>
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