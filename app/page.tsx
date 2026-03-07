import { getOverview } from "@/lib/backend-client";
import { Chip, Surface } from "@heroui/react";
import { 
  ArrowRight,
  Users, 
  Settings, 
  Key, 
  History,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const overview = await getOverview();
  const stats = [
    { label: "Tenants", value: overview.data.stats.tenants, icon: Users },
    { label: "Routes", value: overview.data.stats.routes, icon: Settings },
    { label: "Active Tokens", value: overview.data.stats.activeTokens, icon: Key },
    { label: "Audit 24h", value: overview.data.stats.auditEvents24h, icon: History },
  ];

  const isOnline = overview.data.runtime.status === "online";
  const onboardingSteps = [
    {
      href: "/tenants",
      label: "Create tenant",
      description: "Add the tenant ID, upstream URL, and header that should be injected on proxied requests.",
      done: overview.data.stats.tenants > 0,
      step: "01",
    },
    {
      href: "/routes",
      label: "Add route",
      description: "Create a stable proxy slug and bind it to the tenant you just onboarded.",
      done: overview.data.stats.routes > 0,
      step: "02",
    },
    {
      href: "/tokens",
      label: "Issue token",
      description: "Generate an access token with the exact scopes that route requires.",
      done: overview.data.stats.activeTokens > 0,
      step: "03",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="rounded-[32px] border border-border bg-surface px-6 py-6 shadow-sm sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="text-xs font-medium text-muted-foreground">Overview</div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">System overview</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {isOnline 
                ? "Live control-plane data from the Go service. Review routing, tenant boundaries, and credential health at a glance."
                : "Fallback mode. The admin API is currently unreachable. Start the backend service to recover live control data."}
            </p>
          </div>
          <Chip 
            variant="soft" 
            color={isOnline ? "success" : "warning"}
            className="border-none bg-background/80 px-0"
          >
            {isOnline ? "Backend reachable" : "Backend unreachable"}
          </Chip>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Surface className="rounded-[32px] border border-border bg-surface p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Start here</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">Onboard a new tenant in three steps</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                The safest path is always the same: create the tenant first, then attach a route, then issue a token for that route.
              </p>
            </div>
            <Chip className="bg-background text-foreground ring-1 ring-border">
              {onboardingSteps.filter((step) => step.done).length} / {onboardingSteps.length} completed
            </Chip>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {onboardingSteps.map((step) => (
              <Link key={step.href} href={step.href} className="group rounded-[28px] border border-border bg-background p-5 transition-colors hover:bg-surface">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold tracking-[0.24em] text-muted-foreground">{step.step}</span>
                  <Chip className={step.done ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100" : "bg-background text-foreground ring-1 ring-border"}>
                    {step.done ? "Done" : "Next"}
                  </Chip>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{step.label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-foreground">
                  Open
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </Surface>

        <Surface className="rounded-[32px] border border-border bg-foreground p-8 text-background shadow-sm">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">What each step controls</h2>
          <div className="mt-6 space-y-4 text-sm leading-7 text-background/78">
            <p><strong className="text-background">Tenant:</strong> where traffic goes and which tenant header gets injected.</p>
            <p><strong className="text-background">Route:</strong> which proxy slug maps to that tenant and what scope is required.</p>
            <p><strong className="text-background">Token:</strong> who can call the route and with which permissions.</p>
          </div>
        </Surface>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Surface key={stat.label} className="rounded-[28px] border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-foreground">
                <stat.icon size={18} />
              </div>
              <ArrowUpRight size={16} className="text-muted-foreground opacity-50" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground">{stat.value}</p>
            </div>
          </Surface>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Surface className="col-span-2 rounded-[32px] border border-border bg-surface p-8 shadow-sm lg:p-10">
          <div className="flex items-center gap-3 border-b border-border pb-6">
            {isOnline ? (
              <CheckCircle2 className="text-success" size={24} />
            ) : (
              <AlertCircle className="text-warning" size={24} />
            )}
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Service runtime</h2>
              <p className="text-sm text-muted-foreground">Status: {overview.data.runtime.status}</p>
            </div>
          </div>
          
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Endpoint</p>
              <p className="font-mono text-sm">{overview.backendUrl}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Version</p>
              <p className="text-sm">{overview.data.runtime.version}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Store</p>
              <p className="text-sm capitalize">{overview.data.runtime.storeKind}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Last Check</p>
              <p className="text-sm">{new Date(overview.data.generatedAt).toLocaleTimeString()}</p>
            </div>
          </div>
        </Surface>

        <Surface className="rounded-[32px] border border-border bg-foreground p-8 text-background shadow-sm">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Browse sections</h2>
          <div className="mt-6 flex flex-col gap-3">
            {[
              { label: "Configure Routes", href: "/routes", icon: Settings },
              { label: "Manage Tenants", href: "/tenants", icon: Users },
              { label: "View Audit Log", href: "/audit", icon: History }
            ].map((link) => (
              <Link key={link.href} href={link.href} className="group flex items-center justify-between rounded-2xl border border-background/10 bg-background/5 p-4 transition-colors hover:bg-background/10">
                <div className="flex items-center gap-3">
                  <link.icon size={18} />
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
                <ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover:opacity-50" />
              </Link>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
