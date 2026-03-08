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
      <div className="relative min-h-screen bg-background text-foreground">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.08),transparent_60%)]" />
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
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,163,255,0.05),transparent_50%)]" />

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className={`mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 ${isWideRoute ? "max-w-[1800px]" : "max-w-7xl"}`}>
          <div className="flex items-center gap-3">
            <Button
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              className="h-10 w-10 min-w-10 rounded-xl border border-border/50 bg-surface/50 px-0 text-foreground lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              type="button"
              variant="ghost"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-[0_0_20px_rgba(0,163,255,0.3)]">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Just Proxy Guard</div>
              <div className="text-sm font-bold tracking-tight text-foreground">Control Center</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedInUser ? (
              <div className="hidden rounded-full border border-border/40 bg-surface/40 px-3 py-1 text-[13px] font-medium text-muted-foreground md:block">
                {signedInUser}
              </div>
            ) : null}
            <div className="mx-1 h-4 w-px bg-border/40" />
            <ThemeToggle />
            {signedInUser ? <SignOutButton /> : null}
          </div>
        </div>
      </header>

      <div className={`relative z-10 mx-auto grid w-full gap-8 px-4 py-8 sm:px-6 lg:px-8 ${isWideRoute ? "max-w-[1800px] lg:grid-cols-[240px_minmax(0,1fr)]" : "max-w-7xl lg:grid-cols-[260px_minmax(0,1fr)]"}`}>
        <aside
          className={[
            "lg:sticky lg:top-24 lg:block lg:h-fit",
            mobileNavOpen ? "fixed inset-x-4 top-20 z-50 block rounded-3xl border border-border bg-panel p-4 shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:p-0 lg:shadow-none" : "hidden",
          ].join(" ")}
        >
          <div className="space-y-6">
            <div className="hidden px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 lg:block">Navigation</div>
            <AdminNav />
          </div>
        </aside>

        <main className="min-w-0">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
