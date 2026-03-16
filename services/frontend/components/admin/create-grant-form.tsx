"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { IssuedGrant } from "@/lib/contracts";
import { Button, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, Copy, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useState, useTransition } from "react";

interface CreateGrantFormProps {
  existingCount: number;
  tenantIDs: string[];
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
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
    name: "",
    tenantID: "",
    scopes: "",
    expiresAt: "",
    tokenTTLHours: 720,
    maxUses: 10,
    rateLimitRPM: 0,
    rateLimitBurst: 0,
  };
}

const STEPS: StepDef[] = [
  { id: "identity", label: "Identity" },
  { id: "policy", label: "Policy" },
];

export function CreateGrantForm({
  existingCount,
  tenantIDs,
  disabled = false,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: CreateGrantFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [issuedGrant, setIssuedGrant] = useState<IssuedGrant>();
  const [formState, setFormState] = useState(makeDefaultState);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [copied, setCopied] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);
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
      setFormState(makeDefaultState());
      setError(undefined);
      setIssuedGrant(undefined);
      setCurrentStep(0);
      setDirection(1);
      setPendingReload(false);
    } else if (pendingReload) {
      setPendingReload(false);
      router.refresh();
    }
    if (!isControlled) setInternalOpen(open);
    controlledOnOpenChange?.(open);
  }

  function goNext() {
    setDirection(1);
    setCurrentStep((s) => s + 1);
    setError(undefined);
  }

  function goBack() {
    setDirection(-1);
    setCurrentStep((s) => s - 1);
    setError(undefined);
  }

  function handleSubmit() {
    startTransition(async () => {
      setError(undefined);
      const payload = {
        name: formState.name,
        tenantID: formState.tenantID,
        scopes: formState.scopes,
        expiresAt: toApiExpiry(formState.expiresAt),
        tokenTTLHours: formState.tokenTTLHours || 720,
        maxUses: formState.maxUses || 10,
        rateLimitRPM: formState.rateLimitRPM || undefined,
        rateLimitBurst: formState.rateLimitBurst || undefined,
      };

      const response = await fetch("/api/admin/grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as IssuedGrant | { error?: string } | null;

      if (!response.ok) {
        setError(result && "error" in result ? result.error || "Grant creation failed" : "Grant creation failed");
        return;
      }

      const issued = result as IssuedGrant;
      setIssuedGrant(issued);
      setPendingReload(true);
      addToast("Grant created", issued.grant.name, "success");
    });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Share2 size={16} />
          New grant
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Dynamic provisioning</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                    Create provisioning grant
                  </Modal.Heading>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Agents call the provision endpoint with this grant secret to self-issue their own token.
                  </p>
                </div>
                <Chip className="border border-border bg-panel text-foreground">{existingCount} active</Chip>
              </div>
              {!issuedGrant && (
                <div className="mt-5">
                  <StepList steps={STEPS} currentStep={currentStep} />
                </div>
              )}
            </Modal.Header>
            <Modal.Body className="pb-8">
              {issuedGrant ? (
                <AnimatedStep stepKey="result" direction={1}>
                  <div className="enterprise-feedback enterprise-feedback--success space-y-4 p-5">
                    <div className="flex items-center gap-3">
                      <Check size={20} className="text-success" />
                      <p className="font-semibold text-foreground">Grant created — copy the secret now</p>
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-warning">Shown once</span>
                    </div>
                    <div className="rounded-[0.7rem] border border-border/50 bg-panel/60 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
                      <div><span className="font-medium text-foreground">Provision endpoint:</span> <code className="font-mono">POST /api/v1/provision</code></div>
                      <div><span className="font-medium text-foreground">Payload:</span> <code className="font-mono">{`{"grantSecret":"<secret>","agentName":"<name>"}`}</code></div>
                      <div><span className="font-medium text-foreground">Issued token TTL:</span> {issuedGrant.grant.tokenTTLHours}h · Max uses: {issuedGrant.grant.maxUses}</div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 rounded-[0.9rem] border border-border/70 bg-background/75 px-3 py-3 font-mono text-sm break-all text-foreground select-all">
                        {issuedGrant.secret}
                      </div>
                      <Button
                        className="mt-1 h-9 w-9 min-w-9 shrink-0 rounded-xl border border-border bg-surface px-0 text-muted-foreground hover:text-foreground"
                        onPress={() => handleCopySecret(issuedGrant.secret)}
                        size="sm"
                        variant="ghost"
                        aria-label="Copy secret"
                      >
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Preview: {issuedGrant.grant.preview}</div>
                    <div className="flex justify-end pt-2">
                      <Button variant="secondary" onPress={() => handleOpenChange(false)}>
                        Done &amp; close
                      </Button>
                    </div>
                  </div>
                </AnimatedStep>
              ) : (
                <AnimatedStep stepKey={currentStep} direction={direction}>
                  {currentStep === 0 && (
                    <div className="space-y-5">
                      <div className="enterprise-panel grid items-start gap-4 p-4 md:grid-cols-2">
                        <TextField className="grid gap-2 md:col-span-2">
                          <Label>Grant name</Label>
                          <Input
                            placeholder="alloy-metrics-fleet"
                            required
                            value={formState.name}
                            onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                          />
                          <div className="enterprise-note">Descriptive label for this provisioning grant.</div>
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
                        <TextField className="grid gap-2 md:col-span-2">
                          <Label>Scopes</Label>
                          <Input
                            placeholder="metrics:write, rules:read"
                            required
                            value={formState.scopes}
                            onChange={(e) => setFormState((s) => ({ ...s, scopes: e.target.value }))}
                          />
                          <div className="enterprise-note">Scopes granted to each token issued through this grant.</div>
                        </TextField>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          className="bg-foreground text-background"
                          isDisabled={!formState.name.trim() || !formState.tenantID || !formState.scopes.trim()}
                          onPress={goNext}
                        >
                          Continue
                          <ArrowRight size={15} />
                        </Button>
                      </div>
                    </div>
                  )}
                  {currentStep === 1 && (
                    <div className="space-y-5">
                      <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                        <TextField className="grid gap-2 md:col-span-2">
                          <Label>Grant expiration</Label>
                          <Input
                            required
                            type="datetime-local"
                            value={formState.expiresAt}
                            onChange={(e) => setFormState((s) => ({ ...s, expiresAt: e.target.value }))}
                          />
                          <div className="enterprise-note">After this time, the grant can no longer be used to issue tokens.</div>
                        </TextField>
                        <TextField className="grid gap-2">
                          <Label>Token TTL (hours)</Label>
                          <Input
                            min={1}
                            placeholder="720"
                            type="number"
                            value={formState.tokenTTLHours === 720 ? "720" : String(formState.tokenTTLHours)}
                            onChange={(e) => setFormState((s) => ({ ...s, tokenTTLHours: Number(e.target.value) || 720 }))}
                          />
                          <div className="enterprise-note">Lifetime of each issued token in hours (default 720 = 30d).</div>
                        </TextField>
                        <TextField className="grid gap-2">
                          <Label>Max uses</Label>
                          <Input
                            min={1}
                            placeholder="10"
                            type="number"
                            value={formState.maxUses === 10 ? "10" : String(formState.maxUses)}
                            onChange={(e) => setFormState((s) => ({ ...s, maxUses: Number(e.target.value) || 10 }))}
                          />
                          <div className="enterprise-note">How many agents can provision via this grant.</div>
                        </TextField>
                      </div>
                      <div className="enterprise-panel grid gap-4 p-4">
                        <div className="enterprise-kicker">Rate limiting for issued tokens (optional)</div>
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
                      <div className="flex items-center justify-between gap-3">
                        <Button variant="ghost" onPress={goBack}>
                          <ArrowLeft size={15} />
                          Back
                        </Button>
                        <Button
                          className="bg-foreground text-background"
                          isDisabled={isPending || !formState.expiresAt.trim()}
                          onPress={handleSubmit}
                        >
                          {isPending ? "Creating…" : "Create grant"}
                        </Button>
                      </div>
                    </div>
                  )}
                </AnimatedStep>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
