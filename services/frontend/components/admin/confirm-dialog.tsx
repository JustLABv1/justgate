"use client";

import { Button, Modal } from "@heroui/react";
import { AlertTriangle } from "lucide-react";
import { type ReactNode, useState } from "react";

interface ConfirmDialogProps {
  /** The trigger element that opens the dialog */
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: string;
  /** Text shown on the confirm button */
  confirmLabel?: string;
  /** Whether the confirm action is in progress */
  isPending?: boolean;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Visual variant — danger (red) or warning (amber) */
  variant?: "danger" | "warning";
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  isPending = false,
  onConfirm,
  variant = "danger",
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  const isDanger = variant === "danger";

  return (
    <>
      {trigger(() => setOpen(true))}

      <Modal.Dialog
        isOpen={open}
        onOpenChange={setOpen}
        className="rounded-[20px] border border-border bg-overlay shadow-[var(--overlay-shadow)]"
        style={{ maxWidth: "400px" }}
      >
        <Modal.Header className="px-6 pt-6 pb-0">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${isDanger ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <Modal.Heading className="text-base font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </Modal.Heading>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="px-6 pb-6 pt-5">
          <div className="flex gap-2.5">
            <Button
              className="h-10 flex-1 rounded-xl border border-border bg-panel text-sm font-medium text-foreground"
              onPress={() => setOpen(false)}
              isDisabled={isPending}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className={`h-10 flex-1 rounded-xl text-sm font-medium ${isDanger ? "bg-danger text-danger-foreground" : "bg-warning text-warning-foreground"}`}
              onPress={() => { onConfirm(); setOpen(false); }}
              isDisabled={isPending}
            >
              {isPending ? "Please wait…" : confirmLabel}
            </Button>
          </div>
        </Modal.Body>
      </Modal.Dialog>
    </>
  );
}
