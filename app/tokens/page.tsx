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
        <Card className="rounded-[32px] border border-border bg-surface shadow-sm">
          <Card.Content className="flex h-full flex-col justify-between gap-5 p-7">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Credential operations</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">Issue tokens from a modal</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Keep the inventory visible while you create a credential, then return to the list without shifting the whole page layout.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CreateTokenForm disabled={result.source !== "backend"} existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
              {result.source !== "backend" ? <span className="text-sm text-muted-foreground">Changes are disabled while fallback data is shown.</span> : null}
              <Chip className="bg-background text-foreground ring-1 ring-border">{result.data.length} issued</Chip>
            </div>
          </Card.Content>
        </Card>
        <Card className="rounded-[32px] border border-border bg-surface shadow-sm">
          <Card.Content className="space-y-4 p-7">
            <Chip className="w-fit bg-foreground text-background">Issuance boundary</Chip>
            <div className="text-sm leading-7 text-muted-foreground">
              Token issuance now happens through the Go admin API. The secret is shown once, while the frontend continues to render only preview-safe metadata after that moment.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="rounded-[28px] border border-border bg-background shadow-none">
                <Card.Content className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Store mode</div>
                  <div className="mt-2 font-medium text-foreground">Hashed in memory</div>
                </Card.Content>
              </Card>
              <Card className="rounded-[28px] border border-border bg-background shadow-none">
                <Card.Content className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Next step</div>
                  <div className="mt-2 font-medium text-foreground">Repository-backed persistence</div>
                </Card.Content>
              </Card>
            </div>
          </Card.Content>
        </Card>
      </section>
      <Card className="rounded-[32px] border border-border bg-surface shadow-sm">
        <Card.Header className="border-b border-border pb-4">
          <Card.Title className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Issued credentials</Card.Title>
          <Card.Description className="text-sm text-muted-foreground">Preview-safe token metadata returned by the Go admin surface.</Card.Description>
        </Card.Header>
        <Card.Content className="pt-6">
          <TokensTable actionsDisabled={result.source !== "backend"} tokens={result.data} />
        </Card.Content>
      </Card>
    </SectionPage>
  );
}