"use client";

import { OrgSwitcher } from "@/components/admin/org-switcher";
import { History, KeyRound, LayoutDashboard, Orbit, Settings, Settings2, Users2, UsersRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/topology", label: "Topology", icon: Orbit },
  { href: "/routes", label: "Routes", icon: Settings2 },
  { href: "/tenants", label: "Tenants", icon: Users2 },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/audit", label: "Audit Log", icon: History },
  { href: "/team", label: "Team", icon: UsersRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AdminNavProps {
  onNavigate?: () => void;
}

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex flex-col gap-0.5">
      <div className="mb-2">
        <OrgSwitcher />
      </div>
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

      <div className="mt-4 px-3">
        <span className="inline-flex items-center rounded-full border border-border/60 bg-surface/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/70">
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
        </span>
      </div>
    </nav>
  );
}
