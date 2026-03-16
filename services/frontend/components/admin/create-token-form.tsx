"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { IssuedToken } from "@/lib/contracts";
import { Button, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, Copy, Plus } from "lucide-react";
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
  if (!trimmed) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return trimmed;
}

function toFormState(initialTenantID = "", initialScopes = "") {
  return {
    name: "",
    tenantID: initialTenantID,
    scopes: initialScopes,
    expiresAt: "",
    rateLimitRPM: 0,
    rateLimitBurst: 0,
  };
}

const STEPS: StepDef[] = [
  { id: "identity", label: "Identity" },
  { id: "policy", label: "Policy" },
];

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
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<IssuedToken>();
  const [formState, setFormState] = useState(() => toFormState(initialTenantID, initialScopes));
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
      setFormState(toFormState(initialTenantID, initialScopes));
      setError(undefined);
      setIssuedToken(undefined);
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
        setError(result && "error" in result ? result.error || "Token issue failed" : "Token issue failed");
        return;
      }

      const issued = result as IssuedToken;
      setIssuedToken(issued);
      setPendingReload(true);
      addToast("Token issued", issued.token.name, "success");
      onCreated?.(issued);
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
          <Modal.Dialog className="!max-w-3xl rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Issue credential</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                    Issue token
                  </Modal.Heading>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Go generates the credential, stores only the hash, and returns the secret once.
                  </p>
                </div>
                <Chip className="border border-border bg-panel text-foreground">{existingCount} known</Chip>
              </div>
              {!issuedToken && (
                <div className="mt-5">
                  <StepList steps={STEPS} currentStep={currentStep} />
                </div>
              )}
            </Modal.Header>
            <Modal.Body className="pb-8">
              {issuedToken ? (
                <AnimatedStep stepKey="result" direction={1}>
                  <div className="enterprise-feedback enterprise-feedback--success space-y-4 p-5">
                    <div className="flex items-center gap-3">
                      <Check size={20} className="text-success" />
                      <p className="font-semibold text-foreground">Token issued — copy the secret now</p>
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-warning">Shown once</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 rounded-[0.9rem] border border-border/70 bg-background/75 px-3 py-3 font-mono text-sm break-all text-foreground select-all">
                        <span className="text-muted-foreground select-none">Bearer </span>{issuedToken.secret}
                      </div>
                      <Button
                        className="mt-1 h-9 w-9 min-w-9 shrink-0 rounded-xl border border-border bg-surface px-0 text-muted-foreground hover:text-foreground"
                        onPress={() => handleCopySecret(`Bearer ${issuedToken.secret}`)}
                        size="sm"
                        variant="ghost"
                        aria-label="Copy secret"
                      >
                        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Preview: {issuedToken.token.preview} &nbsp;·&nbsp; Copy button includes the <code className="font-mono">Bearer </code> prefix</div>
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
                          <Label>Token name</Label>
                          <Input
                            placeholder="grafana-writer"
                            required
                            value={formState.name}
                            onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                          />
                          <div className="enterprise-note">Readable client or workload identifier.</div>
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
                          <div className="enterprise-note">Token is only accepted on routes whose required scope matches one of these values.</div>
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
                      <div className="enterprise-panel grid gap-4 p-4">
                        <TextField className="grid gap-2">
                          <Label>Expiration</Label>
                          <Input
                            required
                            type="datetime-local"
                            value={formState.expiresAt}
                            onChange={(e) => setFormState((s) => ({ ...s, expiresAt: e.target.value }))}
                          />
                          <div className="enterprise-note">Local timestamp when this token becomes invalid.</div>
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
                            <div className="enterprise-note">Overrides the route-level rate limit.</div>
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
                            <div className="enterprise-note">Maximum concurrent requests.</div>
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
                          {isPending ? "Issuing…" : "Issue token"}
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
