import { AuditTable } from "@/components/admin/audit-table";
import { SectionPage } from "@/components/admin/section-page";
import { getAuditEvents } from "@/lib/backend-client";

export default async function AuditPage() {
  const result = await getAuditEvents();

  return (
    <SectionPage
      eyebrow="Decision Log"
      title="Audit Log"
      description="Real-time trail of all proxy transitions and access decisions."
      source={result.source}
      error={result.error}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{result.data?.length || 0} event{(result.data?.length || 0) !== 1 ? "s" : ""}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            Live feed
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <AuditTable events={result.data || []} />
        </div>
      </div>
    </SectionPage>
  );
}
