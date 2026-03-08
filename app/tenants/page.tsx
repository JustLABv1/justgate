import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { SectionPage } from "@/components/admin/section-page";
import { UpdateTenantForm } from "@/components/admin/update-tenant-form";
import { getTenants } from "@/lib/backend-client";
import { Card } from "@heroui/react";
import { ArrowRight, CheckCircle2, Globe, Shield, Activity } from "lucide-react";
import Link from "next/link";

export default async function TenantsPage() {
  const result = await getTenants();

  return (
    <SectionPage
      eyebrow="Upstream Binding"
      title="Global Tenant Registry"
      description="Manage top-level organizational boundaries. Each tenant acts as an isolated namespace for routes and security tokens."
      source={result.source}
      error={result.error}
    >
      <section className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 px-2 text-foreground">
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-muted-foreground" />
               <h2 className="text-xl font-semibold tracking-[-0.03em] leading-none">Registered realms</h2>
            </div>
            <CreateTenantForm disabled={result.source !== "backend"} existingCount={result.data.length} />
          </div>

          {result.data.length === 0 ? (
            <div className="enterprise-empty-state">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <Globe size={14} />
                No tenant boundaries
              </div>
              <div className="enterprise-empty-state__title">The registry is empty.</div>
              <div className="enterprise-empty-state__copy">
                Start by creating the first tenant boundary. Each tenant defines the upstream destination and identity header used by routes and scoped credentials.
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {result.data.map((tenant, idx) => (
              <Card key={tenant.id} variant="transparent" className="surface-card group relative overflow-hidden rounded-[24px] border-0 p-5 transition-all animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="absolute right-[-10px] top-[-10px] opacity-[0.025] grayscale">
                   <Shield size={120} />
                </div>
                
                <Card.Content className="relative z-10 flex flex-col gap-4 p-0">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Tenant binding</div>
                      <div className="font-mono text-base font-semibold tracking-tight text-foreground uppercase">{tenant.tenantID}</div>
                    </div>
                    <div className="flex gap-2">
                      <UpdateTenantForm key={`${tenant.id}:${tenant.tenantID}:${tenant.upstreamURL}:${tenant.headerName}:${tenant.name}`} disabled={result.source !== "backend"} tenant={tenant} />
                      <DeleteTenantButton disabled={result.source !== "backend"} tenantID={tenant.tenantID} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Upstream endpoint</div>
                       <div className="font-mono text-xs font-semibold text-foreground truncate break-all">{tenant.upstreamURL}</div>
                    </div>
                    <div className="flex items-center gap-4 border-t border-border/35 pt-3">
                     <div className="flex items-center gap-2 rounded-full border border-border/80 bg-panel/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                         <Activity size={10} className="text-success" />
                       Header key
                      </div>
                     <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-foreground">
                       <Shield size={14} className="text-muted-foreground" />
                         {tenant.headerName}
                      </div>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
          )}
        </div>

        <aside className="space-y-8">
          <div className="surface-card rounded-[32px] border-0 p-8 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(100,116,139,0.06),transparent)]" />
            
            <h2 className="relative z-10 mb-6 text-lg font-semibold tracking-[-0.03em] text-foreground">Workflow sequence</h2>
            <div className="relative z-10 space-y-6">
              {[
                { done: result.data.length > 0, title: "Identity Definition", description: "Establish the primary tenant ID and upstream URL link." },
                { done: false, title: "Routing Logic", description: "Map proxy slugs to this tenant in the Routes panel." },
                { done: false, title: "Credential Issuance", description: "Generate secure access tokens for agents or operators." },
              ].map((step, idx) => (
                <div key={step.title} className="flex gap-4 group">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all ${step.done ? "border-success/50 bg-success/10 text-success" : "border-border/80 bg-panel/70 text-muted-foreground"}`}>
                      {step.done ? <CheckCircle2 size={14} strokeWidth={3} /> : <span className="text-[10px] font-black">{idx + 1}</span>}
                    </div>
                    {idx < 2 && <div className="w-px flex-1 bg-border/40" />}
                  </div>
                  <div className="pb-4 text-foreground">
                    <div className={`text-sm font-semibold tracking-[-0.02em] ${step.done ? "text-success" : ""}`}>{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground transition-colors">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

           <Link href="/routes" className="surface-card group flex items-center justify-between rounded-[30px] border-0 p-6 transition-all active:scale-95 overflow-hidden relative">
            <div className="absolute right-[-10px] top-[-10px] opacity-10 text-accent">
               <ArrowRight size={80} />
            </div>
            <div className="relative z-10 flex flex-col text-foreground">
               <span className="mb-1 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Bridge interface</span>
              <span className="text-sm font-semibold">Configure proxy routes</span>
            </div>
            <ArrowRight size={18} className="text-muted-foreground" />
          </Link>
        </aside>
      </section>
    </SectionPage>
  );
}
