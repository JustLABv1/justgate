import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { getCircuitBreakers, getExpiringTokens, getTopology, getTrafficOverview, getTrafficStats } from "@/lib/backend-client";
import { Activity, AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Clock, Globe, Lock, Server, TimerReset } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const [topology, circuitBreakersResult, expiringTokensResult, statsResult, overviewResult] = await Promise.all([
    getTopology(),
    getCircuitBreakers(),
    getExpiringTokens(7),
    getTrafficStats(24),
    getTrafficOverview(),
  ]);
  const stats = {
    tenants: topology.data.stats.tenants,
    routes: topology.data.stats.routes,
    activeTokens: topology.data.stats.activeTokens,
    auditEvents24h: topology.data.stats.auditEvents24h,
  };

  const isOnline = topology.data.runtime.status === "online";
  const tenantIDs = topology.data.tenants.map((t) => t.tenantID);

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

  return (
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

        {/* Primary CTA — always visible */}
        <div className="flex items-center gap-2">
          <OnboardingModal tenantIDs={tenantIDs} disabled={!isOnline} />
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Tenants", value: stats.tenants, icon: Server, href: "/tenants" },
          { label: "Routes", value: stats.routes, icon: Globe, href: "/routes" },
          { label: "Active Tokens", value: stats.activeTokens, icon: Lock, href: "/tokens" },
          { label: "Audit (24h)", value: stats.auditEvents24h, icon: TimerReset, href: "/audit" },
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
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
          </Link>
        ))}
      </div>

      {/* ── Body: checklist + sidebar ────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

        {/* Setup checklist — dominant left column */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {allDone ? "Gateway configured" : "Setup checklist"}
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {allDone
                  ? "All three steps are complete. The gateway is ready."
                  : `${completedCount} of ${setupSteps.length} steps complete`}
              </p>
            </div>
            {allDone && (
              <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                <CheckCircle2 size={11} />
                Ready
              </div>
            )}
          </div>

          <div className="divide-y divide-border/60">
            {setupSteps.map((item, idx) => (
              <Link
                key={item.step}
                href={item.href}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-panel/60"
              >
                {/* Step number / check */}
                <div className="mt-0.5 shrink-0">
                  {item.done ? (
                    <CheckCircle2 size={18} className="text-success" />
                  ) : (
                    <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-border text-[10px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${item.done ? "text-muted-foreground line-through decoration-border" : "text-foreground"}`}>
                      {item.step}
                    </span>
                    {item.stat && (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        {item.stat}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{item.description}</p>
                </div>

                <ArrowRight size={14} className="mt-1 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </Link>
            ))}
          </div>
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

          {/* Audit shortcut */}
          <Link
            href="/audit"
            className="group flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-panel"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <TimerReset size={14} className="text-muted-foreground" />
                Audit Log
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stats.auditEvents24h > 0 ? `${stats.auditEvents24h} events in the last 24h` : "No recent events"}
              </p>
            </div>
            <ArrowRight size={14} className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          </Link>

          {/* Topology shortcut */}
          <Link
            href="/topology"
            className="group flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-panel"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe size={14} className="text-muted-foreground" />
                Live Topology
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Visualize active gateway connections</p>
            </div>
            <ArrowRight size={14} className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          </Link>

          {/* Circuit breakers status */}
          {circuitBreakersResult.data.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <AlertTriangle size={11} />
                Circuit Breakers
              </div>
              <div className="mt-3 space-y-2">
                {circuitBreakersResult.data.map((cb) => (
                  <div key={cb.tenantID} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[140px]">{cb.tenantID}</span>
                    <span className={`text-xs font-medium ${cb.state === "closed" ? "text-success" : cb.state === "open" ? "text-danger" : "text-warning"}`}>
                      {cb.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* ── Traffic analytics ───────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <BarChart3 size={11} />
          Traffic Analytics — last 24 hours
        </div>
        <DashboardCharts stats={statsResult.data} overview={overviewResult.data} />
      </div>
    </div>
  );
}
