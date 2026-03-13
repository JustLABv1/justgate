"use client";

import type { RouteSummary } from "@/lib/contracts";
import { Button, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowUpRight, PenSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { type FormEvent, useState, useTransition } from "react";

interface UpdateRouteFormProps {
  route: RouteSummary;
  tenantIDs: string[];
  label?: string;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
}

function toFormState(route: RouteSummary | undefined) {
  return {
    routeID: route?.id || "",
    slug: route?.slug || "",
    tenantID: route?.tenantID || "",
    targetPath: route?.targetPath || "",
    requiredScope: route?.requiredScope || "",
    methods: route?.methods.join(", ") || "",
    rateLimitRPM: route?.rateLimitRPM ?? 0,
    rateLimitBurst: route?.rateLimitBurst ?? 0,
    allowCIDRs: route?.allowCIDRs ?? "",
    denyCIDRs: route?.denyCIDRs ?? "",
  };
}

export function UpdateRouteForm({ route, tenantIDs, label = "Edit", disabled = false, isOpen: controlledIsOpen, onOpenChange: controlledOnOpenChange, trigger }: UpdateRouteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(route));
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  function handleOpenChange(open: boolean) {
    if (!isControlled) setInternalOpen(open);
    controlledOnOpenChange?.(open);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(undefined);
      setSuccess(undefined);

      const response = await fetch(`/api/admin/routes/${route.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: formState.slug,
          tenantID: formState.tenantID,
          targetPath: formState.targetPath,
          requiredScope: formState.requiredScope,
          methods: formState.methods,
          rateLimitRPM: formState.rateLimitRPM || undefined,
          rateLimitBurst: formState.rateLimitBurst || undefined,
          allowCIDRs: formState.allowCIDRs || undefined,
          denyCIDRs: formState.denyCIDRs || undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as RouteSummary | { error?: string } | null;

      if (!response.ok) {
        setError(result && "error" in result ? result.error || "route update failed" : "route update failed");
        return;
      }

      setSuccess(`Updated /proxy/${(result as RouteSummary).slug}.`);
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
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div>
                <div className="enterprise-kicker">Update route</div>
                <Modal.Heading className="mt-2 text-[1.9rem] leading-none tracking-[-0.04em] text-foreground">Tune this route</Modal.Heading>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  Adjust route policy in place without changing the agent-facing control surface pattern.
                </p>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Proxy slug</Label>
                    <Input
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, slug: event.target.value }))
                      }
                      value={formState.slug}
                    />
                    <div className="enterprise-note">Public operator path segment.</div>
                  </TextField>
                  <Select
                    className="w-full"
                    isRequired
                    placeholder="Select tenant"
                    value={formState.tenantID}
                    variant="secondary"
                    onChange={(value) => setFormState((current) => ({ ...current, tenantID: String(value) }))}
                  >
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
                  <div className="enterprise-note md:col-span-2">Changing tenant reassociates the route with a different upstream boundary.</div>
                </div>
                <div className="enterprise-panel grid gap-4 p-4">
                  <TextField className="grid gap-2">
                    <Label>Target path</Label>
                    <Input
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, targetPath: event.target.value }))
                      }
                      value={formState.targetPath}
                    />
                    <div className="enterprise-note">Relative path appended to the tenant upstream URL.</div>
                  </TextField>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Required scope</Label>
                      <Input
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, requiredScope: event.target.value }))
                        }
                        value={formState.requiredScope}
                      />
                      <div className="enterprise-note">Credential permission gate.</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Allowed methods</Label>
                      <Input
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, methods: event.target.value }))
                        }
                        value={formState.methods}
                      />
                      <div className="enterprise-note">Comma-separated HTTP verbs.</div>
                    </TextField>
                  </div>
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
                      <div className="enterprise-note">Sliding-window token bucket replenishment rate.</div>
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField className="grid gap-2">
                      <Label>Allow CIDRs</Label>
                      <Input
                        placeholder="10.0.0.0/8, 192.168.0.0/16"
                        value={formState.allowCIDRs}
                        onChange={(event) => setFormState((current) => ({ ...current, allowCIDRs: event.target.value }))}
                      />
                      <div className="enterprise-note">Comma-separated CIDRs. Empty = allow all.</div>
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Deny CIDRs</Label>
                      <Input
                        placeholder="203.0.113.0/24"
                        value={formState.denyCIDRs}
                        onChange={(event) => setFormState((current) => ({ ...current, denyCIDRs: event.target.value }))}
                      />
                      <div className="enterprise-note">Comma-separated CIDRs that are explicitly blocked.</div>
                    </TextField>
                  </div>
                </div>
                <Button className="mt-1 h-11 w-full rounded-[1rem] bg-foreground text-background" isDisabled={isPending} type="submit">
                  <ArrowUpRight size={16} />
                  {isPending ? "Updating route..." : "Update route"}
                </Button>
                {error ? <div className="enterprise-feedback enterprise-feedback--error">{error}</div> : null}
                {success ? <div className="enterprise-feedback enterprise-feedback--success">{success}</div> : null}
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}