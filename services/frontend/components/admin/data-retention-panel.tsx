"use client";

import type { RetentionSettings } from "@/lib/contracts";
import { Button, Input, Label, Switch, TextField } from "@heroui/react";
import { Save, Trash2 } from "lucide-react";
import { useState } from "react";

interface DataRetentionPanelProps {
  initial: RetentionSettings;
}

export function DataRetentionPanel({ initial }: DataRetentionPanelProps) {
  const [retentionDays, setRetentionDays] = useState(String(initial.retentionDays));
  const [autoEnabled, setAutoEnabled] = useState(initial.autoEnabled);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/settings/retention", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retentionDays: Number(retentionDays), autoEnabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveMsg("Saved.");
    } catch {
      setSaveMsg("Failed to save settings.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  async function handlePurge() {
    setPurging(true);
    setPurgeMsg(null);
    try {
      const res = await fetch("/api/admin/settings/retention/purge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ olderThanDays: Number(retentionDays) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPurgeMsg(`Purged ${data.purged} rows.`);
    } catch {
      setPurgeMsg("Purge failed.");
    } finally {
      setPurging(false);
      setTimeout(() => setPurgeMsg(null), 5000);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">Traffic Stats Retention</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Control how long 5-minute traffic stat buckets are kept. Older rows can be purged manually or on a schedule.
        </p>
      </div>
      <div className="px-5 py-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField className="grid gap-2">
            <Label>Retention period (days)</Label>
            <Input
              type="number"
              min={1}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              placeholder="30"
            />
          </TextField>

          <div className="flex items-center gap-3 pt-6">
            <Switch
              isSelected={autoEnabled}
              onChange={(checked) => setAutoEnabled(checked)}
              aria-label="Enable automatic purge"
            />
            <span className="text-[13px] text-foreground">Auto-purge every 6 hours</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onPress={handleSave}
            isDisabled={saving}
            className="flex items-center gap-2"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save settings"}
          </Button>

          <Button
            variant="ghost"
            onPress={handlePurge}
            isDisabled={purging}
            className="flex items-center gap-2 text-warning hover:text-warning"
          >
            <Trash2 size={14} />
            {purging ? "Purging…" : `Purge data older than ${retentionDays || "30"} days`}
          </Button>

          {saveMsg && <span className="text-[12px] text-muted-foreground">{saveMsg}</span>}
          {purgeMsg && <span className="text-[12px] text-muted-foreground">{purgeMsg}</span>}
        </div>
      </div>
    </div>
  );
}
