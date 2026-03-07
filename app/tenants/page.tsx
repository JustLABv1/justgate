import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { SectionPage } from "@/components/admin/section-page";
import { UpdateTenantForm } from "@/components/admin/update-tenant-form";
import { getTenants } from "@/lib/backend-client";
import { Card, Chip, Surface } from "@heroui/react";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import Link from "next/link";

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
      <section className="flex flex-wrap items-center gap-3">
        <CreateTenantForm disabled={result.source !== "backend"} existingCount={result.data.length} />
        {result.source !== "backend" ? <div className="text-sm text-muted-foreground">Tenant changes are disabled while the page is showing fallback data.</div> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Surface className="rounded-[32px] border border-border bg-surface p-7 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">Recommended order</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">Start with the tenant record</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Before routes or tokens exist, define where this tenant should proxy traffic and which tenant header the backend must inject upstream.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { done: result.data.length > 0, title: "1. Create tenant", description: "Save the tenant name, tenant ID, upstream URL, and header." },
              { done: false, title: "2. Create route", description: "After the tenant exists, open Routes and map a proxy slug to it." },
              { done: false, title: "3. Issue token", description: "Only after a route exists should you generate operator or agent tokens." },
            ].map((step) => (
              <div key={step.title} className="flex gap-3 rounded-[24px] border border-border bg-background p-4">
                <div className="mt-0.5 text-muted-foreground">
                  {step.done ? <CheckCircle2 size={18} className="text-success" /> : <CircleDashed size={18} />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/routes" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground">
            Continue to routes
            <ArrowRight size={14} />
          </Link>
        </Surface>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Current tenants</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">Configured upstream bindings</h2>
          </div>
          <Chip className="bg-background text-foreground ring-1 ring-border">{result.data.length} tenants</Chip>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {result.data.map((tenant) => (
            <Card key={tenant.id} className="rounded-[32px] border border-border bg-surface shadow-sm">
              <Card.Content className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{tenant.tenantID}</div>
                    <div className="mt-1 text-xl font-semibold text-foreground">{tenant.name}</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Chip className="bg-background text-foreground ring-1 ring-border">{tenant.authMode}</Chip>
                    <UpdateTenantForm disabled={result.source !== "backend"} tenant={tenant} />
                    <DeleteTenantButton disabled={result.source !== "backend"} tenantID={tenant.id} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Upstream</div>
                    <div className="mt-1 font-mono text-sm text-foreground break-all">{tenant.upstreamURL}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Injected header</div>
                    <div className="mt-1 text-sm text-foreground">{tenant.headerName}</div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  Next step: create a route that points at <span className="font-medium text-foreground">{tenant.tenantID}</span>.
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      </section>
    </SectionPage>
  );
}