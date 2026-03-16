"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { TenantSummary } from "@/lib/contracts";
import { Button, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Info, PenSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

interface UpdateTenantFormProps {
  tenant: TenantSummary;
  label?: string;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
}

function toFormState(tenant: TenantSummary | undefined) {
  return {
    name: tenant?.name || "",
    tenantID: tenant?.tenantID || "",
    upstreamURL: tenant?.upstreamURL || "",
    authMode: tenant?.authMode || "header",
    headerName: tenant?.headerName || "X-Scope-OrgID",
    healthCheckPath: tenant?.healthCheckPath || "",
  };
}

const STEPS: StepDef[] = [
  { id: "identity", label: "Identity" },
  { id: "upstream", label: "Upstream" },
];

export function UpdateTenantForm({
  tenant,
  label = "Edit",
  disabled = false,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: UpdateTenantFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(tenant));
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState(tenant));
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

      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          tenantID: formState.tenantID,
          upstreamURL: formState.upstreamURL,
          authMode: formState.authMode,
          headerName: formState.headerName,
          healthCheckPath: formState.healthCheckPath || undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as TenantSummary | { error?: string } | null;

      if (!response.ok) {
        setError(result && "error" in result ? result.error || "Tenant update failed" : "Tenant update failed");
        return;
      }

      addToast("Tenant updated", formState.tenantID, "success");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="h-8 rounded-full px-3 text-foreground" isDisabled={disabled} size="sm" variant="ghost">
          <PenSquare size={14} />
          {label}
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="!max-w-3xl rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div>
                <div className="enterprise-kicker">Update tenant</div>
                <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                  Edit tenant
                </Modal.Heading>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Change the upstream target or header for {tenant.tenantID}.
                </p>
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
                          value={formState.name}
                          onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                        />
                        <div className="enterprise-note">Readable operator label.</div>
                      </TextField>
                      <TextField className="grid gap-2">
                        <Label>Tenant ID</Label>
                        <Input
                          value={formState.tenantID}
                          onChange={(e) => setFormState((s) => ({ ...s, tenantID: e.target.value }))}
                        />
                        <div className="enterprise-note">Stable machine identifier.</div>
                      </TextField>
                    </div>
                    <div className="flex justify-end">
                      <Button className="bg-foreground text-background" onPress={goNext}>
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid gap-4 p-4">
                      {(tenant.upstreams?.length ?? 0) > 0 && (
                        <div className="flex items-start gap-1.5 rounded-lg bg-warning/8 px-2.5 py-2 text-[12px] text-warning/80">
                          <Info size={12} className="mt-0.5 shrink-0" />
                          <span>
                            This tenant has {tenant.upstreams!.length} load-balancing upstream{tenant.upstreams!.length !== 1 ? "s" : ""} configured.
                            The default URL below is currently bypassed — all traffic routes through the LB pool.
                          </span>
                        </div>
                      )}
                      <TextField className="grid gap-2">
                        <Label>Default Upstream URL</Label>
                        <Input
                          value={formState.upstreamURL}
                          onChange={(e) => setFormState((s) => ({ ...s, upstreamURL: e.target.value }))}
                        />
                        <div className="enterprise-note">
                          {(tenant.upstreams?.length ?? 0) > 0
                            ? "Currently bypassed. Only used if all load-balancing upstreams are removed."
                            : "Used for routing when no load-balancing upstreams are configured."}
                        </div>
                      </TextField>
                      <Select
                        className="w-full"
                        placeholder="Select auth mode"
                        value={formState.authMode}
                        variant="secondary"
                        onChange={(value) => setFormState((s) => ({ ...s, authMode: String(value) }))}
                      >
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
                            value={formState.headerName}
                            onChange={(e) => setFormState((s) => ({ ...s, headerName: e.target.value }))}
                          />
                          <div className="enterprise-note">Tenant identity header added upstream.</div>
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
                        isDisabled={isPending}
                        onPress={handleSubmit}
                      >
                        {isPending ? "Updating…" : "Update tenant"}
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
