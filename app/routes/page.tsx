import { CreateRouteForm } from "@/components/admin/create-route-form";
import { RoutesTable } from "@/components/admin/routes-table";
import { SectionPage } from "@/components/admin/section-page";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import { getRoutes, getTenants } from "@/lib/backend-client";
import { Card, Chip } from "@heroui/react";

export default async function RoutesPage() {
  const [result, tenants] = await Promise.all([getRoutes(), getTenants()]);

  return (
    <SectionPage
      eyebrow="Proxy routes"
      title="Route definitions"
      description="Each slug becomes a stable entry point for agents while the Go backend decides which upstream path, tenant rule, and scope gate apply."
      source={result.source}
      error={result.error}
    >
      <section className="grid gap-6 xl:grid-cols-[0.8fr_0.8fr_1fr]">
        <CreateRouteForm existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
        <UpdateRouteForm routes={result.data} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
        <Card className="border border-slate-900/10 bg-slate-950 text-slate-100 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)]">
          <Card.Content className="space-y-4 p-7">
            <Chip className="w-fit bg-white/10 text-slate-200">Routing notes</Chip>
            <div className="text-sm leading-7 text-slate-300">
              Route create and update operations now flow through authenticated Go control endpoints. Changing the tenant rebases the upstream target and keeps the agent slug policy-driven.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Tenant map</div>
                  <div className="mt-2 font-medium text-white">{tenants.data.length} registered tenants</div>
                </Card.Content>
              </Card>
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Boundary</div>
                  <div className="mt-2 font-medium text-white">Frontend mutates only through Go</div>
                </Card.Content>
              </Card>
            </div>
          </Card.Content>
        </Card>
      </section>
      <Card className="border border-slate-900/10 bg-white/84 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.4)]">
        <Card.Header className="border-b border-slate-900/10 pb-4">
          <Card.Title className="font-display text-2xl text-slate-950">Route definitions</Card.Title>
          <Card.Description className="text-sm text-slate-600">Live proxy entry points exposed to agents.</Card.Description>
        </Card.Header>
        <Card.Content className="pt-6">
          <RoutesTable routes={result.data} />
        </Card.Content>
      </Card>
    </SectionPage>
  );
}