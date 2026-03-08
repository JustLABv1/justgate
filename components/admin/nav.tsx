"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { 
  LayoutDashboard, 
  Orbit,
  Settings2, 
  Users2, 
  KeyRound, 
  History 
} from "lucide-react";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/topology", label: "Topology", icon: Orbit },
  { href: "/routes", label: "Routes", icon: Settings2 },
  { href: "/tenants", label: "Tenants", icon: Users2 },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/audit", label: "Audit Log", icon: History },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex flex-col gap-2">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Button
            key={link.href}
            variant="ghost"
            className={`group relative h-14 justify-start gap-4 rounded-[22px] px-4 py-3 text-sm font-medium transition-all duration-300 ${
              active
                ? "border border-border/70 bg-surface text-foreground shadow-[var(--field-shadow)]"
                : "text-muted-foreground hover:bg-panel/80 hover:text-foreground"
            }`}
            onPress={() => router.push(link.href)}
          >
            <link.icon 
              size={18} 
              className={`transition-transform duration-300 group-hover:scale-110 ${active ? "text-foreground stroke-[2.5px]" : "text-muted-foreground group-hover:text-foreground"}`}
            />
            <span className="flex-1 text-left">{link.label}</span>
            {active && (
              <span className="rounded-full bg-panel px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Current
              </span>
            )}
          </Button>
        );
      })}
    </nav>
  );
}
