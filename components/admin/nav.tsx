"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { 
  LayoutDashboard, 
  Settings2, 
  Users2, 
  KeyRound, 
  History 
} from "lucide-react";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/routes", label: "Routes", icon: Settings2 },
  { href: "/tenants", label: "Tenants", icon: Users2 },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/audit", label: "Audit Log", icon: History },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex flex-col gap-1 overflow-y-auto">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Button
            key={link.href}
            variant="ghost"
            className={`justify-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-surface hover:text-foreground"
            }`}
            onPress={() => router.push(link.href)}
          >
            <link.icon size={18} />
            <span className="flex-1 text-left">{link.label}</span>
            {active ? <span className="h-2 w-2 rounded-full bg-current/80" /> : null}
          </Button>
        );
      })}
    </nav>
  );
}
