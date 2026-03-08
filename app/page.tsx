import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { getTopology } from "@/lib/backend-client";
import { Chip, Surface, Card, Button } from "@heroui/react";
import { 
  Users, 
  Settings, 
  Key, 
  History,
  ArrowUpRight,
  Orbit,
  Activity,
  Server,
  Terminal,
  Shield,
  Zap
} from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const topology = await getTopology();
  const stats = [
    { label: "Tenants", value: topology.data.stats.tenants, icon: Users, color: "accent" },
    { label: "Routes", value: topology.data.stats.routes, icon: Settings, color: "success" },
    { label: "Active Tokens", value: topology.data.stats.activeTokens, icon: Key, color: "warning" },
    { label: "Audit 24h", value: topology.data.stats.auditEvents24h, icon: History, color: "danger" },
  ];

  const isOnline = topology.data.runtime.status === "online";
  const tenantIDs = topology.data.tenants.map((t) => t.tenantID);

  return (
    <div className="space-y-10">
      <section>
        <div className="relative overflow-hidden rounded-[40px] border border-border/40 bg-surface/30 p-8 shadow-2xl backdrop-blur-3xl sm:p-12">
          <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[150%] w-[60%] rotate-12 bg-gradient-to-b from-accent/10 to-transparent blur-3xl" />
          
          <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-bold tracking-widest text-accent uppercase">
                <Activity size={12} strokeWidth={3} />
                Real-time Control Plane
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                Infrastructure <span className="text-accent underline decoration-accent/30 underline-offset-8 font-mono italic">Guardians</span>
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground/90">
                {isOnline 
                  ? "Your zero-trust proxy orchestration is operating at peak efficiency. All tenant boundaries are enforced and routing is optimized."
                  : "Critical Alert: Backend synchronization lost. Attempting to reconnect to the control-plane service..."}
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <OnboardingModal tenantIDs={tenantIDs} disabled={!isOnline} />
                <Button variant="secondary" className="bg-surface/60 border-border/40">
                  Documentation
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className={`relative flex h-32 w-32 items-center justify-center rounded-[40px] border-[3px] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-500 ${isOnline ? "border-success/50 bg-success/5 ring-8 ring-success/10" : "border-warning/50 bg-warning/5 ring-8 ring-warning/10"}`}>
                <div className={`absolute -inset-1 opacity-20 blur-xl ${isOnline ? "bg-success" : "bg-warning"}`} />
                {isOnline ? <Shield size={48} className="text-success" /> : <Zap size={48} className="text-warning" />}
              </div>
              <Chip 
                variant="soft" 
                color={isOnline ? "success" : "warning"}
                className="px-6 py-2 text-sm font-bold uppercase tracking-widest"
              >
                {isOnline ? "Protected" : "Vulnerable"}
              </Chip>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} variant="secondary" className="group rounded-[32px] border-border/40 bg-surface/40 p-1 shadow-sm transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]">
            <Card.Content className="p-6">
              <div className="flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-background/50 text-foreground transition-colors group-hover:bg-accent/10 group-hover:text-accent group-hover:border-accent/30`}>
                  <stat.icon size={20} strokeWidth={2.5} />
                </div>
                <ArrowUpRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
              <div className="mt-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">{stat.label}</p>
                <p className="mt-2 text-4xl font-black tracking-tight text-white">{stat.value}</p>
              </div>
            </Card.Content>
          </Card>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_350px]">
        <Card variant="secondary" className="rounded-[40px] border-border/40 bg-surface/30 p-8 shadow-sm lg:p-10 backdrop-blur-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
            <Orbit size={200} />
          </div>
          
          <Card.Header className="px-0 pt-0 pb-8 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <Card.Title className="text-2xl font-bold tracking-tight">System Telemetry</Card.Title>
              <Card.Description className="text-[13px] text-muted-foreground">Detailed metrics from the localized proxy agent.</Card.Description>
            </div>
            <Button size="sm" variant="ghost" className="border border-border/40 font-bold tracking-tighter hover:bg-surface/80">
              Refresh Node
            </Button>
          </Card.Header>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <TelemetryItem label="Backend" value={isOnline ? "Connected" : "Mirror Only"} status={isOnline ? "success" : "warning"} icon={Server} />
            <TelemetryItem label="Version" value={`v${topology.data.runtime.version}`} icon={Terminal} />
            <TelemetryItem label="Persistent Store" value={topology.data.runtime.storeKind} icon={Activity} />
            <TelemetryItem label="Synchronization" value={new Date(topology.data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} icon={History} />
          </div>

          <div className="mt-10 rounded-3xl border border-border/40 bg-background/40 p-6">
             <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">Cluster Health</h4>
                <div className="flex gap-1">
                   {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`h-4 w-1.5 rounded-full ${i < 7 ? "bg-success/60" : "bg-success/20"}`} />)}
                </div>
             </div>
             <div className="text-xs text-muted-foreground leading-relaxed font-mono">
                [SYSTEM] Node 01-A reporting active.<br/>
                [SYSTEM] Syncing tenant secrets... DONE.<br/>
                [SYSTEM] All 24 routes verified.
             </div>
          </div>
        </Card>

        <div className="space-y-6">
          <div className="px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Quick Protocol</div>
          <div className="grid grid-cols-1 gap-3">
             {[
               { label: "Topology", href: "/topology", color: "bg-blue-500/10 text-blue-400" },
               { label: "Security Tokens", href: "/tokens", color: "bg-amber-500/10 text-amber-400" },
               { label: "Audit Trails", href: "/audit", color: "bg-purple-500/10 text-purple-400" },
             ].map(link => (
               <Link key={link.href} href={link.href} className="group flex items-center justify-between rounded-[24px] border border-border/40 bg-surface/40 p-5 transition-all hover:bg-surface/80 hover:border-accent/40 active:scale-95">
                 <span className="text-sm font-bold tracking-tight">{link.label}</span>
                 <div className={`rounded-xl p-2 ${link.color} transition-transform group-hover:rotate-12`}>
                   <ArrowUpRight size={16} />
                 </div>
               </Link>
             ))}
          </div>

          <Card variant="transparent" className="rounded-3xl border border-accent/20 bg-accent/5 p-6 border-dashed">
            <h5 className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-2 mb-3">
              <Zap size={14} className="fill-accent" />
              Security Sync
            </h5>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Your security certificates are up to date. No immediate action required.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}

function TelemetryItem({ label, value, status, icon: Icon }: any) {
  return (
    <div className="group rounded-[28px] border border-border/30 bg-background/30 px-6 py-5 transition-all hover:border-accent/20 hover:bg-background/50">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-muted-foreground/60" />
        <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</div>
      </div>
      <div className={`text-[15px] font-bold tracking-tight ${status === "success" ? "text-success" : status === "warning" ? "text-warning" : "text-white"}`}>{value}</div>
    </div>
  );
}
