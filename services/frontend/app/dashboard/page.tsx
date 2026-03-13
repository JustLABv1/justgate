import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { SectionPage } from "@/components/admin/section-page";
import { getTrafficOverview, getTrafficStats } from "@/lib/backend-client";

export default async function DashboardPage() {
  const [statsResult, overviewResult] = await Promise.all([
    getTrafficStats(24),
    getTrafficOverview(),
  ]);

  const source =
    statsResult.source === "backend" && overviewResult.source === "backend"
      ? "backend" as const
      : "fallback" as const;
  const error = statsResult.error || overviewResult.error || undefined;

  return (
    <SectionPage
      eyebrow="Analytics"
      title="Dashboard"
      description="Traffic analytics and metrics aggregation — last 24 hours."
      source={source}
      error={error}
    >
      <DashboardCharts stats={statsResult.data} overview={overviewResult.data} />
    </SectionPage>
  );
}
