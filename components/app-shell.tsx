"use client";

import { AdminNav } from "@/components/admin/nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@heroui/react";
import { Menu, ShieldCheck, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

interface AppShellProps {
  children: ReactNode;
  signedInUser?: string | null;
}

const authRoutes = new Set(["/signin"]);
const wideRoutes = new Set(["/topology"]);

export function AppShell({ children, signedInUser }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAuthRoute = authRoutes.has(pathname);
  const isWideRoute = wideRoutes.has(pathname);

  if (isAuthRoute) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-[radial-gradient(circle_at_top,rgba(100,116,139,0.12),transparent_60%)]" />
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
    <div className="min-h-screen bg-background text-foreground selection:bg-accent/20">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[260px] bg-[linear-gradient(180deg,rgba(100,116,139,0.08),transparent)]" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/78 backdrop-blur-xl">
        <div className={`mx-auto flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 ${isWideRoute ? "max-w-[1800px]" : "max-w-7xl"}`}>
          <div className="flex items-center gap-3">
            <Button
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              className="h-11 w-11 min-w-11 rounded-2xl border border-border/70 bg-surface/90 px-0 text-foreground shadow-[var(--field-shadow)] lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              type="button"
              variant="ghost"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-surface text-foreground shadow-[var(--field-shadow)]">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Just Proxy Guard</div>
              <div className="text-lg font-semibold tracking-[-0.03em] text-foreground">Operations Console</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedInUser ? (
              <div className="hidden rounded-full border border-border/70 bg-surface/90 px-4 py-2 text-[13px] font-medium text-muted-foreground shadow-[var(--field-shadow)] md:block">
                {signedInUser}
              </div>
            ) : null}
            <div className="mx-1 hidden h-5 w-px bg-border/80 md:block" />
            <ThemeToggle />
            {signedInUser ? <SignOutButton /> : null}
          </div>
        </div>
      </header>

      <div className={`relative z-10 mx-auto grid w-full gap-8 px-4 py-8 sm:px-6 lg:px-8 ${isWideRoute ? "max-w-[1800px] lg:grid-cols-[260px_minmax(0,1fr)]" : "max-w-7xl lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
        <aside
          className={[
            "lg:sticky lg:top-24 lg:block lg:h-fit",
            mobileNavOpen ? "fixed inset-x-4 top-24 z-50 block rounded-[30px] border border-border/80 bg-overlay/95 p-4 shadow-[var(--overlay-shadow)] lg:relative lg:inset-auto lg:z-auto lg:p-0 lg:shadow-none" : "hidden",
          ].join(" ")}
        >
          <div className="surface-card space-y-6 rounded-[30px] p-4 lg:p-5">
            <div className="hidden space-y-2 px-2 lg:block">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Control Surfaces</div>
              <p className="text-sm leading-6 text-muted-foreground">Navigate tenants, routes, tokens, audit history, and the live topology graph.</p>
            </div>
            <AdminNav />
          </div>
        </aside>

        <main className="min-w-0 pb-8">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
