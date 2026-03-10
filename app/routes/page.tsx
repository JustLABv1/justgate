import { CreateRouteForm } from "@/components/admin/create-route-form";
import { RoutesTable } from "@/components/admin/routes-table";
import { SectionPage } from "@/components/admin/section-page";
import { getRoutes, getTenants } from "@/lib/backend-client";
import { getBackendBaseUrl } from "@/lib/backend-server";
import Link from "next/link";

export default async function RoutesPage() {
  const [result, tenants] = await Promise.all([getRoutes(), getTenants()]);
  const backendBaseUrl = getBackendBaseUrl();

  return (
    <SectionPage
      eyebrow="Traffic Control"
      title="Proxy Routes"
      description="Stable entry points mapping incoming requests to tenant-specific backend targets."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{result.data.length} route{result.data.length !== 1 ? "s" : ""}</div>
          <CreateRouteForm disabled={result.source !== "backend"} existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <RoutesTable actionsDisabled={result.source !== "backend"} routes={result.data} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} backendBaseUrl={backendBaseUrl} />
        </div>

        {result.source !== "backend" && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            Read-only mode — write operations are temporarily restricted.
          </div>
        )}

        {tenants.data.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No tenants available.{" "}
            <Link href="/tenants" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
              Create one first
            </Link>{" "}
            to define route destinations.
          </div>
        )}
      </div>
    </SectionPage>
  );
}
