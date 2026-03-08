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
    <div className="space-y-10">
      <header className="relative overflow-hidden rounded-[32px] border border-border/40 bg-surface/20 p-8 shadow-xl backdrop-blur-3xl sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute right-[-5%] top-[-10%] h-[120%] w-[40%] bg-gradient-to-br from-accent/5 to-transparent blur-2xl" />
        
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent/80">
              <Zap size={14} className="fill-accent/20" />
              {eyebrow}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground/90">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${isLive ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}>
              <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${isLive ? "bg-success" : "bg-warning"}`} />
              {isLive ? "Live Sync" : "Local Mirror"}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle size={20} />
            <div className="flex-1">
              <span className="font-bold uppercase tracking-widest text-[10px] block mb-1">Protocol Execution Error</span>
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
