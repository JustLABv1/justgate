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
      <Card className="rounded-[32px] border border-border bg-surface shadow-sm">
        <Card.Header className="border-b border-border pb-4">
          <Card.Title className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Recent proxy outcomes</Card.Title>
          <Card.Description className="text-sm text-muted-foreground">Latest decision trail recorded by the Go runtime.</Card.Description>
        </Card.Header>
        <Card.Content className="pt-6">
          <AuditTable events={result.data} />
        </Card.Content>
      </Card>
    </SectionPage>
  );
}