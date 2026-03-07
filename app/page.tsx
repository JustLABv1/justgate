import { getOverview } from "@/lib/backend-client";
import { Card, Chip } from "@heroui/react";
import Link from "next/link";

const quickActions = [
  {
    href: "/routes",
    title: "Route catalog",
    description: "Create arbitrary proxy slugs and pin them to backend upstream rules.",
  },
  {
    href: "/tokens",
    title: "Token inventory",
    description: "Issue tenant-scoped credentials and track expiration, scope, and revocation state.",
  },
  {
    href: "/audit",
    title: "Audit watch",
    description: "Inspect the latest traffic outcomes coming back from the Go control API.",
  },
];

export default async function Home() {
  const overview = await getOverview();
  const metrics = [
    { label: "Tenants", value: overview.data.stats.tenants },
    { label: "Routes", value: overview.data.stats.routes },
    { label: "Active Tokens", value: overview.data.stats.activeTokens },
    { label: "Audit 24h", value: overview.data.stats.auditEvents24h },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
        <Card className="border border-slate-900/10 bg-white/82 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.38)]">
          <Card.Content className="p-7 lg:p-9">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Backend control signal</p>
                <h2 className="mt-2 font-display text-3xl text-slate-950">
                  {overview.data.runtime.status === "online" ? "Backend reachable" : "Backend fallback mode"}
                </h2>
              </div>
              <Chip className={overview.data.runtime.status === "online" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}>
                {overview.data.runtime.status}
              </Chip>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              {overview.source === "backend"
                ? "The dashboard is now reading live control-plane data from the Go service. This pass adds real admin mutation flows while persistence remains intentionally in-memory."
                : "The frontend could not reach the Go service, so it is rendering fallback contract data. Start the backend to switch this page back to the live admin API."}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <Card key={metric.label} className="border border-slate-900/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(248,244,236,0.92))]">
                  <Card.Content className="flex min-h-[132px] flex-col justify-between p-5">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">{metric.label}</span>
                    <span className="font-display text-[2.2rem] leading-none text-slate-950">{metric.value}</span>
                  </Card.Content>
                </Card>
              ))}
            </div>
            <Card className="mt-8 border border-slate-900/10 bg-slate-950 text-slate-100">
              <Card.Content className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                  <span>Backend base URL</span>
                  <span>{overview.backendUrl}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span>Store: {overview.data.runtime.storeKind}</span>
                  <span>Version: {overview.data.runtime.version}</span>
                  <span>Generated: {new Date(overview.data.generatedAt).toLocaleString()}</span>
                </div>
              </Card.Content>
            </Card>
          </Card.Content>
        </Card>

        <Card className="border border-slate-900/10 bg-slate-950 text-slate-100 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)]">
          <Card.Content className="p-7 lg:p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Runtime path</p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="font-medium text-white">1. Admin user enters through Next.js</div>
                  <div>OIDC will gate the UI. The current forms and tables already flow into the Go admin surface.</div>
                </Card.Content>
              </Card>
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="font-medium text-white">2. Go owns state and policy</div>
                  <div>Routes, tenants, tokens, audits, and future repositories remain behind the Go service boundary.</div>
                </Card.Content>
              </Card>
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="font-medium text-white">3. Agents hit proxy routes directly</div>
                  <div>Bearer token resolves a tenant, injects the Mimir header, and forwards traffic to the configured upstream.</div>
                </Card.Content>
              </Card>
            </div>
          </Card.Content>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="block transition-transform duration-200 hover:-translate-y-1"
          >
            <Card className="h-full border border-slate-900/10 bg-white/80 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.4)]">
              <Card.Content className="flex h-full flex-col p-6">
                <Chip className="w-fit bg-white text-slate-700 ring-1 ring-slate-900/10">Open workspace</Chip>
                <h3 className="mt-4 font-display text-2xl text-slate-950">{action.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{action.description}</p>
                <div className="mt-6 text-sm font-medium text-slate-950">Review section {"->"}</div>
              </Card.Content>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
