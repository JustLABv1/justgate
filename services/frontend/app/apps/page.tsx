import { CreateAppModal } from "@/components/admin/create-app-modal";
import { ProtectedAppsTable } from "@/components/admin/protected-apps-table";
import { SectionPage } from "@/components/admin/section-page";
import { UpstreamConfigGuide } from "@/components/admin/upstream-config-guide";
import { getAppSessions, getAppTokens, getProtectedApps } from "@/lib/backend-client";

export default async function ProtectedAppsPage() {
  const result = await getProtectedApps();
  const apps = result.data;

  // Fetch session + token counts for all apps in parallel
  const [sessionResults, tokenResults] = await Promise.all([
    Promise.all(apps.map((a) => getAppSessions(a.id).then((r) => ({ id: a.id, count: r.data.length })))),
    Promise.all(apps.map((a) => getAppTokens(a.id).then((r) => ({ id: a.id, count: r.data.filter((t) => t.active).length })))),
  ]);

  const sessionCountByApp = Object.fromEntries(sessionResults.map((r) => [r.id, r.count]));
  const tokenCountByApp = Object.fromEntries(tokenResults.map((r) => [r.id, r.count]));

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
            {apps.length} app{apps.length !== 1 ? "s" : ""} configured
          </div>
          <CreateAppModal disabled={result.source !== "backend"} existingCount={apps.length} />
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <ProtectedAppsTable
            apps={apps}
            actionsDisabled={result.source !== "backend"}
            sessionCountByApp={sessionCountByApp}
            tokenCountByApp={tokenCountByApp}
          />
        </div>

        <UpstreamConfigGuide />
      </div>
    </SectionPage>
  );
}
