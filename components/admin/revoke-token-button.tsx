"use client";

import { Button } from "@heroui/react";
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
    <div className="space-y-2">
      <Button
        className="h-8 rounded-full bg-foreground px-3 text-background"
        isDisabled={disabled || isPending}
        onPress={handleRevoke}
        size="sm"
      >
        {isPending ? "Revoking..." : label}
      </Button>
      {error ? <div className="text-xs text-amber-800">{error}</div> : null}
    </div>
  );
}