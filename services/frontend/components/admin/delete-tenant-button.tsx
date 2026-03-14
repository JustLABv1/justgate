"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/toast-provider";
import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface DeleteTenantButtonProps {
  /** The internal UUID of the tenant (tenant.id), not the tenant slug. */
  id: string;
  label?: string;
  disabled?: boolean;
}

export function DeleteTenantButton({ id, label = "Delete", disabled = false }: DeleteTenantButtonProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        addToast("Delete failed", payload?.error || "Tenant could not be deleted", "error");
        return;
      }

      addToast("Tenant deleted", id, "success");
      router.refresh();
    });
  }

  return (
    <div>
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

    </div>
  );
}