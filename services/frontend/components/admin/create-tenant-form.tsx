"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { TenantSummary } from "@/lib/contracts";
import { Button, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

interface CreateTenantFormProps {
  existingCount: number;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  onCreated?: (tenant: TenantSummary) => void;
}

function toFormState() {
  return {
    name: "",
    tenantID: "",
    upstreamURL: "",
    authMode: "header",
    headerName: "X-Scope-OrgID",
    healthCheckPath: "",
  };
}

const STEPS: StepDef[] = [
  { id: "identity", label: "Identity" },
  { id: "upstream", label: "Upstream" },
  { id: "loadbalancing", label: "Load balancing" },
];

export function CreateTenantForm({
  existingCount,
  disabled = false,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onCreated,
}: CreateTenantFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState());
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [internalOpen, setInternalOpen] = useState(false);
  const [additionalUpstreams, setAdditionalUpstreams] = useState<Array<{ url: string; weight: string }>>([]);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState());
      setError(undefined);
      setCurrentStep(0);
      setDirection(1);
      setAdditionalUpstreams([]);
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
        upstreamURL: formState.upstreamURL,
        headerName: formState.headerName,
        healthCheckPath: formState.healthCheckPath || undefined,
        authMode: formState.authMode,
      };

      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as TenantSummary | { error?: string } | null;

      if (!response.ok) {
        setError(result && "error" in result ? result.error || "Tenant creation failed" : "Tenant creation failed");
        return;
      }

      const tenant = result as TenantSummary;

      const validUpstreams = additionalUpstreams.filter((u) => u.url.trim());
      for (const u of validUpstreams) {
        await fetch(`/api/admin/tenants/${encodeURIComponent(tenant.id)}/upstreams`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ upstreamURL: u.url.trim(), weight: Number(u.weight) || 1 }),
        });
      }

      addToast("Tenant created", tenant.name, "success");
      onCreated?.(tenant);
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Plus size={16} />
          New tenant
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Create tenant</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                    New tenant
                  </Modal.Heading>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Define an isolated routing boundary that maps to one upstream endpoint.
                  </p>
                </div>
                <Chip className="border border-border bg-panel text-foreground">{existingCount} configured</Chip>
              </div>
              <div className="mt-5">
                <StepList steps={STEPS} currentStep={currentStep} />
              </div>
            </Modal.Header>
            <Modal.Body className="pb-8">
              <AnimatedStep stepKey={currentStep} direction={direction}>
                {currentStep === 0 ? (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                      <TextField className="grid gap-2">
                        <Label>Tenant name</Label>
                        <Input
                          placeholder="Acme Observability"
                          required
                          value={formState.name}
                          onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                        />
                        <div className="enterprise-note">Readable label for operators.</div>
                      </TextField>
                      <TextField className="grid gap-2">
                        <Label>Tenant ID</Label>
                        <Input
                          placeholder="acme-prod"
                          required
                          value={formState.tenantID}
                          onChange={(e) => setFormState((s) => ({ ...s, tenantID: e.target.value }))}
                        />
                        <div className="enterprise-note">Stable machine identifier injected as the upstream header value.</div>
                      </TextField>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="bg-foreground text-background"
                        isDisabled={!formState.name.trim() || !formState.tenantID.trim()}
                        onPress={goNext}
                      >
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                ) : currentStep === 1 ? (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid gap-4 p-4">
                      <TextField className="grid gap-2">
                        <Label>Default Upstream URL</Label>
                        <Input
                          placeholder="https://mimir.internal.example"
                          required
                          type="url"
                          value={formState.upstreamURL}
                          onChange={(e) => setFormState((s) => ({ ...s, upstreamURL: e.target.value }))}
                        />
                        <div className="enterprise-note">Used for direct routing when no load-balancing upstreams are configured. Bypassed completely once you add any in the next step.</div>
                      </TextField>
                      <Select
                        className="w-full"
                        placeholder="Select auth mode"
                        value={formState.authMode}
                        variant="secondary"
                        onChange={(value) => setFormState((s) => ({ ...s, authMode: String(value) }))}
                      >
                        <Label>Auth mode</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="header" textValue="header">header<ListBox.ItemIndicator /></ListBox.Item>
                            <ListBox.Item id="bearer" textValue="bearer">bearer<ListBox.ItemIndicator /></ListBox.Item>
                            <ListBox.Item id="none" textValue="none">none<ListBox.ItemIndicator /></ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <div className="enterprise-note">header — inject tenant header; bearer — forward token; none — no auth injection.</div>
                      {formState.authMode === "header" && (
                        <div className="rounded-lg border border-border bg-panel px-4 py-3 text-sm leading-6 text-muted-foreground">
                          <span className="font-semibold text-foreground">Header injection active. </span>
                          JustGate automatically sets the configured header on every proxied request, using the Tenant ID as the value — no client-side header setup needed.
                          <br />
                          <span className="mt-1 block text-[12px] text-muted-foreground/70">
                            Example: Grafana Alloy sending to Loki only needs a JustGate bearer token. JustGate injects <code className="font-mono text-[11px]">X-Scope-OrgID: &lt;tenantID&gt;</code> automatically.
                          </span>
                        </div>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextField className="grid gap-2">
                          <Label>Injected header</Label>
                          <Input
                            required
                            value={formState.headerName}
                            onChange={(e) => setFormState((s) => ({ ...s, headerName: e.target.value }))}
                          />
                          <div className="enterprise-note">Header added upstream to identify the tenant.</div>
                        </TextField>
                        <TextField className="grid gap-2">
                          <Label>Health check path</Label>
                          <Input
                            placeholder="/ready"
                            value={formState.healthCheckPath}
                            onChange={(e) => setFormState((s) => ({ ...s, healthCheckPath: e.target.value }))}
                          />
                          <div className="enterprise-note">Optional upstream probe path.</div>
                        </TextField>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onPress={goBack}>
                        <ArrowLeft size={15} />
                        Back
                      </Button>
                      <Button
                        className="bg-foreground text-background"
                        isDisabled={!formState.upstreamURL.trim() || !formState.headerName.trim()}
                        onPress={goNext}
                      >
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="enterprise-panel p-4">
                      <p className="mb-3 text-sm text-muted-foreground">
                        Optionally configure weighted load-balancing upstreams. Once any upstream is added here, the default URL from the previous step is <strong className="text-foreground font-medium">completely bypassed</strong> — all traffic routes through this pool instead.
                      </p>
                      {additionalUpstreams.length > 0 ? (
                        <div className="mb-3 space-y-2">
                          {additionalUpstreams.map((u, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                className="flex-1"
                                placeholder="https://backend-b.internal.example"
                                type="url"
                                value={u.url}
                                onChange={(e) =>
                                  setAdditionalUpstreams((prev) =>
                                    prev.map((item, idx) => (idx === i ? { ...item, url: e.target.value } : item)),
                                  )
                                }
                              />
                              <Input
                                className="w-20 shrink-0"
                                min={1}
                                placeholder="1"
                                type="number"
                                value={u.weight}
                                onChange={(e) =>
                                  setAdditionalUpstreams((prev) =>
                                    prev.map((item, idx) => (idx === i ? { ...item, weight: e.target.value } : item)),
                                  )
                                }
                              />
                              <Button
                                className="h-8 w-8 min-w-8 shrink-0 rounded-lg px-0 text-muted-foreground/60 hover:text-danger"
                                size="sm"
                                variant="ghost"
                                aria-label="Remove upstream"
                                onPress={() => setAdditionalUpstreams((prev) => prev.filter((_, idx) => idx !== i))}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          ))}
                          <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground/50">
                            <span className="flex-1 pl-1">URL</span>
                            <span className="w-20 shrink-0 pl-1">Weight</span>
                            <span className="w-8 shrink-0" />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-[12px] text-muted-foreground/50">
                          No additional upstreams — the default upstream will handle all traffic.
                        </div>
                      )}
                      <Button
                        className="h-7 gap-1.5 rounded-lg text-[12px]"
                        size="sm"
                        variant="ghost"
                        onPress={() => setAdditionalUpstreams((prev) => [...prev, { url: "", weight: "1" }])}
                      >
                        <Plus size={12} />
                        Add upstream
                      </Button>
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
                        {isPending ? "Creating…" : "Create tenant"}
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
