"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { TenantSummary } from "@/lib/contracts";
import { Button, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
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

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState());
      setError(undefined);
      setCurrentStep(0);
      setDirection(1);
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
                ) : (
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
                        <div className="enterprise-note">Fallback origin. Load-balancing upstreams added later take precedence.</div>
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
                    {error && <div className="enterprise-feedback enterprise-feedback--error">{error}</div>}
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onPress={goBack}>
                        <ArrowLeft size={15} />
                        Back
                      </Button>
                      <Button
                        className="bg-foreground text-background"
                        isDisabled={isPending || !formState.upstreamURL.trim() || !formState.headerName.trim()}
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
