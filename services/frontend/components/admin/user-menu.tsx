"use client";

import { type Theme, useTheme } from "@/components/theme-provider";
import { Laptop, LogOut, Moon, Sun } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const themeOptions: Array<{ key: Theme; label: string; icon: typeof Sun }> = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Laptop },
];

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // email or single word — use first two chars
  return value.replace(/@.*/, "").slice(0, 2).toUpperCase();
}

interface UserMenuProps {
  user: string; // name or email
}

export function UserMenu({ user }: UserMenuProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(user);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background ring-2 ring-border transition-opacity hover:opacity-80"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-overlay p-2 shadow-lg backdrop-blur-sm">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground">{user}</div>
              <div className="text-[11px] text-muted-foreground">Administrator</div>
            </div>
          </div>

          <div className="my-1.5 border-t border-border" />

          {/* Theme */}
          <div className="px-3 py-1.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Theme</div>
            <div className="flex gap-1">
              {themeOptions.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={[
                    "flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-medium transition-colors",
                    theme === key
                      ? "border-foreground/20 bg-surface text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="my-1.5 border-t border-border" />

          {/* Sign out */}
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/signin" })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
