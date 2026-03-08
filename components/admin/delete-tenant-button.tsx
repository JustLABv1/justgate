"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface DeleteTenantButtonProps {
  tenantID: string;
  label?: string;
  disabled?: boolean;
}

export function DeleteTenantButton({ tenantID, label = "Delete", disabled = false }: DeleteTenantButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    setError(undefined);

    const response = await fetch(`/api/admin/tenants/${tenantID}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "tenant delete failed");
      return;
    }

    startTransition(() => {
      router.refresh();
      window.location.reload();
    });
  }

  return (
    <div className="space-y-2">
      <Button className="h-8 rounded-full bg-danger px-3 text-danger-foreground" isDisabled={disabled || isPending} onPress={handleDelete} size="sm">
        {isPending ? "Deleting..." : label}
      </Button>
      {error ? <div className="text-xs text-warning">{error}</div> : null}
    </div>
  );
}