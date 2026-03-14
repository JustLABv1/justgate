"use client";

import { useToast } from "@/components/toast-provider";
import { Button, Form, Input, Label, Modal, TextField } from "@heroui/react";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface AddMemberModalProps {
  orgID: string;
  isOwner: boolean;
}

export function AddMemberModal({ orgID, isOwner }: AddMemberModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);


    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim();
      const role = String(formData.get("role") || "member");

      if (!email) {
        setError("Email is required.");
        return;
      }

      const res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgID)}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 404) {
          setError("No account found for that email. The user must sign in at least once before they can be added.");
        } else {
          setError(data?.error || "Failed to add member.");
        }
        return;
      }

      addToast("Member added", `${data?.userEmail || email} joined as ${role}`, "success");
      form.reset();
      router.refresh();
      setIsOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setError(undefined);
  }

  if (!isOwner) return null;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(true); }}>
      <Button
        variant="secondary"
        size="sm"
        className="gap-2"
        onPress={() => setIsOpen(true)}
      >
        <UserPlus size={14} />
        Add member
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="rounded-2xl border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-xl font-semibold tracking-tight">Add member</Modal.Heading>
              <p className="mt-1 text-sm text-muted-foreground">Add an existing user directly to your organisation by email.</p>
            </Modal.Header>
            <Modal.Body className="pb-6">
              <Form onSubmit={handleSubmit} className="space-y-5">
                <TextField name="email" isRequired className="w-full">
                  <Label className="text-sm font-medium text-foreground">Email address</Label>
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                  />
                </TextField>

                <div className="w-full">
                  <label htmlFor="role" className="text-sm font-medium text-foreground">Role</label>
                  <select
                    id="role"
                    name="role"
                    defaultValue="member"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

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
                    <UserPlus size={14} />
                    {isPending ? "Adding…" : "Add member"}
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
