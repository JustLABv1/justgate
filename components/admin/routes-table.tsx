"use client";

import type { RouteSummary } from "@/lib/contracts";
import { Card, Chip } from "@heroui/react";

interface RoutesTableProps {
  routes: RouteSummary[];
}

export function RoutesTable({ routes }: RoutesTableProps) {
  return (
    <div className="space-y-3">
      {routes.map((route) => (
        <Card key={route.id} className="border border-slate-900/10 bg-[rgba(252,250,245,0.7)] shadow-none">
          <Card.Content className="grid gap-4 p-5 lg:grid-cols-[1.5fr_1fr_1fr_0.9fr_0.9fr] lg:items-center">
            <div>
              <div className="font-medium text-slate-950">/proxy/{route.slug}</div>
              <div className="text-sm text-slate-500">{route.id}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tenant</div>
              <div className="mt-1 text-slate-900">{route.tenantID}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Upstream path</div>
              <div className="mt-1 font-mono text-sm text-slate-900">{route.targetPath}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Scope</div>
              <Chip className="mt-2 bg-slate-100 text-slate-800">{route.requiredScope}</Chip>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Methods</div>
              <div className="mt-1 text-slate-900">{route.methods.join(", ")}</div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}