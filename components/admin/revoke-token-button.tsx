"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface RevokeTokenButtonProps {
  tokenID: string;
  disabled?: boolean;
}

export function RevokeTokenButton({ tokenID, disabled }: RevokeTokenButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function handleRevoke() {
    setError(undefined);

    const response = await fetch(`/api/admin/tokens/${tokenID}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ active: false }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "token revoke failed");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        className="bg-slate-950 text-white"
        isDisabled={disabled || isPending}
        onPress={handleRevoke}
      >
        {isPending ? "Revoking..." : "Revoke"}
      </Button>
      {error ? <div className="text-xs text-amber-800">{error}</div> : null}
    </div>
  );
}