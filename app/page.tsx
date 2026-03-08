import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { getTopology } from "@/lib/backend-client";
import { Card, Button } from "@heroui/react";
import { 
  ArrowUpRight,
  Activity,
  Server,
  Globe,
  Lock,
  Orbit,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import Link from "next/link";

interface TelemetryItemProps {
  label: string;
  value: string | number;
  status?: string;
  icon: React.ElementType;
}

function TelemetryItem({ label, value, icon: Icon, status }: TelemetryItemProps) {
  return (
    <Card className="surface-card rounded-[24px] border-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-panel text-foreground">
          <Icon size={16} />
        </div>
      </div>
      <div className={`mt-3 text-[2rem] font-semibold tracking-[-0.05em] ${status === "success" ? "text-success" : status === "warning" ? "text-warning" : "text-foreground"}`}>
        {value}
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">Live topology snapshot from the control plane.</p>
    </Card>
  );
}

export default async function Home() {
  const topology = await getTopology();
  const stats = {
    tenants: topology.data.stats.tenants,
    routes: topology.data.stats.routes,
    activeTokens: topology.data.stats.activeTokens,
    auditEvents24h: topology.data.stats.auditEvents24h
  };

  const isOnline = topology.data.runtime.status === "online";
  const tenantIDs = topology.data.tenants.map((t) => t.tenantID);

  return (
    <div className="flex flex-col gap-8">
      <header className="surface-card relative overflow-hidden rounded-[28px] px-7 py-7 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(100,116,139,0.05),transparent)]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-panel/80 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <ShieldCheck size={14} className="text-accent" />
              Operations overview
            </div>
            <div className="space-y-2.5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.055em] text-foreground sm:text-[3.25rem]">
                Tenant-aware proxy operations, designed for daily control.
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground sm:text-base">
                Review route health, access decisions, and credential posture from a clear administrative workspace with restrained visual hierarchy.
              </p>
            </div>
          </div>

          <div className="surface-card-muted rounded-[24px] p-4.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">System status</div>
                <div className="mt-1.5 text-[1.7rem] font-semibold tracking-[-0.045em] text-foreground">
                  {isOnline ? "Operational" : "Limited access"}
                </div>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-[1rem] ${isOnline ? "bg-success/12 text-success" : "bg-warning/18 text-warning"}`}>
                <Activity size={20} />
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
              {isOnline ? "The backend is responding and streaming topology updates." : "The backend is degraded or unavailable. Some actions may be read-only."}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <TelemetryItem icon={Server} label="Tenants" value={stats.tenants} />
        <TelemetryItem icon={Globe} label="Routes" value={stats.routes} />
        <TelemetryItem icon={Lock} label="Active Tokens" value={stats.activeTokens} />
        <TelemetryItem icon={TimerReset} label="Audit Events 24h" value={stats.auditEvents24h} status={stats.auditEvents24h > 0 ? "success" : undefined} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="surface-card rounded-[28px] border-0 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Readiness</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">Proxy health and onboarding</h3>
            </div>
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${isOnline ? "bg-success/12 text-success" : "bg-warning/18 text-warning"}`}>
              <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`} />
              {isOnline ? "Live backend" : "Degraded backend"}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="text-muted-foreground">Encryption Depth</span>
                <span>98%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-default">
                <div className="h-full w-[98%] rounded-full bg-accent" />
              </div>
            </div>

            <div className="grid gap-4 rounded-[22px] border border-border/80 bg-panel/70 p-4 sm:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Topology</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{stats.tenants + stats.routes + stats.activeTokens} active nodes</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Route coverage</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{stats.routes > 0 ? "Configured" : "Pending setup"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Credential posture</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{stats.activeTokens > 0 ? "Issued" : "No tokens yet"}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
               <OnboardingModal tenantIDs={tenantIDs} disabled={!isOnline} />
               <Link href="/audit">
                  <Button variant="secondary" className="w-full rounded-full bg-panel px-5 text-foreground sm:w-auto">
                    View Audit Logs
                 </Button>
               </Link>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="surface-card rounded-[28px] border-0 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-panel text-foreground">
                <Orbit size={18} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Next actions</div>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Operator workflow</h3>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                "Create or verify a tenant boundary.",
                "Map one or more proxy routes to that tenant.",
                "Issue scoped tokens and monitor the audit stream.",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-[20px] border border-border/80 bg-panel/60 px-4 py-3.5 text-sm text-foreground">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-surface text-foreground">{index + 1}</div>
                  <p className="leading-6">{item}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="surface-card rounded-[28px] border-0 p-6">
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-foreground">External monitoring</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use these handoffs when you need to inspect the wider observability stack around the proxy.</p>
            <div className="mt-5 grid gap-3">
              {[
                { name: "Grafana Cloud", url: "#" },
                { name: "Prometheus", url: "#" },
                { name: "Loki Streams", url: "#" },
              ].map((link) => (
                <Link key={link.name} href={link.url}>
                  <Button variant="outline" className="w-full justify-between rounded-2xl border-border bg-surface px-4 py-6 text-foreground hover:bg-panel">
                    {link.name}
                    <ArrowUpRight size={16} />
                  </Button>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
