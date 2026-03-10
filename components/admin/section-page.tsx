import type { DataSource } from "@/lib/contracts";
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

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
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
          <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${isLive ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-success" : "bg-warning"}`} />
            {isLive ? "Live" : "Cached"}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {children}
    </div>
  );
}
