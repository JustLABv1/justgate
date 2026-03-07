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

export function AppShell({ children, signedInUser }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAuthRoute = authRoutes.has(pathname);

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.06),transparent_58%)]" />

      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              className="h-10 w-10 min-w-10 rounded-xl border border-border bg-surface px-0 text-foreground lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              type="button"
              variant="ghost"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Just Proxy Guard</div>
              <div className="text-sm font-semibold text-foreground">Control plane</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {signedInUser ? (
              <div className="hidden rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground md:block">
                {signedInUser}
              </div>
            ) : null}
            <ThemeToggle />
            {signedInUser ? <SignOutButton /> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside
          className={[
            "rounded-[28px] border border-border bg-panel p-3 shadow-sm lg:sticky lg:top-24 lg:block lg:h-fit",
            mobileNavOpen ? "block" : "hidden",
          ].join(" ")}
        >
          <AdminNav />
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
