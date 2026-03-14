"use client";

import type { AuditEvent } from "@/lib/contracts";
import { motion } from "framer-motion";

interface ActivityFeedProps {
  events: AuditEvent[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(status: number): string {
  if (status >= 500) return "text-danger";
  if (status >= 400) return "text-warning";
  if (status >= 200 && status < 300) return "text-success";
  return "text-muted-foreground";
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-[12px] text-muted-foreground">No recent traffic</p>
    );
  }

  return (
    <motion.ul
      className="divide-y divide-border/60"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {events.slice(0, 5).map((ev) => (
        <motion.li
          key={ev.id}
          variants={item}
          className="flex items-center gap-3 px-5 py-2"
        >
          <span className="w-10 shrink-0 text-right font-mono text-[11px] font-semibold text-muted-foreground">
            {ev.method}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
            /proxy/{ev.routeSlug}
          </span>
          <span className={`shrink-0 font-mono text-[12px] font-semibold ${statusColor(ev.status)}`}>
            {ev.status}
          </span>
          <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground/60">
            {ev.latencyMs}ms
          </span>
          <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground/50">
            {relativeTime(ev.timestamp)}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  );
}
