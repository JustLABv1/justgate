"use client";

import { Button } from "@heroui/react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <Button
      className="rounded-full bg-foreground px-4 text-background shadow-sm"
      onPress={() => {
        void signOut({ callbackUrl: "/signin" });
      }}
    >
      Sign out
    </Button>
  );
}