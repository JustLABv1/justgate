"use client";

import { Button } from "@heroui/react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <Button
      className="rounded-full border border-border/80 bg-surface/90 px-4 text-foreground shadow-[var(--field-shadow)] transition-colors hover:bg-panel"
      onPress={() => {
        void signOut({ callbackUrl: "/signin" });
      }}
    >
      Sign out
    </Button>
  );
}