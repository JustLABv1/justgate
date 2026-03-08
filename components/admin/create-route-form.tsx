"use client";

import type { ReactNode } from "react";
import { Button, Chip, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

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
    targetPath: "",
    requiredScope: "",
    methods: "",
  };
}

export function CreateRouteForm({
  existingCount,
  tenantIDs,
  disabled = false,
  isOpen,
  onOpenChange,
  trigger,
  initialTenantID,
  onCreated,
}: CreateRouteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(initialTenantID));

  function handleOpenChange(open: boolean) {
    if (open) {
      setFormState(toFormState(initialTenantID));
      setError(undefined);
      setSuccess(undefined);
    }

    onOpenChange?.(open);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    const payload = {
      slug: formState.slug,
      tenantID: formState.tenantID,
      targetPath: formState.targetPath,
      requiredScope: formState.requiredScope,
      methods: formState.methods,
    };

    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as { error?: string; slug?: string } | null;
    if (!response.ok) {
      setError(result?.error || "Failed to create route.");
      return;
    }

    setSuccess(`Created /proxy/${result?.slug || payload.slug}.`);
    setFormState(toFormState(initialTenantID));
    startTransition(() => {
      router.refresh();
    });
    onCreated?.(result?.slug || payload.slug);
    onOpenChange?.(false);
  }

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
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Create</div>
                  <Modal.Heading className="mt-2 text-3xl leading-none tracking-[-0.03em] text-foreground">Register a route</Modal.Heading>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Publish a stable proxy slug and bind it to one tenant-specific upstream path with a narrow method and scope contract.
                  </p>
                </div>
                <Chip className="w-fit bg-background text-foreground ring-1 ring-border">{existingCount} existing routes</Chip>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Proxy slug</Label>
                    <Input
                      placeholder="metrics-ingest"
                      required
                      value={formState.slug}
                      onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
                    />
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
                </div>

                <TextField className="grid gap-2">
                  <Label>Target path</Label>
                  <Input
                    placeholder="/api/v1/push"
                    required
                    value={formState.targetPath}
                    onChange={(event) => setFormState((current) => ({ ...current, targetPath: event.target.value }))}
                  />
                </TextField>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Required scope</Label>
                    <Input
                      placeholder="metrics:write"
                      required
                      value={formState.requiredScope}
                      onChange={(event) => setFormState((current) => ({ ...current, requiredScope: event.target.value }))}
                    />
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Allowed methods</Label>
                    <Input
                      placeholder="POST, PUT"
                      required
                      value={formState.methods}
                      onChange={(event) => setFormState((current) => ({ ...current, methods: event.target.value }))}
                    />
                  </TextField>
                </div>

                <Button className="mt-2 w-full bg-foreground text-background" isDisabled={isPending} type="submit">
                  <ArrowUpRight size={16} />
                  {isPending ? "Registering route..." : "Register route"}
                </Button>
                {error ? (
                  <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                    {success}
                  </div>
                ) : null}
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}