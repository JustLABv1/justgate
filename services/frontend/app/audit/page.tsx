import { AuditView } from "@/components/admin/audit-view";
import { LiveAuditStream } from "@/components/admin/live-audit-stream";
import { SectionPage } from "@/components/admin/section-page";
import { getAuditEventsPaginated } from "@/lib/backend-client";

const PAGE_SIZE = 20;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);

  const result = await getAuditEventsPaginated(page, PAGE_SIZE);
  const { items, total, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SectionPage
      eyebrow="Decision Log"
      title="Audit Log"
      description="Proxy access decisions — refreshes every 15 seconds."
      source={result.source}
      error={result.error}
    >
      <div className="mb-4 flex justify-end">
        <LiveAuditStream />
      </div>
      <AuditView
        events={items ?? []}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
      />
    </SectionPage>
  );
}

