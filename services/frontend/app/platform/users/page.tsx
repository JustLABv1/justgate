import { PlatformUsersTable } from "@/components/admin/platform-users-table";
import { SectionPage } from "@/components/admin/section-page";
import { auth } from "@/lib/auth";
import { getAdminUsers } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function PlatformUsersPage() {
  const session = await auth();
  if (!session?.isPlatformAdmin) {
    redirect("/");
  }

  const result = await getAdminUsers();

  return (
    <SectionPage
      eyebrow="Platform Admin"
      title="All Users"
      description="View and manage all users across the platform."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {result.data.length} user{result.data.length !== 1 ? "s" : ""} total
        </div>
        <PlatformUsersTable users={result.data} />
      </div>
    </SectionPage>
  );
}
