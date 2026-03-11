"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Orbit, Settings2, Users2, KeyRound, History } from "lucide-react";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/topology", label: "Topology", icon: Orbit },
  { href: "/routes", label: "Routes", icon: Settings2 },
  { href: "/tenants", label: "Tenants", icon: Users2 },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/audit", label: "Audit Log", icon: History },
];

interface AdminNavProps {
  onNavigate?: () => void;
}

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex flex-col gap-0.5">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <button
            key={link.href}
            type="button"
            onClick={() => {
              router.push(link.href);
              onNavigate?.();
            }}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
              active
                ? "bg-surface text-foreground"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            <link.icon size={15} className={active ? "text-foreground" : "text-muted-foreground"} />
            {link.label}
          </button>
        );
      })}
    </nav>
  );
}
