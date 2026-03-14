import { CreateGrantForm } from "@/components/admin/create-grant-form";
import { GrantsTable } from "@/components/admin/grants-table";
import { SectionPage } from "@/components/admin/section-page";
import { getGrants, getTenants } from "@/lib/backend-client";

export default async function GrantsPage() {
  const [result, tenants] = await Promise.all([getGrants(), getTenants()]);

  return (
    <SectionPage
      eyebrow="Identity Management"
      title="Provisioning Grants"
      description="Grants allow agents to self-provision tokens. Share the grant secret with each agent; each use issues a new scoped token."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {result.data.length} grant{result.data.length !== 1 ? "s" : ""}
          </div>
          <CreateGrantForm
            disabled={result.source !== "backend"}
            existingCount={result.data.length}
            tenantIDs={tenants.data.map((t) => t.tenantID)}
          />
        </div>
        <div className="rounded-lg border border-border bg-surface">
          <GrantsTable actionsDisabled={result.source !== "backend"} grants={result.data} />
        </div>
      </div>
    </SectionPage>
  );
}
