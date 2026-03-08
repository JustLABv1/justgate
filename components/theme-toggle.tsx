"use client";

import { Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@heroui/react";
import { type Theme, useTheme } from "./theme-provider";

const options: Array<{
  key: Theme;
  label: string;
  icon: typeof Sun;
}> = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Laptop },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface/90 p-1 shadow-[var(--field-shadow)] backdrop-blur-sm">
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.key;
        const usingSystem = option.key === "system" && theme === "system";

        return (
          <Button
            key={option.key}
            aria-pressed={active}
            className={[
              "h-9 min-w-0 rounded-full px-3 text-sm font-medium transition-all",
              active
                ? "border border-border/70 bg-surface text-foreground shadow-[var(--field-shadow)]"
                : "bg-transparent text-muted-foreground hover:bg-background hover:text-foreground",
            ].join(" ")}
            onPress={() => setTheme(option.key)}
            size="sm"
            variant="ghost"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
            {usingSystem ? <span className="hidden text-[10px] uppercase tracking-[0.2em] opacity-70 md:inline">{resolvedTheme}</span> : null}
          </Button>
        );
      })}
    </div>
  );
}
