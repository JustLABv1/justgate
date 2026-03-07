import { CreateRouteForm } from "@/components/admin/create-route-form";
import { RoutesTable } from "@/components/admin/routes-table";
import { SectionPage } from "@/components/admin/section-page";
import { getRoutes, getTenants } from "@/lib/backend-client";
import { Chip, Surface } from "@heroui/react";
import { Info, List } from "lucide-react";

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
      <section className="flex flex-wrap items-center gap-3">
        <CreateRouteForm disabled={result.source !== "backend"} existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
        {result.source !== "backend" ? <div className="text-sm text-muted-foreground">Route changes are disabled while the page is showing fallback data.</div> : null}
      </section>

      <Surface className="rounded-[32px] border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <List className="text-accent" size={24} />
            <h2 className="text-xl font-bold">Route Definitions</h2>
          </div>
          <Chip variant="soft" size="sm">{result.data.length} Active</Chip>
        </div>
        <RoutesTable actionsDisabled={result.source !== "backend"} routes={result.data} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
      </Surface>

      <section className="grid gap-6 md:grid-cols-2">
        <Surface className="flex flex-col gap-4 rounded-[28px] border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
            <Info size={14} />
            Architectural Note
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Route definitions are processed by the Go runtime. Changing a tenant association instantly rebases the upstream target without requiring agent reconfiguration.
          </p>
        </Surface>
        <Surface className="flex flex-col gap-4 rounded-[28px] border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
            <Info size={14} />
            Tenant Context
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Each route requires an associated tenant. {tenants.data.length} tenants are currently available to receive traffic from these proxy slugs.
          </p>
        </Surface>
      </section>
    </SectionPage>
  );
}
