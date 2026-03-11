"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
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

  function handleDelete() {
    startTransition(async () => {
      setError(undefined);

      const response = await fetch(`/api/admin/tenants/${tenantID}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error || "tenant delete failed");
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
            className="h-8 rounded-full border border-border/60 bg-panel px-3 text-muted-foreground hover:border-danger/40 hover:bg-danger/8 hover:text-danger"
            isDisabled={disabled || isPending}
            onPress={open}
            size="sm"
            variant="ghost"
          >
            <Trash2 size={13} />
            {label}
          </Button>
        )}
        title="Delete tenant?"
        description="This will remove the tenant boundary and all associated routes and tokens. This action cannot be undone."
        confirmLabel={isPending ? "Deleting…" : "Delete tenant"}
        isPending={isPending}
        onConfirm={handleDelete}
        variant="danger"
      />
      {error ? <div className="text-[11px] text-danger">{error}</div> : null}
    </div>
  );
}