import { AuditTable } from "@/components/admin/audit-table";
import { SectionPage } from "@/components/admin/section-page";
import { getAuditEvents } from "@/lib/backend-client";
import { Card } from "@heroui/react";
import { ShieldAlert, Terminal, Activity, Fingerprint } from "lucide-react";

export default async function AuditPage() {
  const result = await getAuditEvents();

  return (
    <SectionPage
      eyebrow="Decision Log"
      title="Recent Proxy Outcomes"
      description="Real-time audit trail of all authenticated proxy transitions."
      source={result.source}
      error={result.error}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="flex items-center justify-between px-2 text-foreground">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Live feed active</span>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              TOTAL_RECORDS: {result.data?.length || 0}
            </div>
          </div>
          
          <AuditTable events={result.data || []} />
        </div>

        <aside className="hidden lg:block space-y-6 pt-2">
        <Card variant="transparent" className="surface-card rounded-[30px] border-0 p-6">
           <div className="flex items-center gap-3 mb-6 text-foreground">
              <ShieldAlert className="text-muted-foreground" size={18} />
              <h3 className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Audit protocol</h3>
           </div>
           
           <div className="space-y-4">
              {[
                { label: "Retention", value: "Rolling 48h", icon: <Activity size={12} /> },
                { label: "Data Integrity", value: "SHA-256 Signed", icon: <Fingerprint size={12} /> },
                { label: "Logging Sink", value: "Go-Runtime-Internal", icon: <Terminal size={12} /> }
              ].map((item) => (
                <div key={item.label} className="group flex items-center justify-between rounded-[22px] border border-border/80 bg-panel/60 p-4 text-foreground">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold">{item.value}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {item.icon}
                  </div>
                </div>
              ))}
           </div>

           <div className="mt-8 rounded-[24px] border border-border/80 bg-panel/55 p-4 text-center">
              <div className="text-sm leading-6 text-muted-foreground">
                &quot;Audit logs are currently held in memory. Future updates will include persistent storage integration.&quot;
              </div>
           </div>
        </Card>
        </aside>
      </div>
    </SectionPage>
  );
}
