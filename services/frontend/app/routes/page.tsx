import { CreateRouteForm } from "@/components/admin/create-route-form";
import { RouteTester } from "@/components/admin/route-tester";
import { RoutesTable } from "@/components/admin/routes-table";
import { SectionPage } from "@/components/admin/section-page";
import { TrafficHeatmap } from "@/components/admin/traffic-heatmap";
import { getRoutes, getTenants, getTokens } from "@/lib/backend-client";
import { getPublicBaseUrl } from "@/lib/backend-server";
import Link from "next/link";

export default async function RoutesPage() {
  const [result, tenants, tokens] = await Promise.all([getRoutes(), getTenants(), getTokens()]);
  const backendBaseUrl = getPublicBaseUrl();

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
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{result.data.length} route{result.data.length !== 1 ? "s" : ""}</div>
            <RouteTester routes={result.data} tokens={tokens.data} backendBaseUrl={backendBaseUrl} />
          </div>
          <CreateRouteForm disabled={result.source !== "backend"} existingCount={result.data.length} existingSlugs={result.data.map((r) => r.slug)} tenants={tenants.data} />
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <RoutesTable actionsDisabled={result.source !== "backend"} routes={result.data} tenants={tenants.data} tokens={tokens.data} backendBaseUrl={backendBaseUrl} />
        </div>

        {result.source !== "backend" && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            Read-only mode — write operations are temporarily restricted.
          </div>
        )}

        {result.data.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Traffic heatmap — requests by route &amp; hour
            </div>
            <TrafficHeatmap days={7} />
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
