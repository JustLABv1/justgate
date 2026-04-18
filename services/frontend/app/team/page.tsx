import { AddMemberModal } from "@/components/admin/add-member-modal";
import { InviteModal } from "@/components/admin/invite-modal";
import { PendingInvitesList } from "@/components/admin/pending-invites-list";
import { SectionPage } from "@/components/admin/section-page";
import { TeamMembersTable } from "@/components/admin/team-members-table";
import { auth } from "@/lib/auth";
import { getOrgInvites, getOrgMembers, getOrgs } from "@/lib/backend-client";
import { redirect } from "next/navigation";

export default async function TeamPage() {
  const session = await auth();

  if (!session?.activeOrgId) {
    redirect("/");
  }

  const orgID = session.activeOrgId;

  const [orgsResult, membersResult, invitesResult] = await Promise.all([
    getOrgs(),
    getOrgMembers(orgID),
    getOrgInvites(orgID),
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
          <div className="flex items-center gap-2">
            <AddMemberModal orgID={orgID} isOwner={isOwner ?? false} />
            <InviteModal orgID={orgID} isOwner={isOwner ?? false} />
          </div>
        </div>

        <TeamMembersTable
          members={membersResult.data}
          orgID={orgID}
          currentUserID={currentUserID}
          isOwner={isOwner ?? false}
        />

        {isOwner && invitesResult.data.length > 0 && (
          <PendingInvitesList invites={invitesResult.data} orgID={orgID} />
        )}
      </div>
    </SectionPage>
  );
}
