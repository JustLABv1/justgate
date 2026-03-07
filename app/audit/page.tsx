import { AuditTable } from "@/components/admin/audit-table";
import { SectionPage } from "@/components/admin/section-page";
import { getAuditEvents } from "@/lib/backend-client";
import { Card } from "@heroui/react";

export default async function AuditPage() {
  const result = await getAuditEvents();

  return (
    <SectionPage
      eyebrow="Audit feed"
      title="Recent proxy outcomes"
      description="This feed comes from the Go control API and will later be backed by persistent audit storage once the repository layer is introduced."
      source={result.source}
      error={result.error}
    >
      <Card className="border border-slate-900/10 bg-white/84 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.4)]">
        <Card.Header className="border-b border-slate-900/10 pb-4">
          <Card.Title className="font-display text-2xl text-slate-950">Recent proxy outcomes</Card.Title>
          <Card.Description className="text-sm text-slate-600">Latest decision trail recorded by the Go runtime.</Card.Description>
        </Card.Header>
        <Card.Content className="pt-6">
          <AuditTable events={result.data} />
        </Card.Content>
      </Card>
    </SectionPage>
  );
}