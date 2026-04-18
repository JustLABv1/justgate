import { AdminAuditView } from "@/components/admin/admin-audit-view";
import { AuditView } from "@/components/admin/audit-view";
import { LiveAuditStream } from "@/components/admin/live-audit-stream";
import { SectionPage } from "@/components/admin/section-page";
import { getAdminAuditEvents, getAuditEventsPaginated, getAuditEventsPaginatedFiltered } from "@/lib/backend-client";

const PAGE_SIZE = 20;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
  const statusFilter = String(sp.status ?? "all");
  const tenantFilter = String(sp.tenant ?? "");
  const routeFilter = String(sp.route ?? "");
  const fromFilter = String(sp.from ?? "");
  const toFilter = String(sp.to ?? "");
  const activeTab = String(sp.tab ?? "proxy");

  const hasFilters = statusFilter !== "all" || tenantFilter !== "" || routeFilter !== "" || fromFilter !== "" || toFilter !== "";

  const [proxyResult, adminResult] = await Promise.all([
    hasFilters
      ? getAuditEventsPaginatedFiltered(page, PAGE_SIZE, {
          status: statusFilter,
          tenantID: tenantFilter,
          routeSlug: routeFilter,
        })
      : getAuditEventsPaginated(page, PAGE_SIZE),
    getAdminAuditEvents(page, PAGE_SIZE),
  ]);

  const result = proxyResult;
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
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-1 w-fit">
          {[{ id: "proxy", label: "Proxy Traffic" }, { id: "admin", label: "Admin Activity" }].map((tab) => (
            <a
              key={tab.id}
              href={`?tab=${tab.id}`}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-surface text-foreground shadow-[var(--field-shadow)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        {activeTab === "proxy" && (
          <>
            <div className="flex justify-end">
              <LiveAuditStream />
            </div>
            <AuditView
              events={items ?? []}
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              initialStatusFilter={statusFilter}
              initialTenantFilter={tenantFilter}
              initialRouteFilter={routeFilter}
              initialFrom={fromFilter}
              initialTo={toFilter}
            />
          </>
        )}

        {activeTab === "admin" && (
          <AdminAuditView
            events={adminResult.data.items ?? []}
            page={page}
            pageSize={pageSize}
            total={adminResult.data.total}
            totalPages={Math.max(1, Math.ceil(adminResult.data.total / pageSize))}
          />
        )}
      </div>
    </SectionPage>
  );
}

