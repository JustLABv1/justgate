"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
  "": "Overview",
  routes: "Routes",
  tenants: "Tenants",
  tokens: "Tokens",
  grants: "Grants",
  audit: "Audit Log",
  sessions: "Sessions",
  team: "Team",
  security: "IP Allowlist",
  settings: "Settings",
  apps: "Apps",
  topology: "Topology",
  dashboard: "Dashboard",
  platform: "Platform",
  users: "Users",
  orgs: "Organisations",
  admins: "Admins",
};

function segmentLabel(seg: string): string {
  return routeLabels[seg] ?? seg;
}

export function Breadcrumbs() {
  const pathname = usePathname();

  // Don't render on root or auth pages
  if (pathname === "/" || pathname.startsWith("/signin") || pathname.startsWith("/setup")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = [
    { href: "/", label: "Overview" },
    ...segments.map((seg, i) => ({
      href: "/" + segments.slice(0, i + 1).join("/"),
      label: segmentLabel(seg),
    })),
  ];

  // Deduplicate sequential identically-labelled segments
  const unique = crumbs.filter((c, i, arr) => i === 0 || c.label !== arr[i - 1].label);

  if (unique.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-[12px] text-muted-foreground px-6 py-2 border-b border-border/50 bg-background/60 lg:px-10">
      {unique.map((crumb, i) => {
        const isLast = i === unique.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} className="text-muted-foreground/40" />}
            {isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
