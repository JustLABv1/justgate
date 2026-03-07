"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface DeleteRouteButtonProps {
  routeID: string;
  label?: string;
  disabled?: boolean;
}

export function DeleteRouteButton({ routeID, label = "Delete", disabled = false }: DeleteRouteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    setError(undefined);

    const response = await fetch(`/api/admin/routes/${routeID}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "route delete failed");
      return;
    }

    startTransition(() => {
      router.refresh();
      window.location.reload();
    });
  }

  return (
    <div className="space-y-2">
      <Button className="h-8 rounded-full bg-danger px-3 text-white" isDisabled={disabled || isPending} onPress={handleDelete} size="sm">
        {isPending ? "Deleting..." : label}
      </Button>
      {error ? <div className="text-xs text-amber-800 dark:text-amber-200">{error}</div> : null}
    </div>
  );
}