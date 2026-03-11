"use client";

import type { DataSource } from "@/lib/contracts";
import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface SectionPageProps {
  eyebrow: string;
  title: string;
  description: string;
  source: DataSource;
  error?: string;
  children: ReactNode;
}

function friendlyError(raw: string): string {
  if (/503|unavailable|connect/i.test(raw)) return "The backend is unreachable. Check that JustGate is running and accessible.";
  if (/401|unauthorized/i.test(raw)) return "Authorization failed. The admin token may be misconfigured.";
  if (/404/i.test(raw)) return "The requested resource was not found on the backend.";
  if (/timeout/i.test(raw)) return "The backend took too long to respond. It may be overloaded.";
  if (/500|internal/i.test(raw)) return "The backend returned an internal error. Check its logs for details.";
  return raw;
}

export function SectionPage({
  eyebrow,
  title,
  description,
  source,
  error,
  children,
}: SectionPageProps) {
  const router = useRouter();
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
        <div className="flex items-start justify-between gap-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{friendlyError(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-danger/20 bg-danger/8 px-2.5 py-1 text-[12px] font-medium text-danger transition-colors hover:bg-danger/14"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )}

      {children}
    </div>
  );
}
