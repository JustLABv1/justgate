"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { IssuedToken } from "@/lib/contracts";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface RotateTokenButtonProps {
  tokenID: string;
  disabled?: boolean;
}

export function RotateTokenButton({ tokenID, disabled = false }: RotateTokenButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleRotate() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/tokens/${tokenID}/rotate`, { method: "POST" });
      const data = (await res.json()) as IssuedToken | { error: string };
      if ("secret" in data) {
        setNewSecret(data.secret);
        // Refresh happens when user closes the modal so the revoked token is visible
      }
    });
  }

  function copySecret() {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function closeModal() {
    setNewSecret(null);
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        trigger={(open) => (
          <button
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-panel hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            disabled={disabled || isPending}
            onClick={open}
            title="Rotate token — issues a new secret and revokes this one"
            type="button"
          >
            <RefreshCw size={11} />
            {isPending ? "Rotating…" : "Rotate"}
          </button>
        )}
        title="Rotate this token?"
        description="A new secret will be issued for this token. The current secret will stop working immediately. You must copy the new secret before closing — it cannot be retrieved again."
        confirmLabel="Rotate token"
        isPending={isPending}
        onConfirm={handleRotate}
      />

      {/* New-secret modal */}
      {newSecret && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
            onKeyDown={() => {}}
            role="presentation"
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Token rotated</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Copy your new secret now. This is the only time it will be shown.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-sm text-foreground select-all">
                {newSecret}
              </span>
              <button
                type="button"
                onClick={copySecret}
                className="shrink-0 flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground/70">
              The old token has been revoked and will no longer authorize requests.
            </p>

            <button
              type="button"
              onClick={closeModal}
              className="mt-5 w-full rounded-lg border border-border bg-panel py-2 text-sm font-medium text-foreground hover:bg-surface transition-colors"
            >
              Done
            </button>
          </div>
        </>
      )}
    </>
  );
}
