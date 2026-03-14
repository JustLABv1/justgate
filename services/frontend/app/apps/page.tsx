import { CreateAppModal } from "@/components/admin/create-app-modal";
import { ProtectedAppsTable } from "@/components/admin/protected-apps-table";
import { SectionPage } from "@/components/admin/section-page";
import { UpstreamConfigGuide } from "@/components/admin/upstream-config-guide";
import { getProtectedApps } from "@/lib/backend-client";

export default async function ProtectedAppsPage() {
  const result = await getProtectedApps();

  return (
    <SectionPage
      eyebrow="Proxy"
      title="Protected Apps"
      description="Secure upstream services with OIDC browser login or bearer tokens. Users are proxied through JustGate with identity headers injected."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {result.data.length} app{result.data.length !== 1 ? "s" : ""} configured
          </div>
          <CreateAppModal disabled={result.source !== "backend"} existingCount={result.data.length} />
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <ProtectedAppsTable apps={result.data} actionsDisabled={result.source !== "backend"} />
        </div>

        <UpstreamConfigGuide />
      </div>
    </SectionPage>
  );
}
