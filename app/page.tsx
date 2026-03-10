import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { getTopology } from "@/lib/backend-client";
import { Activity, Server, Globe, Lock, TimerReset } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const topology = await getTopology();
  const stats = {
    tenants: topology.data.stats.tenants,
    routes: topology.data.stats.routes,
    activeTokens: topology.data.stats.activeTokens,
    auditEvents24h: topology.data.stats.auditEvents24h,
  };

  const isOnline = topology.data.runtime.status === "online";
  const tenantIDs = topology.data.tenants.map((t) => t.tenantID);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Overview</h1>
          <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${isOnline ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`} />
            {isOnline ? "Online" : "Degraded"}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">System health and topology summary.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Tenants", value: stats.tenants, icon: Server },
          { label: "Routes", value: stats.routes, icon: Globe },
          { label: "Active Tokens", value: stats.activeTokens, icon: Lock },
          { label: "Audit (24h)", value: stats.auditEvents24h, icon: TimerReset },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <item.icon size={14} className="text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity size={12} />
                {isOnline ? "Backend connected" : "Backend unavailable"}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <OnboardingModal tenantIDs={tenantIDs} disabled={!isOnline} />
              <Link
                href="/audit"
                className="inline-flex items-center rounded-lg border border-border bg-panel px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                View Audit Log
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">Setup checklist</h2>
            <div className="mt-3 space-y-2">
              {[
                { step: "Create a tenant boundary", done: stats.tenants > 0, href: "/tenants" },
                { step: "Map proxy routes to tenants", done: stats.routes > 0, href: "/routes" },
                { step: "Issue scoped access tokens", done: stats.activeTokens > 0, href: "/tokens" },
              ].map((item) => (
                <Link
                  key={item.step}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-panel"
                >
                  <div className={`h-2 w-2 rounded-full ${item.done ? "bg-success" : "bg-border"}`} />
                  <span className={item.done ? "text-muted-foreground" : "text-foreground"}>{item.step}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">Topology summary</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active nodes</span>
                <span className="font-medium text-foreground">{stats.tenants + stats.routes + stats.activeTokens}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Route coverage</span>
                <span className="font-medium text-foreground">{stats.routes > 0 ? "Configured" : "Pending"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credential posture</span>
                <span className="font-medium text-foreground">{stats.activeTokens > 0 ? "Issued" : "None"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">Navigation</h2>
            <div className="mt-3 space-y-1">
              {[
                { label: "Routes", href: "/routes" },
                { label: "Tenants", href: "/tenants" },
                { label: "Tokens", href: "/tokens" },
                { label: "Topology", href: "/topology" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-panel hover:text-foreground"
                >
                  {link.label}
                  <span className="text-xs">&rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
