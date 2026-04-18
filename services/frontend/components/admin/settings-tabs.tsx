"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "oidc", label: "OIDC Config" },
  { id: "docs", label: "Provider Docs" },
  { id: "mappings", label: "Org Mappings" },
  { id: "retention", label: "Data Retention" },
  { id: "exportimport", label: "Export / Import" },
] as const;

type TabID = typeof TABS[number]["id"];

interface SettingsTabsProps {
  oidcForm: ReactNode;
  providerDocs: ReactNode;
  orgMappings: ReactNode;
  dataRetention: ReactNode;
  exportImport: ReactNode;
}

export function SettingsTabs({ oidcForm, providerDocs, orgMappings, dataRetention, exportImport }: SettingsTabsProps) {
  const [active, setActive] = useState<TabID>("oidc");

  const panels: Record<TabID, ReactNode> = {
    oidc: oidcForm,
    docs: providerDocs,
    mappings: orgMappings,
    retention: dataRetention,
    exportimport: exportImport,
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-surface text-foreground shadow-[var(--field-shadow)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div>{panels[active]}</div>
    </div>
  );
}
