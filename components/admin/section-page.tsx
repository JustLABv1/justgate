import type { DataSource } from "@/lib/contracts";
import type { ReactNode } from "react";
import { AlertCircle, Database } from "lucide-react";

interface SectionPageProps {
  eyebrow: string;
  title: string;
  description: string;
  source: DataSource;
  error?: string;
  children: ReactNode;
}

export function SectionPage({
  eyebrow,
  title,
  description,
  source,
  error,
  children,
}: SectionPageProps) {
  const isLive = source === "backend";

  return (
    <div className="space-y-10">
      <header className="surface-card relative overflow-hidden rounded-[34px] px-8 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(100,116,139,0.07),transparent)]" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-panel/80 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              {eyebrow}
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl">
              {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {description}
              </p>
            </div>
          </div>

          <div className="surface-card-muted min-w-[240px] rounded-[28px] p-5">
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isLive ? "bg-success/12 text-success" : "bg-warning/16 text-warning"}`}>
                <Database size={18} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Data Source</div>
                <div className="mt-1 text-base font-semibold">{isLive ? "Live backend" : "Local mirror"}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`h-2.5 w-2.5 rounded-full ${isLive ? "bg-success" : "bg-warning"}`} />
              {isLive ? "Changes are available immediately." : "Write actions are temporarily read-only."}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 flex items-center gap-4 rounded-[24px] border border-danger/30 bg-danger/10 p-5 text-sm text-danger animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle size={20} />
            <div className="flex-1">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.24em]">Backend warning</span>
              <p className="font-medium opacity-90">{error}</p>
            </div>
          </div>
        )}
      </header>
      
      <div className="space-y-10 pb-10">
        {children}
      </div>
    </div>
  );
}
