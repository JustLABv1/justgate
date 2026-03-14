"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/toast-provider";
import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface DeleteRouteButtonProps {
  routeID: string;
  label?: string;
  disabled?: boolean;
}

export function DeleteRouteButton({ routeID, label = "Delete", disabled = false }: DeleteRouteButtonProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/admin/routes/${routeID}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        addToast("Delete failed", payload?.error || "Route could not be deleted", "error");
        return;
      }

      addToast("Route deleted", routeID, "success");
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
        title="Delete route?"
        description="This will immediately remove the proxy entry point. Any callers using this route will receive errors."
        confirmLabel={isPending ? "Deleting…" : "Delete route"}
        isPending={isPending}
        onConfirm={handleDelete}
        variant="danger"
      />

    </div>
  );
}
