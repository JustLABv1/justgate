import { AdminNav } from "@/components/admin/nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { auth } from "@/lib/auth";
import { Card, Chip } from "@heroui/react";
import type { Metadata } from "next";
import { DM_Sans, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const bodySans = DM_Sans({
  variable: "--font-body-sans",
  subsets: ["latin"],
});

const displaySerif = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
});

const operatorMono = IBM_Plex_Mono({
  variable: "--font-operator-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Just Proxy Guard",
  description: "Tenant-aware proxy guard for Grafana Mimir and agent traffic.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body
        className={`${bodySans.variable} ${displaySerif.variable} ${operatorMono.variable} antialiased`}
      >
        <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(244,111,9,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.16),_transparent_34%),linear-gradient(180deg,_#fcfaf5_0%,_#f4efe2_48%,_#ede4d3_100%)] text-slate-900">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent)]" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10">
            <header className="mb-8">
              <Card className="border border-slate-900/10 bg-white/76 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.42)] backdrop-blur">
                <Card.Content className="grid gap-6 p-7 lg:grid-cols-[1.35fr_0.95fr] lg:p-8">
                  <div className="max-w-2xl space-y-4">
                    <Chip className="w-fit bg-white text-slate-700 ring-1 ring-slate-900/10">Control plane</Chip>
                    <div className="space-y-2">
                      <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                        Just Proxy Guard
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                        Tenant-aware proxy orchestration for Grafana Mimir, built as a deliberate split between a HeroUI admin console and a Go-owned runtime boundary.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <Card className="border border-slate-900/10 bg-slate-950 text-slate-100">
                      <Card.Content className="p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Frontend role</div>
                        <div className="mt-2 font-medium text-white">OIDC admin client</div>
                      </Card.Content>
                    </Card>
                    <Card className="border border-slate-900/10 bg-white/88">
                      <Card.Content className="p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Runtime role</div>
                        <div className="mt-2 font-medium text-slate-950">Go proxy and admin API</div>
                      </Card.Content>
                    </Card>
                    {session?.user ? (
                      <Card className="border border-slate-900/10 bg-white/88 sm:col-span-2">
                        <Card.Content className="flex items-center justify-between gap-3 p-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Signed in</div>
                            <div className="mt-2 font-medium text-slate-950">
                              {session.user.email || session.user.name || session.user.id}
                            </div>
                          </div>
                          <SignOutButton />
                        </Card.Content>
                      </Card>
                    ) : null}
                  </div>
                </Card.Content>
              </Card>
            </header>
            <AdminNav />
            <main className="flex-1 py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
