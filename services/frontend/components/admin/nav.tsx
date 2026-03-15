"use client";

import { OrgSwitcher } from "@/components/admin/org-switcher";
import { AppWindow, History, KeyRound, LayoutDashboard, Monitor, Orbit, Settings, Settings2, Shield, Users2, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const sections = [
  {
    links: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/topology", label: "Topology", icon: Orbit },
    ],
  },
  {
    label: "Tenant proxy",
    links: [
      { href: "/routes", label: "Routes", icon: Settings2 },
      { href: "/tenants", label: "Tenants", icon: Users2 },
      { href: "/tokens", label: "Tokens", icon: KeyRound },
    ],
  },
  {
    label: "Protected apps",
    links: [
      { href: "/apps", label: "Apps", icon: AppWindow },
    ],
  },
  {
    label: "Activity",
    links: [
      { href: "/audit", label: "Audit Log", icon: History },
      { href: "/sessions", label: "Sessions", icon: Monitor },
      { href: "/team", label: "Team", icon: UsersRound },
    ],
  },
];

const platformLinks = [
  { href: "/platform/users", label: "All Users", icon: UsersRound },
  { href: "/platform/orgs", label: "All Orgs", icon: Users2 },
  { href: "/platform/admins", label: "Platform Admins", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AdminNavProps {
  onNavigate?: () => void;
}

export function AdminNav({ onNavigate }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const isPlatformAdmin = session?.isPlatformAdmin === true;

  function navButton(href: string, label: string, Icon: React.ElementType) {
    const active = pathname === href;
    return (
      <button
        key={href}
        type="button"
        onClick={() => {
          router.push(href);
          onNavigate?.();
        }}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
          active
            ? "bg-surface text-foreground"
            : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
        }`}
      >
        <Icon size={15} className={active ? "text-foreground" : "text-muted-foreground"} />
        {label}
      </button>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      <div className="mb-2">
        <OrgSwitcher />
      </div>

      {sections.map((section, i) => (
        <div key={i} className={i > 0 ? "mt-3" : ""}>
          {section.label && (
            <div className="mb-1 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </span>
            </div>
          )}
          {section.links.map((link) => navButton(link.href, link.label, link.icon))}
        </div>
      ))}

      {isPlatformAdmin && (
        <>
          <div className="my-2 px-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Platform Admin
            </span>
          </div>
          {platformLinks.map((link) => navButton(link.href, link.label, link.icon))}
        </>
      )}

      <div className="mt-4 px-3">
        <span className="inline-flex items-center rounded-full border border-border/60 bg-surface/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/70">
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
        </span>
      </div>
    </nav>
  );
}

