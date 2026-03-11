"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@heroui/react";
import { ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface RevokeTokenButtonProps {
  tokenID: string;
  disabled?: boolean;
  label?: string;
}

export function RevokeTokenButton({ tokenID, disabled, label = "Revoke" }: RevokeTokenButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    startTransition(async () => {
      setError(undefined);

      const response = await fetch(`/api/admin/tokens/${tokenID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "token revoke failed");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <ConfirmDialog
        trigger={(open) => (
          <Button
            className="h-8 rounded-full border border-border/60 bg-panel px-3 text-muted-foreground hover:border-warning/40 hover:bg-warning/8 hover:text-warning"
            isDisabled={disabled || isPending}
            onPress={open}
            size="sm"
            variant="ghost"
          >
            <ShieldOff size={13} />
            {label}
          </Button>
        )}
        title="Revoke token?"
        description="The credential will stop working immediately. Any service currently using it will lose access. This cannot be undone."
        confirmLabel={isPending ? "Revoking…" : "Revoke token"}
        isPending={isPending}
        onConfirm={handleRevoke}
        variant="warning"
      />
      {error ? <div className="text-[11px] text-warning">{error}</div> : null}
    </div>
  );
}