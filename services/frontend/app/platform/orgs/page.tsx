import { PlatformOrgsTable } from "@/components/admin/platform-orgs-table";
import { SectionPage } from "@/components/admin/section-page";
import { auth } from "@/lib/auth";
import { getAdminOrgs } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function PlatformOrgsPage() {
  const session = await auth();
  if (!session?.isPlatformAdmin) {
    redirect("/");
  }

  const result = await getAdminOrgs();

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
        <PlatformOrgsTable orgs={result.data} />
      </div>
    </SectionPage>
  );
}
