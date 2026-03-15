"use client";

import type { DataSource } from "@/lib/contracts";
import { motion } from "framer-motion";
import { AlertCircle, Building2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

interface SectionPageProps {
  eyebrow: string;
  title: string;
  description: string;
  source: DataSource;
  error?: string;
  children: ReactNode;
}

function friendlyError(raw: string): { message: string; isOrgRequired: boolean } {
  if (/X-Org-ID|org.id.header/i.test(raw)) {
    return { message: "", isOrgRequired: true };
  }
  if (/503|unavailable|connect/i.test(raw)) {
    return { message: "The backend is unreachable. Check that JustGate is running and accessible.", isOrgRequired: false };
  }
  if (/401|unauthorized/i.test(raw)) {
    return { message: "Authorization failed. The admin token may be misconfigured.", isOrgRequired: false };
  }
  if (/404/i.test(raw)) {
    return { message: "The requested resource was not found on the backend.", isOrgRequired: false };
  }
  if (/timeout/i.test(raw)) {
    return { message: "The backend took too long to respond. It may be overloaded.", isOrgRequired: false };
  }
  if (/500|internal/i.test(raw)) {
    return { message: "The backend returned an internal error. Check its logs for details.", isOrgRequired: false };
  }
  return { message: raw, isOrgRequired: false };
}

export function SectionPage({
  eyebrow: _eyebrow,
  title,
  description,
  source,
  error,
  children,
}: SectionPageProps) {
  const router = useRouter();
  const isLive = source === "backend";
  const parsed = error ? friendlyError(error) : null;

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
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

      {parsed?.isOrgRequired ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface px-8 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 size={22} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">No organisation selected</p>
            <p className="text-sm text-muted-foreground">
              This page requires an active organisation. Create one or ask to be invited to an existing one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to Overview
          </button>
        </div>
      ) : parsed?.message ? (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{parsed.message}</p>
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
      ) : null}

      {!parsed?.isOrgRequired && children}
    </motion.div>
  );
}
