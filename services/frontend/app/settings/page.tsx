import { OIDCOrgMappings } from "@/components/admin/oidc-org-mappings";
import { OIDCSettingsForm } from "@/components/admin/oidc-settings-form";
import { SectionPage } from "@/components/admin/section-page";
import { getOIDCConfig, getOIDCOrgMappings } from "@/lib/backend-client";

export default async function SettingsPage() {
  const [oidcResult, mappingsResult] = await Promise.all([
    getOIDCConfig(),
    getOIDCOrgMappings(),
  ]);

  return (
    <SectionPage
      eyebrow="Administration"
      title="Settings"
      description="Configure authentication providers and system settings."
      source={oidcResult.source}
      error={oidcResult.error}
    >
      <div className="space-y-6">
        <OIDCSettingsForm initial={oidcResult.data} />
        <OIDCOrgMappings initialMappings={mappingsResult.data} />
      </div>
    </SectionPage>
  );
}
