"use client";

import type { InviteResult } from "@/lib/contracts";
import { Button, Form, Modal } from "@heroui/react";
import { Check, Copy, Link } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";

interface InviteModalProps {
  orgID: string;
  isOwner: boolean;
}

export function InviteModal({ orgID, isOwner }: InviteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [invite, setInvite] = useState<InviteResult>();
  const [copied, setCopied] = useState(false);

  const inviteUrl = invite ? `${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${encodeURIComponent(invite.code)}` : "";

  const handleCopy = useCallback(() => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);

    try {
      const res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgID)}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to create invite.");
        return;
      }

      setInvite(data as InviteResult);
    } finally {
      setIsPending(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setInvite(undefined);
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
        <Link size={14} />
        Invite member
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="rounded-2xl border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-xl font-semibold tracking-tight">Invite to organisation</Modal.Heading>
              <p className="mt-1 text-sm text-muted-foreground">Generate a single-use invite link (valid 7 days, up to 10 uses).</p>
            </Modal.Header>
            <Modal.Body className="pb-6">
              {invite ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Share this link with the person you want to invite. It expires on {new Date(invite.expiresAt).toLocaleDateString()}.</p>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 rounded-xl border border-border bg-background p-3 font-mono text-xs break-all select-all">
                      {inviteUrl}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-9 w-9 min-w-9 shrink-0 rounded-xl border border-border bg-surface px-0 text-muted-foreground"
                      onPress={handleCopy}
                      aria-label="Copy link"
                    >
                      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="secondary" onPress={handleClose}>Done</Button>
                  </div>
                </div>
              ) : (
                <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {error && (
                    <div className="enterprise-feedback enterprise-feedback--error">{error}</div>
                  )}
                  <Button
                    type="submit"
                    className="h-10 rounded-[1rem] bg-foreground text-background"
                    isDisabled={isPending}
                  >
                    {isPending ? "Generating…" : "Generate invite link"}
                  </Button>
                </Form>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
