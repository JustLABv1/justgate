import { PlatformOrgsTable } from "@/components/admin/platform-orgs-table";
import { SectionPage } from "@/components/admin/section-page";
import { auth } from "@/lib/auth";
import { getAdminOrgs, getRoutes, getTenants } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function PlatformOrgsPage() {
  const session = await auth();
  if (!session?.isPlatformAdmin) {
    redirect("/");
  }

  const [result, tenantsResult, routesResult] = await Promise.all([
    getAdminOrgs(),
    getTenants(),
    getRoutes(),
  ]);

  // Compute per-org tenant and route counts using orgID from tenants
  const tenantCountByOrg: Record<string, number> = {};
  const routeCountByOrg: Record<string, number> = {};

  for (const tenant of tenantsResult.data) {
    if (tenant.orgID) {
      tenantCountByOrg[tenant.orgID] = (tenantCountByOrg[tenant.orgID] ?? 0) + 1;
    }
  }

  // Build a set of tenantIDs per orgID for route lookups
  const tenantIDToOrgID: Record<string, string> = {};
  for (const tenant of tenantsResult.data) {
    if (tenant.orgID) tenantIDToOrgID[tenant.tenantID] = tenant.orgID;
  }

  for (const route of routesResult.data) {
    const orgID = tenantIDToOrgID[route.tenantID];
    if (orgID) {
      routeCountByOrg[orgID] = (routeCountByOrg[orgID] ?? 0) + 1;
    }
  }

  return (
    <SectionPage
      eyebrow="Platform Admin"
      title="All Organisations"
      description="View and manage all organisations across the platform."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {result.data.length} organisation{result.data.length !== 1 ? "s" : ""} total
        </div>
        <PlatformOrgsTable
          orgs={result.data}
          tenantCountByOrg={tenantCountByOrg}
          routeCountByOrg={routeCountByOrg}
        />
      </div>
    </SectionPage>
  );
}
