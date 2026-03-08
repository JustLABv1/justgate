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
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Button
            key={link.href}
            variant="ghost"
            className={`group relative h-11 justify-start gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
              active
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(0,163,255,0.2)]"
                : "text-muted-foreground/80 hover:bg-surface/60 hover:text-foreground"
            }`}
            onPress={() => router.push(link.href)}
          >
            <link.icon 
              size={18} 
              className={`transition-transform duration-300 group-hover:scale-110 ${active ? "text-accent stroke-[2.5px]" : ""}`}
            />
            <span className="flex-1 text-left">{link.label}</span>
            {active && (
              <span className="absolute left-[-1px] top-1/4 h-1/2 w-1 rounded-full bg-accent" />
            )}
          </Button>
        );
      })}
    </nav>
  );
}
