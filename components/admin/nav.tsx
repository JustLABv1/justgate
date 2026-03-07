"use client";

import { Button } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/routes", label: "Routes" },
  { href: "/tenants", label: "Tenants" },
  { href: "/tokens", label: "Tokens" },
  { href: "/audit", label: "Audit" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex flex-wrap gap-2 rounded-[1.7rem] border border-slate-900/10 bg-white/72 p-2 shadow-[0_24px_50px_-42px_rgba(15,23,42,0.4)] backdrop-blur">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Button
            key={link.href}
            className={`rounded-[1.15rem] px-4 py-3 text-sm font-medium transition-colors ${
              active
                ? "bg-slate-950 text-white"
                : "bg-transparent text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
            onPress={() => router.push(link.href)}
          >
            {link.label}
          </Button>
        );
      })}
    </nav>
  );
}