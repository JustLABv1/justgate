import { CreateTokenForm } from "@/components/admin/create-token-form";
import { SectionPage } from "@/components/admin/section-page";
import { TokensTable } from "@/components/admin/tokens-table";
import { getTenants, getTokens } from "@/lib/backend-client";
import { Card, Chip } from "@heroui/react";

export default async function TokensPage() {
  const [result, tenants] = await Promise.all([getTokens(), getTenants()]);

  return (
    <SectionPage
      eyebrow="Token inventory"
      title="Issued credentials"
      description="The eventual create and rotate flows will remain in Go. The frontend surfaces only preview-safe token metadata and operational status."
      source={result.source}
      error={result.error}
    >
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateTokenForm existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
        <Card className="border border-slate-900/10 bg-slate-950 text-slate-100 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)]">
          <Card.Content className="space-y-4 p-7">
            <Chip className="w-fit bg-white/10 text-slate-200">Issuance boundary</Chip>
            <div className="text-sm leading-7 text-slate-300">
              Token issuance now happens through the Go admin API. The secret is shown once, while the frontend continues to render only preview-safe metadata after that moment.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Store mode</div>
                  <div className="mt-2 font-medium text-white">Hashed in memory</div>
                </Card.Content>
              </Card>
              <Card className="border border-white/10 bg-white/5 text-slate-100">
                <Card.Content className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Next step</div>
                  <div className="mt-2 font-medium text-white">Repository-backed persistence</div>
                </Card.Content>
              </Card>
            </div>
          </Card.Content>
        </Card>
      </section>
      <Card className="border border-slate-900/10 bg-white/84 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.4)]">
        <Card.Header className="border-b border-slate-900/10 pb-4">
          <Card.Title className="font-display text-2xl text-slate-950">Issued credentials</Card.Title>
          <Card.Description className="text-sm text-slate-600">Preview-safe token metadata returned by the Go admin surface.</Card.Description>
        </Card.Header>
        <Card.Content className="pt-6">
          <TokensTable tokens={result.data} />
        </Card.Content>
      </Card>
    </SectionPage>
  );
}