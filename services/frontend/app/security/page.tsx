import { OrgIPRulesTable } from "@/components/admin/org-ip-rules-table";
import { SectionPage } from "@/components/admin/section-page";
import { auth } from "@/lib/auth";
import { getOrgIPRules } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function SecurityPage() {
  const session = await auth();

  if (!session?.activeOrgId) {
    redirect("/");
  }

  const rulesResult = await getOrgIPRules();

  return (
    <SectionPage
      eyebrow="Organisation"
      title="IP Allowlist"
      description="Restrict access to all routes and apps in this organisation to specific IP ranges. When any rules are configured, only matching IPs are allowed through."
      source={rulesResult.source}
      error={rulesResult.error}
    >
      <OrgIPRulesTable rules={rulesResult.data} />
    </SectionPage>
  );
}
