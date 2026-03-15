"use client";

import type { OIDCConfig } from "@/lib/contracts";
import { Button, Input, Label, Switch, TextField } from "@heroui/react";
import { Save } from "lucide-react";
import { useState } from "react";

interface OIDCSettingsFormProps {
  initial: OIDCConfig;
}

interface FormState {
  issuer: string;
  clientID: string;
  clientSecret: string;
  displayName: string;
  groupsClaim: string;
  enabled: boolean;
}

function initState(initial: OIDCConfig): FormState {
  return {
    issuer: initial.issuer ?? "",
    clientID: initial.clientID ?? "",
    clientSecret: "",
    displayName: initial.displayName || "Single Sign-On",
    groupsClaim: initial.groupsClaim ?? "",
    enabled: initial.enabled ?? false,
  };
}

export function OIDCSettingsForm({ initial }: OIDCSettingsFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [hasSecret, setHasSecret] = useState(initial.hasSecret);
  const [fields, setFields] = useState<FormState>(() => initState(initial));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    setIsPending(true);

    try {
      const res = await fetch("/api/admin/settings/oidc", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to save OIDC configuration.");
        return;
      }

      // Bust the frontend OIDC cache so the sign-in page reflects the change immediately.
      await fetch("/api/admin/settings/oidc/reload", { method: "POST" }).catch(() => null);

      setSuccess("OIDC configuration saved. Changes are now active.");
      // Clear the secret field and mark as having a secret
      if (fields.clientSecret) setHasSecret(true);
      set("clientSecret", "");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">OpenID Connect (OIDC)</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Configure an external identity provider for single sign-on.</p>
      </div>
      <div className="px-5 py-5">
        {initial.fromEnv && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
            These settings are currently sourced from <strong>environment variables</strong>. Saving will persist them to the database, allowing them to be managed from this page going forward.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              isSelected={fields.enabled}
              onChange={(isSelected) => set("enabled", isSelected)}
            />
            <span className="text-sm font-medium text-foreground">{fields.enabled ? "Enabled" : "Disabled"}</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              value={fields.issuer}
              onChange={(v) => set("issuer", v)}
              className="w-full"
            >
              <Label className="text-sm font-medium text-foreground">Issuer URL</Label>
              <Input
                placeholder="https://auth.example.com/realms/main"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField
              value={fields.clientID}
              onChange={(v) => set("clientID", v)}
              className="w-full"
            >
              <Label className="text-sm font-medium text-foreground">Client ID</Label>
              <Input
                placeholder="justgate"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField
              value={fields.clientSecret}
              onChange={(v) => set("clientSecret", v)}
              className="w-full"
            >
              <Label className="text-sm font-medium text-foreground">Client Secret</Label>
              <Input
                type="password"
                placeholder={hasSecret ? "••••••••  (leave blank to keep)" : "Enter client secret"}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField
              value={fields.displayName}
              onChange={(v) => set("displayName", v)}
              className="w-full"
            >
              <Label className="text-sm font-medium text-foreground">Button Label</Label>
              <Input
                placeholder="Single Sign-On"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>
          </div>

          <TextField
            value={fields.groupsClaim}
            onChange={(v) => set("groupsClaim", v)}
            className="w-full sm:w-1/2"
          >
            <Label className="text-sm font-medium text-foreground">Groups Claim</Label>
            <Input
              placeholder="groups"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              The OIDC token claim containing group/realm values for org mapping (e.g. &quot;groups&quot; or &quot;realm_access.roles&quot;).
            </p>
          </TextField>

          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              className="gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              isDisabled={isPending}
            >
              <Save size={14} />
              {isPending ? "Saving…" : "Save configuration"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
