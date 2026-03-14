"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/toast-provider";
import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface DeleteTokenButtonProps {
  tokenID: string;
  disabled?: boolean;
  label?: string;
}

export function DeleteTokenButton({ tokenID, disabled, label = "Delete" }: DeleteTokenButtonProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/admin/tokens/${tokenID}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        addToast("Delete failed", payload?.error || "Token could not be deleted", "error");
        return;
      }

      addToast("Token revoked", tokenID, "success");
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
        title="Delete token?"
        description="This permanently removes the credential record. If the token is still active, callers using it will immediately lose access."
        confirmLabel={isPending ? "Deleting…" : "Delete token"}
        isPending={isPending}
        onConfirm={handleDelete}
        variant="danger"
      />

    </div>
  );
}
