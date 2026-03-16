"use client";

import { GlobalSearch } from "@/components/admin/global-search";
import { AdminNav } from "@/components/admin/nav";
import { UserMenu } from "@/components/admin/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@heroui/react";
import { AppWindow, ChevronDown, History, KeyRound, LayoutDashboard, Menu, Orbit, Settings, Settings2, Share2, Shield, Users2, UsersRound, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface AppShellProps {
  children: ReactNode;
  signedInUser?: string | null;
}

const authRoutes = new Set(["/signin"]);

const primaryNav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/topology", label: "Topology", icon: Orbit },
  { href: "/routes", label: "Routes", icon: Settings2 },
  { href: "/tenants", label: "Tenants", icon: Users2 },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  { href: "/grants", label: "Grants", icon: Share2 },
  { href: "/apps", label: "Apps", icon: AppWindow },
  { href: "/audit", label: "Audit", icon: History },
  { href: "/team", label: "Team", icon: UsersRound },
];

const adminNav = [
  { href: "/platform/users", label: "All Users", icon: UsersRound },
  { href: "/platform/orgs", label: "All Orgs", icon: Users2 },
  { href: "/platform/admins", label: "Platform Admins", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

function AdminDropdown({ pathname }: { pathname: string }) {
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

  const isAdminActive = adminNav.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
          isAdminActive
            ? "bg-surface text-foreground"
            : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
        }`}
      >
        <Shield size={13} className={isAdminActive ? "text-accent" : "text-muted-foreground/70"} />
        Admin
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-border bg-overlay py-1.5 shadow-lg backdrop-blur-sm">
          {adminNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                }`}
              >
                <item.icon size={13} className={active ? "text-accent" : "text-muted-foreground/60"} />
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
        <div className="mx-auto flex h-14 items-center gap-4 px-4 sm:px-6 max-w-[1800px]">

          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/justgate_logo.png" alt="JustGate" width={22} height={22} className="rounded-sm brightness-0 dark:brightness-100" />
            <span className="text-sm font-semibold tracking-tight text-foreground">JustGate</span>
          </div>

          <div className="hidden lg:block h-5 w-px bg-border" />

          {/* Primary nav — desktop */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {primaryNav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                  }`}
                >
                  <item.icon size={13} className={active ? "text-accent" : "text-muted-foreground/70"} />
                  {item.label}
                </Link>
              );
            })}

            {isPlatformAdmin && <AdminDropdown pathname={pathname} />}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            {signedInUser ? (
              <UserMenu user={signedInUser} />
            ) : (
              <ThemeToggle />
            )}
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

      <main className="mx-auto w-full max-w-[1800px] px-6 py-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
