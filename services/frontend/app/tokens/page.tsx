import { BulkCreateTokensModal } from "@/components/admin/bulk-create-tokens-modal";
import { CreateTokenForm } from "@/components/admin/create-token-form";
import { SectionPage } from "@/components/admin/section-page";
import { TokenLifecycleGantt } from "@/components/admin/token-lifecycle-gantt";
import { TokensTable } from "@/components/admin/tokens-table";
import { getTenants, getTokens } from "@/lib/backend-client";

export default async function TokensPage() {
  const [result, tenants] = await Promise.all([getTokens(), getTenants()]);

  return (
    <SectionPage
      eyebrow="Identity Management"
      title="Tokens"
      description="Manage tenant-scoped credentials. Secrets are shown once at creation."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{result.data.length} token{result.data.length !== 1 ? "s" : ""} issued</div>
          <div className="flex items-center gap-2">
            <BulkCreateTokensModal disabled={result.source !== "backend"} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
            <CreateTokenForm disabled={result.source !== "backend"} existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <TokensTable actionsDisabled={result.source !== "backend"} tokens={result.data} />
        </div>

        {result.data.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Token lifecycle
            </div>
            <TokenLifecycleGantt tokens={result.data} />
          </div>
        )}
      </div>
    </SectionPage>
  );
}
