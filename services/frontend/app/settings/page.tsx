import { OIDCOrgMappings } from "@/components/admin/oidc-org-mappings";
import { OIDCProviderDocs } from "@/components/admin/oidc-provider-docs";
import { OIDCSettingsForm } from "@/components/admin/oidc-settings-form";
import { SectionPage } from "@/components/admin/section-page";
import { auth } from "@/lib/auth";
import { getOIDCConfig, getOIDCOrgMappings } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.isPlatformAdmin) {
    redirect("/");
  }

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
        <OIDCProviderDocs />
        <OIDCOrgMappings initialMappings={mappingsResult.data} />
      </div>
    </SectionPage>
  );
}
