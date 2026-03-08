import { CreateTokenForm } from "@/components/admin/create-token-form";
import { SectionPage } from "@/components/admin/section-page";
import { TokensTable } from "@/components/admin/tokens-table";
import { getTenants, getTokens } from "@/lib/backend-client";
import { Card, Chip } from "@heroui/react";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function TokensPage() {
  const [result, tenants] = await Promise.all([getTokens(), getTenants()]);

  return (
    <SectionPage
      eyebrow="Identity Management"
      title="Security Protocol Tokens"
      description="The backend logic manages rotation and encryption. The control interface surfaces safe metadata and operational state."
      source={result.source}
      error={result.error}
    >
      <section className="grid gap-8 xl:grid-cols-[1fr_450px]">
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-muted-foreground" />
                 <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Active credentials</h2>
              </div>
              <Chip className="border border-border/80 bg-panel text-foreground">{result.data.length} issued tokens</Chip>
           </div>
           
            <div className="surface-card rounded-[28px] border-0 p-6 overflow-hidden relative">
              <TokensTable actionsDisabled={result.source !== "backend"} tokens={result.data} />
           </div>
        </div>

        <aside className="space-y-8">
          <Card variant="transparent" className="surface-card rounded-[32px] border-0 p-8">
            <Card.Content className="flex h-full flex-col justify-between gap-6 p-0">
              <div className="space-y-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Control action</div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground leading-tight">Generate a new identity</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Issue a new encrypted token for agents or administrative operators. Secrets are shown exactly once.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <CreateTokenForm disabled={result.source !== "backend"} existingCount={result.data.length} tenantIDs={tenants.data.map((tenant) => tenant.tenantID)} />
                <div className="flex items-center justify-between rounded-[24px] border border-border/80 bg-panel/65 px-5 py-4">
                   <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Global issuance</div>
                   <div className="text-sm font-semibold text-foreground">{result.data.length} total</div>
                </div>
              </div>
            </Card.Content>
          </Card>

          <Card variant="transparent" className="surface-card rounded-[32px] border-0 p-8">
            <h5 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <Sparkles size={16} className="text-muted-foreground" />
              Encryption protocol
            </h5>
            <div className="space-y-4">
               <div className="rounded-[24px] border border-border/80 bg-panel/60 p-4">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Statefulness</div>
                  <div className="text-sm font-semibold text-foreground">Encrypted at rest</div>
               </div>
               <div className="rounded-[24px] border border-border/80 bg-panel/60 p-4">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Authorization</div>
                  <div className="text-sm font-semibold text-foreground">Tenant-anchored scopes</div>
               </div>
               <p className="text-sm leading-7 text-muted-foreground">
                 Audit trails capture every token usage event across the proxy boundary.
               </p>
            </div>
          </Card>

          <Link href="/audit" className="surface-card flex items-center justify-between rounded-[30px] border-0 p-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Visibility</div>
              <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">Review token usage in the audit stream.</div>
            </div>
            <ArrowRight size={18} className="text-muted-foreground" />
          </Link>
        </aside>
      </section>
    </SectionPage>
  );
}