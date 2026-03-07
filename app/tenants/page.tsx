import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { SectionPage } from "@/components/admin/section-page";
import { getTenants } from "@/lib/backend-client";
import { Card, Chip } from "@heroui/react";

export default async function TenantsPage() {
  const result = await getTenants();

  return (
    <SectionPage
      eyebrow="Tenant inventory"
      title="Tenant upstream bindings"
      description="Tenants define the Mimir upstream target and the header contract that the Go proxy injects during forwarding."
      source={result.source}
      error={result.error}
    >
      <CreateTenantForm existingCount={result.data.length} />
      <section className="grid gap-4 lg:grid-cols-2">
        {result.data.map((tenant) => (
          <Card key={tenant.id} className="border border-slate-900/10 bg-white/84 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.35)]">
            <Card.Content className="p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{tenant.tenantID}</div>
                  <h3 className="mt-2 font-display text-2xl text-slate-950">{tenant.name}</h3>
                </div>
                <Chip className="bg-slate-100 text-slate-800">{tenant.authMode}</Chip>
              </div>
              <dl className="mt-6 space-y-4 text-sm text-slate-600">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Upstream</dt>
                  <dd className="mt-1 font-mono text-slate-950">{tenant.upstreamURL}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Injected header</dt>
                  <dd className="mt-1 text-slate-950">{tenant.headerName}</dd>
                </div>
              </dl>
            </Card.Content>
          </Card>
        ))}
      </section>
    </SectionPage>
  );
}