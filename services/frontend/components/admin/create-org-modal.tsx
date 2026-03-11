"use client";

import type { OrgSummary } from "@/lib/contracts";
import { Button, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { Building2, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

interface CreateOrgModalProps {
  onCreated?: (org: OrgSummary) => void;
}

export function CreateOrgModal({ onCreated }: CreateOrgModalProps = {}) {
  const { update } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      setError("Organisation name is required.");
      return;
    }

    const res = await fetch("/api/admin/orgs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error || "Failed to create organisation.");
      return;
    }

    const org = data as OrgSummary;
    await update({ activeOrgId: org.id });
    setIsOpen(false);
    onCreated?.(org);
    startTransition(() => router.refresh());
  }

  function handleClose() {
    setIsOpen(false);
    setError(undefined);
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(true); }}>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
      >
        <Plus size={14} />
        New organisation
      </button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="rounded-2xl border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-xl font-semibold tracking-tight">Create organisation</Modal.Heading>
              <p className="mt-1 text-sm text-muted-foreground">Create a new organisation to separate tenants, routes, and tokens.</p>
            </Modal.Header>
            <Modal.Body className="pb-6">
              <Form onSubmit={handleSubmit} className="space-y-5">
                <TextField name="name" isRequired className="w-full">
                  <Label className="text-sm font-medium text-foreground">Organisation name</Label>
                  <Input
                    placeholder="e.g. Acme Corp"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                  />
                </TextField>

                {error && (
                  <p className="text-sm text-danger">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onPress={handleClose}>Cancel</Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
                    isDisabled={isPending}
                  >
                    <Building2 size={14} />
                    {isPending ? "Creating…" : "Create"}
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
