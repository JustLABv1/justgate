import type { DataSource } from "@/lib/contracts";
import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Zap } from "lucide-react";

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
    <div className="space-y-8">
      <header className="rounded-[32px] border border-border bg-surface px-6 py-6 shadow-sm sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Zap size={14} />
              {eyebrow}
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Chip 
              variant="soft" 
              color={isLive ? "success" : "warning"}
              className="capitalize"
            >
              {isLive ? "Live API" : "Fallback Mode"}
            </Chip>
            <div className="hidden rounded-full border border-border bg-background p-2 text-muted-foreground sm:block">
              <ArrowUpRight size={16} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger-foreground">
            <AlertCircle size={18} />
            <p><strong>Backend Error:</strong> {error}</p>
          </div>
        )}
      </header>
      
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}
