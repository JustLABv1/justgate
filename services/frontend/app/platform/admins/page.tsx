import { PlatformAdminsTable } from "@/components/admin/platform-admins-table";
import { SectionPage } from "@/components/admin/section-page";
import { auth } from "@/lib/auth";
import { getPlatformAdmins } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function PlatformAdminsPage() {
  const session = await auth();
  if (!session?.isPlatformAdmin) {
    redirect("/");
  }

  const result = await getPlatformAdmins();

  return (
    <SectionPage
      eyebrow="Platform Admin"
      title="Platform Admins"
      description="Grant or revoke platform admin privileges for users."
      source={result.source}
      error={result.error}
    >
      <PlatformAdminsTable admins={result.data} />
    </SectionPage>
  );
}
