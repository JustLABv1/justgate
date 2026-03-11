import { AuditView } from "@/components/admin/audit-view";
import { SectionPage } from "@/components/admin/section-page";
import { getAuditEvents } from "@/lib/backend-client";

export default async function AuditPage() {
  const result = await getAuditEvents();
  const count = result.data?.length || 0;

  return (
    <SectionPage
      eyebrow="Decision Log"
      title="Audit Log"
      description="Proxy access decisions — refreshes every 15 seconds."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {count} event{count !== 1 ? "s" : ""}
        </div>
        <AuditView events={result.data || []} />
      </div>
    </SectionPage>
  );
}
