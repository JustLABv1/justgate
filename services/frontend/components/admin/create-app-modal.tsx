"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { ProtectedApp } from "@/lib/contracts";
import { Button, Chip, Input, Label, Modal, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

interface CreateAppModalProps {
  disabled?: boolean;
  existingCount?: number;
  trigger?: ReactNode;
}

const AUTH_MODES = [
  { value: "oidc", label: "OIDC", desc: "Browser login via identity provider" },
  { value: "bearer", label: "Bearer", desc: "Machine-to-machine token auth" },
  { value: "any", label: "Any", desc: "OIDC browser or bearer token" },
  { value: "none", label: "None", desc: "IP filtering only, no auth" },
];

const RATE_LIMIT_PER = [
  { value: "session", label: "Session" },
  { value: "ip", label: "IP address" },
  { value: "token", label: "Token" },
];

const STEPS: StepDef[] = [
  { id: "identity", label: "Identity" },
  { id: "access", label: "Access" },
  { id: "policy", label: "Policy" },
];

function toFormState() {
  return {
    name: "",
    slug: "",
    upstreamURL: "",
    authMode: "oidc",
    allowCIDRs: "",
    denyCIDRs: "",
    rateLimitRPM: "",
    rateLimitBurst: "",
    rateLimitPer: "session",
    healthCheckPath: "",
  };
}

export function CreateAppModal({ disabled = false, existingCount, trigger }: CreateAppModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState());
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [internalOpen, setInternalOpen] = useState(false);

  function set<K extends keyof ReturnType<typeof toFormState>>(key: K, value: string) {
    setFormState((s) => ({ ...s, [key]: value }));
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState());
      setError(undefined);
      setCurrentStep(0);
      setDirection(1);
    }
    setInternalOpen(open);
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
      const body = {
        name: formState.name.trim(),
        slug: formState.slug.trim(),
        upstreamURL: formState.upstreamURL.trim(),
        authMode: formState.authMode,
        injectHeaders: [],
        stripHeaders: [],
        extraCAPEM: "",
        rateLimitRPM: Number(formState.rateLimitRPM) || 0,
        rateLimitBurst: Number(formState.rateLimitBurst) || 0,
        rateLimitPer: formState.rateLimitPer,
        allowCIDRs: formState.allowCIDRs.trim(),
        denyCIDRs: formState.denyCIDRs.trim(),
        healthCheckPath: formState.healthCheckPath.trim(),
      };

      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | ProtectedApp | null;
      if (!res.ok) {
        setError((data as { error?: string })?.error || "Failed to create app.");
        return;
      }

      addToast("App created", body.name, "success");
      handleOpenChange(false);
      router.refresh();
    });
  }

  const step0Valid = formState.name.trim() !== "" && formState.slug.trim() !== "" && formState.upstreamURL.trim() !== "";

  return (
    <Modal isOpen={internalOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Plus size={16} />
          New app
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Create protected app</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                    New app
                  </Modal.Heading>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Proxy an upstream through JustGate with access controls, IP filtering, and optional OIDC login.
                  </p>
                </div>
                {existingCount !== undefined && (
                  <Chip className="border border-border bg-panel text-foreground">{existingCount} configured</Chip>
                )}
              </div>
              <div className="mt-5">
                <StepList steps={STEPS} currentStep={currentStep} />
              </div>
            </Modal.Header>
            <Modal.Body className="pb-8">
              <AnimatedStep stepKey={currentStep} direction={direction}>

                {/* ── Step 0: Identity ── */}
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                      <TextField className="grid gap-2">
                        <Label>App name</Label>
                        <Input
                          placeholder="e.g. Grafana"
                          required
                          value={formState.name}
                          onChange={(e) => set("name", e.target.value)}
                        />
                        <div className="enterprise-note">Readable label shown in the admin UI.</div>
                      </TextField>
                      <TextField className="grid gap-2">
                        <Label>Slug</Label>
                        <Input
                          placeholder="e.g. grafana"
                          required
                          value={formState.slug}
                          onChange={(e) => set("slug", e.target.value)}
                        />
                        <div className="enterprise-note">URL-safe identifier — app is served at <code className="font-mono text-[11px]">/app/&#123;slug&#125;/</code></div>
                      </TextField>
                    </div>
                    <div className="enterprise-panel grid gap-4 p-4">
                      <TextField className="grid gap-2">
                        <Label>Upstream URL</Label>
                        <Input
                          placeholder="http://grafana:3000"
                          required
                          type="url"
                          value={formState.upstreamURL}
                          onChange={(e) => set("upstreamURL", e.target.value)}
                        />
                        <div className="enterprise-note">Target service JustGate will proxy requests to.</div>
                      </TextField>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="bg-foreground text-background"
                        isDisabled={!step0Valid}
                        onPress={goNext}
                      >
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step 1: Access ── */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid gap-4 p-4">
                      <div>
                        <Label>Auth mode</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {AUTH_MODES.map((m) => (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => set("authMode", m.value)}
                              className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors ${
                                formState.authMode === m.value
                                  ? "border-foreground bg-foreground/5 text-foreground"
                                  : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                              }`}
                            >
                              <span className="text-sm font-semibold">{m.label}</span>
                              <span className="text-[12px] leading-4">{m.desc}</span>
                            </button>
                          ))}
                        </div>
                        <div className="enterprise-note mt-2">
                          {formState.authMode === "none"
                            ? "All requests are forwarded directly. Only IP rules below apply."
                            : formState.authMode === "bearer"
                              ? "Requests must carry a valid app bearer token. No browser login is triggered."
                              : "Users without a session are redirected to the OIDC provider to log in."}
                        </div>
                      </div>
                    </div>
                    <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                      <TextField className="grid gap-2">
                        <Label>Allow CIDRs</Label>
                        <Input
                          placeholder="10.0.0.0/8, 192.168.1.0/24"
                          value={formState.allowCIDRs}
                          onChange={(e) => set("allowCIDRs", e.target.value)}
                        />
                        <div className="enterprise-note">Comma-separated. Only these source IPs are allowed. Leave empty to allow all.</div>
                      </TextField>
                      <TextField className="grid gap-2">
                        <Label>Deny CIDRs</Label>
                        <Input
                          placeholder="203.0.113.0/24"
                          value={formState.denyCIDRs}
                          onChange={(e) => set("denyCIDRs", e.target.value)}
                        />
                        <div className="enterprise-note">Comma-separated. Requests from these IPs are rejected before authentication.</div>
                      </TextField>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onPress={goBack}>
                        <ArrowLeft size={15} />
                        Back
                      </Button>
                      <Button className="bg-foreground text-background" onPress={goNext}>
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Policy ── */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid gap-4 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <TextField className="grid gap-2">
                          <Label>Rate limit (RPM)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0 = unlimited"
                            value={formState.rateLimitRPM}
                            onChange={(e) => set("rateLimitRPM", e.target.value)}
                          />
                          <div className="enterprise-note">Max requests per minute.</div>
                        </TextField>
                        <TextField className="grid gap-2">
                          <Label>Burst</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0 = same as RPM"
                            value={formState.rateLimitBurst}
                            onChange={(e) => set("rateLimitBurst", e.target.value)}
                          />
                          <div className="enterprise-note">Allowed burst above the RPM limit.</div>
                        </TextField>
                      </div>
                      <div className="grid gap-2">
                        <Label>Rate per</Label>
                        <div className="flex gap-2">
                          {RATE_LIMIT_PER.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => set("rateLimitPer", p.value)}
                              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium text-center transition-colors ${
                                formState.rateLimitPer === p.value
                                  ? "border-foreground bg-foreground/5 text-foreground"
                                  : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TextField className="grid gap-2">
                        <Label>Health check path <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                          placeholder="/healthz"
                          value={formState.healthCheckPath}
                          onChange={(e) => set("healthCheckPath", e.target.value)}
                        />
                        <div className="enterprise-note">JustGate will probe this path on the upstream to monitor availability.</div>
                      </TextField>
                    </div>
                    {error && <div className="enterprise-feedback enterprise-feedback--error">{error}</div>}
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onPress={goBack}>
                        <ArrowLeft size={15} />
                        Back
                      </Button>
                      <Button
                        className="bg-foreground text-background"
                        isDisabled={isPending}
                        onPress={handleSubmit}
                      >
                        {isPending ? "Creating…" : "Create app"}
                      </Button>
                    </div>
                  </div>
                )}

              </AnimatedStep>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
