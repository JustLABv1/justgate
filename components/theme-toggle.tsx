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
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-sm">
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.key;

        return (
          <Button
            key={option.key}
            aria-pressed={active}
            className={[
              "h-8 min-w-0 rounded-full px-3 text-sm transition-colors",
              active
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:bg-background hover:text-foreground",
            ].join(" ")}
            onPress={() => setTheme(option.key)}
            size="sm"
            variant="ghost"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
