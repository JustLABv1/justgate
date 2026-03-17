import { ActivityFeed } from "@/components/admin/activity-feed";
import { CollapsibleAnalytics } from "@/components/admin/collapsible-analytics";
import { InstanceStatusPanel } from "@/components/admin/instance-status-panel";
import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { QuickActions } from "@/components/admin/quick-actions";
import { PageTransition } from "@/components/page-transition";
import { getCircuitBreakers, getExpiringTokens, getReplicas, getTopology, getTrafficOverview, getTrafficStats } from "@/lib/backend-client";
import { Activity, AlertTriangle, ArrowRight, Clock, Globe, Lock, Server, TimerReset, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const [topology, circuitBreakersResult, expiringTokensResult, statsResult, overviewResult, replicasResult] = await Promise.all([
    getTopology(),
    getCircuitBreakers(),
    getExpiringTokens(7),
    getTrafficStats(24),
    getTrafficOverview(),
    getReplicas(),
  ]);
  const stats = {
    tenants: topology.data.stats.tenants,
    routes: topology.data.stats.routes,
    activeTokens: topology.data.stats.activeTokens,
    auditEvents24h: topology.data.stats.auditEvents24h,
  };

  const isOnline = topology.data.runtime.status === "online";
  const tenants = topology.data.tenants;
  const tenantIDs = tenants.map((t) => t.tenantID);

  const setupSteps = [
    {
      step: "Create a tenant boundary",
      description: "Define the first organizational boundary for routing and access control.",
      done: stats.tenants > 0,
      href: "/tenants",
      stat: stats.tenants > 0 ? `${stats.tenants} tenant${stats.tenants !== 1 ? "s" : ""}` : null,
    },
    {
      step: "Map proxy routes to tenants",
      description: "Configure entry points that proxy traffic to upstream services.",
      done: stats.routes > 0,
      href: "/routes",
      stat: stats.routes > 0 ? `${stats.routes} route${stats.routes !== 1 ? "s" : ""}` : null,
    },
    {
      step: "Issue scoped access tokens",
      description: "Generate credentials scoped to specific tenants and routes.",
      done: stats.activeTokens > 0,
      href: "/tokens",
      stat: stats.activeTokens > 0 ? `${stats.activeTokens} active` : null,
    },
  ];

  const allDone = setupSteps.every((s) => s.done);
  const completedCount = setupSteps.filter((s) => s.done).length;

  const auditTrend = (() => {
    const cur = overviewResult.data.totalRequests;
    const prior = overviewResult.data.priorRequests;
    if (!prior) return null;
    const pct = Math.round(((cur - prior) / prior) * 100);
    return { pct, up: pct >= 0 };
  })();

  return (
    <PageTransition>
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Overview</h1>
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${isOnline ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-warning"}`} />
              {isOnline ? "Online" : "Degraded"}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">System health and gateway configuration.</p>
        </div>

        {/* Primary CTA — shown only when setup is complete */}
        <div className="flex items-center gap-2">
          {allDone && <OnboardingModal tenantIDs={tenantIDs} disabled={!isOnline} />}
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Tenants", value: stats.tenants, icon: Server, href: "/tenants", trend: null },
          { label: "Routes", value: stats.routes, icon: Globe, href: "/routes", trend: null },
          { label: "Active Tokens", value: stats.activeTokens, icon: Lock, href: "/tokens", trend: null },
          { label: "Audit (24h)", value: stats.auditEvents24h, icon: TimerReset, href: "/audit", trend: auditTrend },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-panel"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <item.icon size={14} className="text-muted-foreground transition-colors group-hover:text-accent" />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
              {item.trend && (
                <div className={`mb-0.5 flex items-center gap-0.5 text-[11px] font-medium ${item.trend.up ? "text-success" : "text-danger"}`}>
                  {item.trend.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {item.trend.up ? "+" : ""}{item.trend.pct}%
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Body: quick actions + activity + sidebar ──────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

        {/* Left column */}
        <div className="space-y-4">

          {/* Setup progress — compact strip until all steps done */}
          {!allDone && (
            <div className="rounded-lg border border-border bg-surface px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Setup checklist</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {completedCount} of {setupSteps.length} steps complete
                  </p>
                </div>
                <OnboardingModal tenantIDs={tenantIDs} disabled={!isOnline} />
              </div>
              <div className="mt-3 flex gap-1.5">
                {setupSteps.map((step) => (
                  <Link
                    key={step.step}
                    href={step.href}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      step.done ? "bg-success" : "bg-border"
                    }`}
                    title={`${step.step}${step.done ? " — done" : ""}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-lg border border-border bg-surface px-5 py-3.5">
            <QuickActions
                tenants={tenants}
                tenantCount={stats.tenants}
                routeCount={stats.routes}
                tokenCount={stats.activeTokens}
              />
          </div>

          {/* Recent Traffic */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Recent Traffic</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Last gateway requests</p>
              </div>
              <Link
                href="/audit"
                className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <ActivityFeed events={topology.data.auditEvents} />
          </div>

          {/* Traffic analytics — inline below recent traffic, open by default */}
          <CollapsibleAnalytics stats={statsResult.data} overview={overviewResult.data} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Backend status */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Activity size={11} />
              Backend
            </div>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${isOnline ? "text-success" : "text-warning"}`}>
                  {isOnline ? "Connected" : "Unavailable"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active nodes</span>
                <span className="font-medium text-foreground">{stats.tenants + stats.routes + stats.activeTokens}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Route coverage</span>
                <span className="font-medium text-foreground">{stats.routes > 0 ? "Configured" : "Pending"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credentials</span>
                <span className="font-medium text-foreground">{stats.activeTokens > 0 ? `${stats.activeTokens} active` : "None"}</span>
              </div>
            </div>
          </div>

          {/* Audit + Topology shortcuts */}
          <div className="rounded-lg border border-border bg-surface divide-y divide-border">
            <Link
              href="/audit"
              className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-panel"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <TimerReset size={13} className="text-muted-foreground" />
                Audit Log
              </div>
              <span className="text-[11px] text-muted-foreground">
                {stats.auditEvents24h > 0 ? `${stats.auditEvents24h} events today` : "No events"}
              </span>
            </Link>
            <Link
              href="/topology"
              className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-panel"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe size={13} className="text-muted-foreground" />
                Live Topology
              </div>
              <ArrowRight size={12} className="text-muted-foreground/40" />
            </Link>
          </div>

          {/* Circuit breakers status */}
          {circuitBreakersResult.data.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <AlertTriangle size={11} />
                Circuit Breakers
                <span
                  className="ml-auto cursor-default text-[9px] normal-case font-normal tracking-normal text-muted-foreground/50"
                  title="Opens after repeated 5xx errors or connection failures from the upstream. Gateway-level rejections (rate limits, auth) do not affect the circuit breaker."
                >
                  upstream health
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {circuitBreakersResult.data.map((cb) => (
                  <div key={cb.routeID ?? cb.tenantID} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-muted-foreground truncate font-mono text-xs max-w-[130px]">/proxy/{cb.slug}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ${cb.state === "closed" ? "text-success" : cb.state === "open" ? "text-danger" : "text-warning"}`}>
                      {cb.locked && <Lock size={10} />}
                      {cb.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instance status */}
          <InstanceStatusPanel initialReplicas={replicasResult.data} />

          {/* Expiring tokens */}
          {expiringTokensResult.data.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Clock size={11} />
                Expiring Soon
              </div>
              <div className="mt-3 space-y-2">
                {expiringTokensResult.data.slice(0, 5).map((tk) => (
                  <div key={tk.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[120px]">{tk.name}</span>
                    <span className={`text-xs font-medium ${tk.daysUntilExpiry <= 1 ? "text-danger" : tk.daysUntilExpiry <= 3 ? "text-warning" : "text-muted-foreground"}`}>
                      {tk.daysUntilExpiry <= 0 ? "Today" : `${tk.daysUntilExpiry}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
    </PageTransition>
  );
}
