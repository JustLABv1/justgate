import { CreateRouteForm } from "@/components/admin/create-route-form";
import { RoutesTable } from "@/components/admin/routes-table";
import { SectionPage } from "@/components/admin/section-page";
import { getRoutes, getTenants } from "@/lib/backend-client";
import { Card } from "@heroui/react";
import { ArrowRight, List, Orbit, ShieldAlert, Waypoints } from "lucide-react";
import Link from "next/link";

export default async function RoutesPage() {
  const [result, tenants] = await Promise.all([getRoutes(), getTenants()]);

  return (
    <SectionPage
      eyebrow="Traffic Control"
      title="Proxy Routes"
      description="Manage stable entry points for your logging and metrics agents. Routes map incoming requests to tenant-specific backend targets."
      source={result.source}
      error={result.error}
    >
      <section className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 px-2 text-foreground">
            <div className="flex items-center gap-3">
              <Orbit size={20} className="text-muted-foreground" />
               <h2 className="text-xl font-semibold tracking-[-0.03em] leading-none">Entry points</h2>
            </div>
            <CreateRouteForm disabled={result.source !== "backend"} existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
          </div>

          <Card variant="transparent" className="surface-card rounded-[28px] border-0 p-6 overflow-hidden relative group">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-panel text-foreground">
                    <List size={18} />
                  </div>
                  <h3 className="text-base font-semibold tracking-[-0.03em] text-foreground">Active topology</h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border/80 bg-panel/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                   {result.data.length} Definitions
                </div>
              </div>
              
              <div className="rounded-[22px] border border-border/80 bg-panel/55 p-3">
                <RoutesTable actionsDisabled={result.source !== "backend"} routes={result.data} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
              </div>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="surface-card rounded-[30px] border-0 p-8 space-y-4 text-foreground">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <Waypoints size={14} className="text-muted-foreground" />
                Route behavior
              </div>
              <h4 className="text-xl font-semibold tracking-[-0.03em] leading-tight">Runtime binding</h4>
              <p className="text-sm leading-7 text-muted-foreground">
                Route definitions are processed by the Go runtime. Changing a tenant association instantly rebases the upstream target without requiring agent reconfiguration.
              </p>
            </div>
            <div className="surface-card rounded-[30px] border-0 p-8 space-y-4 text-foreground">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <ShieldAlert size={14} />
                Isolation check
              </div>
              <h4 className="text-xl font-semibold tracking-[-0.03em] leading-tight">Tenant context</h4>
              <p className="text-sm leading-7 text-muted-foreground">
                Each route requires an associated tenant. {tenants.data.length} realms are currently available to receive traffic from these proxy slugs.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-8">
           <div className="surface-card rounded-[30px] border-0 p-8">
              <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Security advisory</div>
              <p className="text-sm leading-7 text-muted-foreground">
                Routes are globally visible if public. Ensure your upstream endpoints implement their own auth if bypassing the Proxy Guard token layer.
              </p>
           </div>

           <Link href="/tenants" className="surface-card flex items-center justify-between rounded-[30px] border-0 p-6">
             <div>
               <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Need a new tenant?</div>
               <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">Create the destination boundary first.</div>
             </div>
             <ArrowRight size={18} className="text-muted-foreground" />
           </Link>

           {result.source !== "backend" && (
             <div className="rounded-[30px] border border-warning/30 bg-warning/12 p-8">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-warning">Read-only mode</div>
                <p className="text-sm text-warning-foreground">
                  You are viewing cached infrastructure data. Write operations are temporarily restricted.
                </p>
             </div>
           )}
        </aside>
      </section>
    </SectionPage>
  );
}
