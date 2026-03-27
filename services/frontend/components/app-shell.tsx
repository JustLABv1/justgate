"use client";

import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { GlobalSearch } from "@/components/admin/global-search";
import { AdminNav } from "@/components/admin/nav";
import { NotificationCenter } from "@/components/admin/notification-center";
import { OrgSwitcher } from "@/components/admin/org-switcher";
import { UserMenu } from "@/components/admin/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@heroui/react";
import {
    AppWindow,
    ChevronDown,
    History,
    KeyRound,
    LayoutDashboard,
    Lock,
    Menu,
    Monitor,
    Orbit,
    Settings,
    Settings2,
    Share2,
    Shield,
    SlidersHorizontal,
    Users2,
    UsersRound,
    X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ElementType, type ReactNode, useEffect, useRef, useState } from "react";

interface AppShellProps {
  children: ReactNode;
  signedInUser?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
}

const authRoutes = new Set(["/signin", "/setup"]);

// Direct top-level links
const directLinks: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/topology", label: "Topology", icon: Orbit },
  { href: "/apps", label: "Apps", icon: AppWindow },
];

// Grouped into dropdowns
const proxyNav: NavItem[] = [
  { href: "/routes", label: "Routes", icon: Settings2 },
  { href: "/tenants", label: "Tenants", icon: Users2 },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/grants", label: "Grants", icon: Share2 },
];

const activityNav: NavItem[] = [
  { href: "/audit", label: "Audit Log", icon: History },
  { href: "/sessions", label: "Sessions", icon: Monitor },
];

const manageNav: NavItem[] = [
  { href: "/team", label: "Team", icon: UsersRound },
  { href: "/security", label: "IP Allowlist", icon: Lock },
];

const platformAdminNav: NavItem[] = [
  { href: "/platform/users", label: "All Users", icon: UsersRound },
  { href: "/platform/orgs", label: "All Orgs", icon: Users2 },
  { href: "/platform/admins", label: "Platform Admins", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavDropdown({
  label,
  icon: Icon,
  items,
  pathname,
}: {
  label: string;
  icon: ElementType;
  items: NavItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const isActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
          isActive
            ? "bg-surface text-foreground"
            : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
        }`}
      >
        <Icon size={13} className={isActive ? "text-accent" : "text-muted-foreground/70"} />
        {label}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-border bg-overlay py-1.5 shadow-lg backdrop-blur-sm">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                }`}
              >
                <item.icon
                  size={13}
                  className={active ? "text-accent" : "text-muted-foreground/60"}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children, signedInUser }: AppShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAuthRoute = authRoutes.has(pathname);
  const isPlatformAdmin = session?.isPlatformAdmin === true;

  if (isAuthRoute) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <main className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 items-center gap-3 px-4 sm:px-6 max-w-[1800px]">

          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/justgate_logo.png"
              alt="JustGate"
              width={22}
              height={22}
              className="rounded-sm brightness-0 dark:brightness-100"
            />
            <span className="text-sm font-semibold tracking-tight text-foreground">JustGate</span>
          </div>

          <div className="hidden lg:block h-5 w-px bg-border" />

          {/* Org switcher */}
          <div className="hidden lg:block w-40 shrink-0">
            <OrgSwitcher />
          </div>

          <div className="hidden lg:block h-5 w-px bg-border" />

          {/* Primary nav — desktop */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {directLinks.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                  }`}
                >
                  <item.icon
                    size={13}
                    className={active ? "text-accent" : "text-muted-foreground/70"}
                  />
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}

            <NavDropdown label="Proxy" icon={Settings2} items={proxyNav} pathname={pathname} />
            <NavDropdown label="Activity" icon={History} items={activityNav} pathname={pathname} />
            <NavDropdown label="Manage" icon={SlidersHorizontal} items={manageNav} pathname={pathname} />

            {isPlatformAdmin && (
              <NavDropdown
                label="Admin"
                icon={Shield}
                items={platformAdminNav}
                pathname={pathname}
              />
            )}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            <NotificationCenter />
            {signedInUser ? <UserMenu user={signedInUser} /> : <ThemeToggle />}
          </div>

          {/* Mobile hamburger */}
          <Button
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            className="h-8 w-8 min-w-8 rounded-lg px-0 text-muted-foreground lg:hidden"
            onClick={() => setMobileNavOpen((open) => !open)}
            type="button"
            variant="ghost"
          >
            {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
          </Button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-x-0 top-14 z-50 border-b border-border bg-background p-4 lg:hidden">
          <AdminNav onNavigate={() => setMobileNavOpen(false)} />
        </div>
      )}

      <Breadcrumbs />

      <main className="mx-auto w-full max-w-[1800px] px-6 py-6 lg:px-10 lg:py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-background/80">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-6 py-3 lg:px-10">
          <span className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} JustLAB. All rights reserved.
          </span>
          <span className="text-[11px] text-muted-foreground">
            JustGate {process.env.NEXT_PUBLIC_APP_VERSION ? `v${process.env.NEXT_PUBLIC_APP_VERSION}` : ""}
          </span>
        </div>
      </footer>
    </div>
  );
}
