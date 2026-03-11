import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { SectionPage } from "@/components/admin/section-page";
import { UpdateTenantForm } from "@/components/admin/update-tenant-form";
import { getTenants } from "@/lib/backend-client";
import { ArrowRight, Shield, Building2 } from "lucide-react";
import Link from "next/link";

export default async function TenantsPage() {
  const result = await getTenants();

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
              <div
                key={tenant.id}
                className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-panel/50 animate-in fade-in duration-300 fill-mode-both"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="font-mono text-sm font-semibold tracking-tight text-foreground uppercase">{tenant.tenantID}</div>
                  <div className="font-mono text-xs text-muted-foreground truncate">{tenant.upstreamURL}</div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Shield size={10} className="text-muted-foreground/50" />
                      {tenant.headerName}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <UpdateTenantForm key={`${tenant.id}:${tenant.tenantID}:${tenant.upstreamURL}:${tenant.headerName}:${tenant.name}`} disabled={result.source !== "backend"} tenant={tenant} />
                  <DeleteTenantButton disabled={result.source !== "backend"} tenantID={tenant.tenantID} />
                </div>
              </div>
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
