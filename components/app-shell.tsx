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
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6 ${isWideRoute ? "max-w-[1800px]" : "max-w-6xl"}`}>
          <div className="flex items-center gap-3">
            <Button
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              className="h-8 w-8 min-w-8 rounded-lg px-0 text-muted-foreground lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              type="button"
              variant="ghost"
            >
              {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
            </Button>
            <ShieldCheck size={18} className="text-foreground" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Proxy Guard</span>
          </div>

          <div className="flex items-center gap-3">
            {signedInUser ? (
              <span className="hidden text-[13px] text-muted-foreground md:block">{signedInUser}</span>
            ) : null}
            <ThemeToggle />
            {signedInUser ? <SignOutButton /> : null}
          </div>
        </div>
      </header>

      <div className={`relative mx-auto grid w-full gap-0 ${isWideRoute ? "max-w-[1800px] lg:grid-cols-[220px_minmax(0,1fr)]" : "max-w-6xl lg:grid-cols-[220px_minmax(0,1fr)]"}`}>
        <aside
          className={[
            "lg:sticky lg:top-14 lg:block lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:border-r lg:border-border",
            mobileNavOpen
              ? "fixed inset-x-0 top-14 z-50 block border-b border-border bg-background p-4 lg:relative lg:inset-auto lg:z-auto lg:p-0"
              : "hidden",
          ].join(" ")}
        >
          <div className="px-3 py-4">
            <AdminNav />
          </div>
        </aside>

        <main className="min-w-0 px-6 py-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
