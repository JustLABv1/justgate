"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import { Button, Chip, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

interface CreateRouteFormProps {
  existingCount: number;
  tenantIDs: string[];
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  initialTenantID?: string;
  onCreated?: (slug: string) => void;
}

function toFormState(initialTenantID = "") {
  return {
    slug: "",
    tenantID: initialTenantID,
    targetPath: "/",
    requiredScope: "",
    methods: "POST",
    rateLimitRPM: 0,
    rateLimitBurst: 0,
    allowCIDRs: "",
    denyCIDRs: "",
  };
}

const STEPS: StepDef[] = [
  { id: "basics", label: "Basics" },
  { id: "routing", label: "Routing" },
  { id: "advanced", label: "Advanced" },
];

export function CreateRouteForm({
  existingCount,
  tenantIDs,
  disabled = false,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  initialTenantID,
  onCreated,
}: CreateRouteFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(initialTenantID));
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState(initialTenantID));
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
        slug: formState.slug,
        tenantID: formState.tenantID,
        targetPath: formState.targetPath,
        requiredScope: formState.requiredScope,
        methods: formState.methods,
        rateLimitRPM: formState.rateLimitRPM || undefined,
        rateLimitBurst: formState.rateLimitBurst || undefined,
        allowCIDRs: formState.allowCIDRs || undefined,
        denyCIDRs: formState.denyCIDRs || undefined,
      };

      const response = await fetch("/api/admin/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; slug?: string } | null;

      if (!response.ok) {
        setError(result?.error || "Failed to create route.");
        return;
      }

      const slug = result?.slug || payload.slug;
      addToast("Route registered", `/proxy/${slug}`, "success");
      onCreated?.(slug);
      handleOpenChange(false);
      router.refresh();
    });
  }

  const showPreview = Boolean(formState.slug || formState.tenantID);

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? (
        <Button className="bg-foreground text-background" isDisabled={disabled}>
          <Plus size={16} />
          New route
        </Button>
      )}
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="!max-w-3xl rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="enterprise-kicker">Create route</div>
                  <Modal.Heading className="mt-2 text-[1.9rem] leading-none tracking-[-0.04em] text-foreground">
                    Register a route
                  </Modal.Heading>
                </div>
                <Chip className="w-fit border border-border bg-panel text-foreground">{existingCount} existing</Chip>
              </div>
              {showPreview && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 font-mono text-[13px]"
                >
                  <span className="text-muted-foreground">{(formState.methods.split(",")[0] ?? "GET").trim()} </span>
                  <span className="text-accent">/proxy/{formState.slug || "…"}</span>
                  {formState.tenantID && (
                    <span className="text-muted-foreground"> → {formState.tenantID}</span>
                  )}
                  {formState.targetPath && formState.targetPath !== "/" && (
                    <span className="text-muted-foreground">{formState.targetPath}</span>
                  )}
                  {formState.requiredScope && (
                    <div className="mt-1 text-[11px] text-muted-foreground">scope: {formState.requiredScope}</div>
                  )}
                </motion.div>
              )}
              <div className="mt-5">
                <StepList steps={STEPS} currentStep={currentStep} />
              </div>
            </Modal.Header>
            <Modal.Body className="pb-8">
              <AnimatedStep stepKey={currentStep} direction={direction}>
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <div className="enterprise-panel grid items-start gap-4 p-4 md:grid-cols-2">
                      <TextField className="grid gap-2">
                        <Label>Proxy slug</Label>
                        <Input
                          placeholder="metrics-ingest"
                          required
                          value={formState.slug}
                          onChange={(e) => setFormState((s) => ({ ...s, slug: e.target.value }))}
                        />
                        <div className="enterprise-note">Stable operator-facing path segment. No slashes.</div>
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
                      <div className="enterprise-note md:col-span-2">The route is bound to exactly one tenant inventory record.</div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="bg-foreground text-background"
                        isDisabled={!formState.slug.trim() || !formState.tenantID}
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
                        <Label>Target path</Label>
                        <Input
                          placeholder="/api/v1/push"
                          required
                          value={formState.targetPath}
                          onChange={(e) => setFormState((s) => ({ ...s, targetPath: e.target.value }))}
                        />
                        <div className="enterprise-note">Appended to the tenant upstream URL.</div>
                      </TextField>
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextField className="grid gap-2">
                          <Label>Required scope</Label>
                          <Input
                            placeholder="metrics:write"
                            required
                            value={formState.requiredScope}
                            onChange={(e) => setFormState((s) => ({ ...s, requiredScope: e.target.value }))}
                          />
                          <div className="enterprise-note">Bearer token must carry this scope exactly.</div>
                        </TextField>
                        <TextField className="grid gap-2">
                          <Label>Allowed methods</Label>
                          <Input
                            placeholder="POST, PUT"
                            required
                            value={formState.methods}
                            onChange={(e) => setFormState((s) => ({ ...s, methods: e.target.value }))}
                          />
                          <div className="enterprise-note">Comma-separated HTTP verbs.</div>
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
                        isDisabled={!formState.targetPath.trim() || !formState.requiredScope.trim() || !formState.methods.trim()}
                        onPress={goNext}
                      >
                        Continue
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}
                {currentStep === 2 && (
                  <div className="space-y-5">
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
                            onChange={(e) => setFormState((s) => ({ ...s, rateLimitRPM: Number(e.target.value) || 0 }))}
                          />
                          <div className="enterprise-note">Sliding-window token bucket rate.</div>
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
                    <div className="enterprise-panel grid gap-4 p-4">
                      <div className="enterprise-kicker">CIDR filtering</div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <TextField className="grid gap-2">
                          <Label>Allow CIDRs</Label>
                          <Input
                            placeholder="10.0.0.0/8, 192.168.0.0/16"
                            value={formState.allowCIDRs}
                            onChange={(e) => setFormState((s) => ({ ...s, allowCIDRs: e.target.value }))}
                          />
                          <div className="enterprise-note">Comma-separated. Empty = allow all.</div>
                        </TextField>
                        <TextField className="grid gap-2">
                          <Label>Deny CIDRs</Label>
                          <Input
                            placeholder="203.0.113.0/24"
                            value={formState.denyCIDRs}
                            onChange={(e) => setFormState((s) => ({ ...s, denyCIDRs: e.target.value }))}
                          />
                          <div className="enterprise-note">Explicitly blocked CIDRs.</div>
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
                        <ArrowUpRight size={16} />
                        {isPending ? "Registering…" : "Register route"}
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
