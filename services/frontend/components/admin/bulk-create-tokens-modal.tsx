"use client";

import { useToast } from "@/components/toast-provider";
import type { BulkTokenResponse, IssuedToken } from "@/lib/contracts";
import { Button, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { Check, Download, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface BulkCreateTokensModalProps {
  tenantIDs: string[];
  disabled?: boolean;
}

function toApiExpiry(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return trimmed;
}

function makeDefaultState() {
  return {
    namePrefix: "",
    tenantID: "",
    scopes: "",
    expiresAt: "",
    count: 5,
    rateLimitRPM: 0,
    rateLimitBurst: 0,
  };
}

export function BulkCreateTokensModal({ tenantIDs, disabled = false }: BulkCreateTokensModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<IssuedToken[]>();
  const [formState, setFormState] = useState(makeDefaultState);

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(makeDefaultState());
      setError(undefined);
      setResults(undefined);
    } else if (results) {
      router.refresh();
    }
    setIsOpen(open);
  }

  function handleSubmit() {
    startTransition(async () => {
      setError(undefined);
      const payload = {
        namePrefix: formState.namePrefix.trim(),
        tenantID: formState.tenantID,
        scopes: formState.scopes,
        expiresAt: toApiExpiry(formState.expiresAt),
        count: formState.count,
        rateLimitRPM: formState.rateLimitRPM || undefined,
        rateLimitBurst: formState.rateLimitBurst || undefined,
      };

      const response = await fetch("/api/admin/tokens/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as BulkTokenResponse | { error?: string } | null;

      if (!response.ok) {
        setError(result && "error" in result ? result.error || "Bulk token creation failed" : "Bulk token creation failed");
        return;
      }

      const issued = (result as BulkTokenResponse).tokens;
      setResults(issued);
      addToast("Bulk tokens issued", `${issued.length} tokens created`, "success");
    });
  }

  function handleDownload() {
    if (!results) return;
    const data = results.map((r) => ({ name: r.token.name, secret: r.secret, preview: r.token.preview, tenantID: r.token.tenantID, scopes: r.token.scopes, expiresAt: r.token.expiresAt }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tokens-${formState.namePrefix || "bulk"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canSubmit = formState.namePrefix.trim() && formState.tenantID && formState.scopes.trim() && formState.expiresAt && formState.count >= 1 && formState.count <= 100;

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button variant="secondary" isDisabled={disabled} onPress={() => setIsOpen(true)}>
        <Layers size={15} />
        Bulk generate
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="enterprise-kicker">Batch issuance</div>
              <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                Bulk generate tokens
              </Modal.Heading>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Create up to 100 tokens in one operation. All secrets are returned once and can be downloaded as JSON.
              </p>
            </Modal.Header>
            <Modal.Body className="pb-8">
              {results ? (
                <div className="space-y-4">
                  <div className="enterprise-feedback enterprise-feedback--success flex items-center gap-3 p-4">
                    <Check size={18} className="text-success" />
                    <p className="font-semibold text-foreground">{results.length} tokens issued</p>
                    <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-warning">Secrets shown once</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-panel divide-y divide-border">
                    {results.map((r) => (
                      <div key={r.token.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">{r.token.name}</span>
                        <span className="font-mono text-muted-foreground truncate max-w-[200px]">{r.secret}</span>
                        <span className="text-muted-foreground/60 shrink-0">{r.token.preview}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <Button variant="secondary" onPress={handleDownload}>
                      <Download size={14} />
                      Download JSON
                    </Button>
                    <Button variant="ghost" onPress={() => handleOpenChange(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="enterprise-panel grid items-start gap-4 p-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Name prefix</Label>
                      <Input
                        placeholder="alloy-agent"
                        required
                        value={formState.namePrefix}
                        onChange={(e) => setFormState((s) => ({ ...s, namePrefix: e.target.value }))}
                      />
                      <div className="enterprise-note">Tokens will be named prefix-1, prefix-2, …</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Count</Label>
                      <Input
                        min={1}
                        max={100}
                        type="number"
                        value={String(formState.count)}
                        onChange={(e) => setFormState((s) => ({ ...s, count: Math.min(100, Math.max(1, Number(e.target.value) || 1)) }))}
                      />
                      <div className="enterprise-note">1 – 100 tokens.</div>
                    </TextField>
                    <Select
                      className="w-full"
                      isRequired
                      placeholder="Select tenant"
                      value={formState.tenantID}
                      variant="secondary"
                      onChange={(value) => setFormState((s) => ({ ...s, tenantID: String(value) }))}
                    >
                      <Label>Tenant ID</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {tenantIDs.map((tid) => (
                            <ListBox.Item key={tid} id={tid} textValue={tid}>
                              {tid}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <TextField className="grid gap-2">
                      <Label>Scopes</Label>
                      <Input
                        placeholder="metrics:write"
                        required
                        value={formState.scopes}
                        onChange={(e) => setFormState((s) => ({ ...s, scopes: e.target.value }))}
                      />
                    </TextField>
                    <TextField className="grid gap-2 md:col-span-2">
                      <Label>Expiration</Label>
                      <Input
                        required
                        type="datetime-local"
                        value={formState.expiresAt}
                        onChange={(e) => setFormState((s) => ({ ...s, expiresAt: e.target.value }))}
                      />
                    </TextField>
                  </div>
                  <div className="enterprise-panel grid gap-4 p-4">
                    <div className="enterprise-kicker">Rate limiting (optional)</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField className="grid gap-2">
                        <Label>Requests / min</Label>
                        <Input
                          min={0}
                          placeholder="0 = unlimited"
                          type="number"
                          value={formState.rateLimitRPM === 0 ? "" : String(formState.rateLimitRPM)}
                          onChange={(e) => setFormState((s) => ({ ...s, rateLimitRPM: Number(e.target.value) || 0 }))}
                        />
                      </TextField>
                      <TextField className="grid gap-2">
                        <Label>Burst size</Label>
                        <Input
                          min={0}
                          placeholder="0 = unlimited"
                          type="number"
                          value={formState.rateLimitBurst === 0 ? "" : String(formState.rateLimitBurst)}
                          onChange={(e) => setFormState((s) => ({ ...s, rateLimitBurst: Number(e.target.value) || 0 }))}
                        />
                      </TextField>
                    </div>
                  </div>
                  {error && <div className="enterprise-feedback enterprise-feedback--error">{error}</div>}
                  <div className="flex justify-end">
                    <Button
                      className="bg-foreground text-background"
                      isDisabled={isPending || !canSubmit}
                      onPress={handleSubmit}
                    >
                      {isPending ? "Generating…" : `Generate ${formState.count} token${formState.count !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                </div>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
