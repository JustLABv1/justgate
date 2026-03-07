import type { DataSource } from "@/lib/contracts";
import { Card, Chip } from "@heroui/react";
import type { ReactNode } from "react";

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
  return (
    <div className="space-y-6">
      <Card className="border border-slate-900/10 bg-white/84 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.4)]">
        <Card.Content className="p-7 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl text-slate-950 sm:text-4xl">{title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
          </div>
          <Chip className="bg-slate-950 text-white">
            {source === "backend" ? "Live Go API" : "Fallback contract"}
          </Chip>
          </div>
          {error ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Backend request failed: {error}
            </div>
          ) : null}
        </Card.Content>
      </Card>
      {children}
    </div>
  );
}