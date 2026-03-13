import { SectionPage } from "@/components/admin/section-page";
import { SessionsTable } from "@/components/admin/sessions-table";
import { getAdminSessions } from "@/lib/backend-client";

export default async function SessionsPage() {
  const result = await getAdminSessions();

  return (
    <SectionPage
      eyebrow="Security"
      title="Sessions"
      description="Active admin sessions. Revoke sessions to force re-authentication."
      source={result.source}
      error={result.error}
    >
      <SessionsTable sessions={result.data} />
    </SectionPage>
  );
}
