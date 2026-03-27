import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { SectionPage } from "@/components/admin/section-page";
import { TenantCard } from "@/components/admin/tenant-card";
import { getRoutes, getTenants, getTokens } from "@/lib/backend-client";
import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";

export default async function TenantsPage() {
  const [result, routesResult, tokensResult] = await Promise.all([
    getTenants(),
    getRoutes(),
    getTokens(),
  ]);

  const routeCountByTenant: Record<string, number> = {};
  const tokenCountByTenant: Record<string, number> = {};
  for (const r of routesResult.data) {
    routeCountByTenant[r.tenantID] = (routeCountByTenant[r.tenantID] ?? 0) + 1;
  }
  for (const t of tokensResult.data) {
    tokenCountByTenant[t.tenantID] = (tokenCountByTenant[t.tenantID] ?? 0) + 1;
  }

  return (
    <SectionPage
      eyebrow="Upstream Binding"
      title="Tenants"
      description="Organizational boundaries that define upstream destinations and identity headers."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{result.data.length} tenant{result.data.length !== 1 ? "s" : ""}</div>
          <CreateTenantForm disabled={result.source !== "backend"} existingCount={result.data.length} />
        </div>

        {result.data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Building2 size={22} />
            </div>
            <div className="empty-state__kicker">No tenants configured</div>
            <div className="empty-state__title">Start with a tenant boundary</div>
            <div className="empty-state__copy">
              Tenants define upstream destinations and identity headers. Every route must belong to a tenant — create one first.
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface divide-y divide-border">
            {result.data.map((tenant, idx) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                disabled={result.source !== "backend"}
                animationDelay={idx * 30}
                routeCount={routeCountByTenant[tenant.tenantID] ?? 0}
                tokenCount={tokenCountByTenant[tenant.tenantID] ?? 0}
              />
            ))}
          </div>
        )}

        <Link
          href="/routes"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Configure proxy routes
          <ArrowRight size={14} />
        </Link>
      </div>
    </SectionPage>
  );
}
