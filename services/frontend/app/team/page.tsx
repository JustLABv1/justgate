import { InviteModal } from "@/components/admin/invite-modal";
import { SectionPage } from "@/components/admin/section-page";
import { TeamMembersTable } from "@/components/admin/team-members-table";
import { auth } from "@/lib/auth";
import { getOrgMembers, getOrgs } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  const session = await auth();

  if (!session?.activeOrgId) {
    // No org selected — send to home where onboarding modal will guide setup
    redirect("/");
  }

  const orgID = session.activeOrgId;

  const [orgsResult, membersResult] = await Promise.all([
    getOrgs(),
    getOrgMembers(orgID),
  ]);

  const activeOrg = orgsResult.data.find((o) => o.id === orgID);
  const isOwner = activeOrg?.role === "owner";
  const currentUserID = session.user?.id ?? "";

  return (
    <SectionPage
      eyebrow="Organisation"
      title="Team"
      description="Manage members of your organisation and invite new teammates."
      source={membersResult.source}
      error={membersResult.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {membersResult.data.length} member{membersResult.data.length !== 1 ? "s" : ""}
            {activeOrg ? ` in ${activeOrg.name}` : ""}
          </div>
          <InviteModal orgID={orgID} isOwner={isOwner ?? false} />
        </div>

        <TeamMembersTable
          members={membersResult.data}
          orgID={orgID}
          currentUserID={currentUserID}
          isOwner={isOwner ?? false}
        />
      </div>
    </SectionPage>
  );
}
