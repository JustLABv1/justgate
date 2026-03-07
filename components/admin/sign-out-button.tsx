"use client";

import { Button } from "@heroui/react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <Button
      className="bg-slate-950 text-white"
      onPress={() => {
        void signOut({ callbackUrl: "/signin" });
      }}
    >
      Sign out
    </Button>
  );
}