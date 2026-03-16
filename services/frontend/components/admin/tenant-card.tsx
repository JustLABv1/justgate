"use client";

import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { HealthHistory } from "@/components/admin/health-history";
import { TenantUpstreams } from "@/components/admin/tenant-upstreams";
import { UpdateTenantForm } from "@/components/admin/update-tenant-form";
import type { TenantSummary } from "@/lib/contracts";
import { Button } from "@heroui/react";
import { ChevronDown, Shield, Shuffle } from "lucide-react";
import { useState } from "react";

interface TenantCardProps {
  tenant: TenantSummary;
  disabled?: boolean;
  animationDelay?: number;
}

export function TenantCard({ tenant, disabled, animationDelay = 0 }: TenantCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    tenant.upstreamStatus === "up"
      ? "var(--success)"
      : tenant.upstreamStatus === "down"
        ? "var(--destructive)"
        : "var(--muted)";

  const statusTitle =
    tenant.upstreamStatus === "up"
      ? `Up — ${tenant.upstreamLatencyMs ?? 0}ms`
      : tenant.upstreamStatus === "down"
        ? `Down — ${tenant.upstreamError || "unreachable"}`
        : "No health check";

  const upstreamCount = tenant.upstreams?.length ?? 0;

  return (
    <div
      className="animate-in fade-in duration-300 fill-mode-both"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* ── Compact header row ─────────────────────────────────── */}
      <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel/40">
        {/* Status dot */}
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: statusColor }}
          title={statusTitle}
        />

        {/* Identity */}
        <div className="min-w-0 flex-1 flex items-center gap-3 overflow-hidden">
          <span className="shrink-0 font-mono text-sm font-semibold uppercase tracking-tight text-foreground">
            {tenant.tenantID}
          </span>
          <span
            className={`truncate font-mono text-xs ${upstreamCount > 0 ? "text-muted-foreground/35 line-through decoration-muted-foreground/25" : "text-muted-foreground"}`}
            title={upstreamCount > 0 ? `${tenant.upstreamURL} — bypassed by load-balancing upstreams` : tenant.upstreamURL}
          >
            {tenant.upstreamURL}
          </span>
          {upstreamCount > 0 && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning/80">
              <Shuffle size={9} />
              {upstreamCount} LB active
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="hidden sm:flex shrink-0 items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Shield size={9} className="text-muted-foreground/50" />
            {tenant.headerName}
          </span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
          <UpdateTenantForm
            key={`${tenant.id}:${tenant.tenantID}:${tenant.upstreamURL}:${tenant.headerName}:${tenant.name}`}
            disabled={disabled}
            tenant={tenant}
          />
          <DeleteTenantButton disabled={disabled} id={tenant.id} />
          <Button
            className="h-7 w-7 min-w-7 rounded-md px-0 text-muted-foreground/60"
            size="sm"
            variant="ghost"
            aria-label={expanded ? "Collapse" : "Expand"}
            onPress={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              size={14}
              className="transition-transform duration-200"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </Button>
        </div>
      </div>

      {/* ── Expanded detail panel ──────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border/50 bg-panel/20 px-4 pb-4">
          <TenantUpstreams tenantInternalID={tenant.id} />
          <HealthHistory tenantID={tenant.tenantID} />
        </div>
      )}
    </div>
  );
}
