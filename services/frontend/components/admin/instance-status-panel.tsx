"use client";

import type { ReplicaInfo } from "@/lib/contracts";
import { Cpu } from "lucide-react";
import { useEffect, useState } from "react";

interface InstanceStatusPanelProps {
  initialReplicas: ReplicaInfo[];
}

function statusColor(status: string) {
  if (status === "online") return "bg-success";
  if (status === "degraded") return "bg-warning";
  return "bg-danger";
}

function statusText(status: string) {
  if (status === "online") return "text-success";
  if (status === "degraded") return "text-warning";
  return "text-danger";
}

function timeSince(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function InstanceStatusPanel({ initialReplicas }: InstanceStatusPanelProps) {
  const [replicas, setReplicas] = useState<ReplicaInfo[]>(initialReplicas);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      fetch("/api/admin/platform/replicas", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setReplicas(data); })
        .catch(() => {});
    };
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (replicas.length === 0) return null;

  const onlineCount = replicas.filter((r) => {
    const ms = now - new Date(r.lastHeartbeat).getTime();
    return ms < 120_000;
  }).length;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Cpu size={11} />
        Instances
        <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success normal-case tracking-normal">
          {onlineCount}/{replicas.length} online
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {replicas.map((replica) => {
          const ms = now - new Date(replica.lastHeartbeat).getTime();
          const status = ms < 30_000 ? "online" : ms < 120_000 ? "degraded" : "offline";
          return (
            <div key={replica.instanceID} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor(status)}`} />
                <span className="truncate font-mono text-muted-foreground" title={replica.instanceID}>
                  {replica.hostname || replica.instanceID.slice(0, 12)}
                </span>
                {replica.region && replica.region !== "default" && (
                  <span className="shrink-0 rounded-sm bg-panel px-1 py-0.5 text-[9px] font-medium text-muted-foreground/70">
                    {replica.region}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[10px]">
                <span className="text-muted-foreground/60">{replica.lastHeartbeat ? timeSince(replica.lastHeartbeat, now) : "—"}</span>
                <span className={`font-medium ${statusText(status)}`}>{status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
