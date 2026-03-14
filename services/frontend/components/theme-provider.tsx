"use client";

import { ToastProvider } from "@/components/toast-provider";
import { SessionProvider } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "ui-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => {
      if (typeof window === "undefined") {
        return defaultTheme;
      }

      const storedTheme = window.localStorage.getItem(storageKey);
      return isTheme(storedTheme) ? storedTheme : defaultTheme;
    }
  );

  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (nextTheme: Theme) => {
      root.classList.remove("light", "dark");

      const effectiveTheme = nextTheme === "system" ? (mediaQuery.matches ? "dark" : "light") : nextTheme;
      root.classList.add(effectiveTheme);
      root.dataset.theme = effectiveTheme;
      root.style.colorScheme = effectiveTheme;
      setResolvedTheme(effectiveTheme);
    };

    applyTheme(theme);

    const handleSystemThemeChange = () => {
      if (theme === "system") applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      window.localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <SessionProvider>
      <ThemeContext.Provider value={value}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ThemeContext.Provider>
    </SessionProvider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
