"use client";

import type { OIDCConfig } from "@/lib/contracts";
import { Button, Form, Input, Label, Switch, TextField } from "@heroui/react";
import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";

interface OIDCSettingsFormProps {
  initial: OIDCConfig;
}

export function OIDCSettingsForm({ initial }: OIDCSettingsFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [enabled, setEnabled] = useState(initial.enabled);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    setIsPending(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const payload = {
        issuer: String(formData.get("issuer") || ""),
        clientID: String(formData.get("clientID") || ""),
        clientSecret: String(formData.get("clientSecret") || ""),
        displayName: String(formData.get("displayName") || ""),
        groupsClaim: String(formData.get("groupsClaim") || ""),
        enabled,
      };

      const res = await fetch("/api/admin/settings/oidc", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to save OIDC configuration.");
        return;
      }

      setSuccess("OIDC configuration saved. Restart the frontend service for changes to take effect.");
      // Clear the secret field after save
      const secretInput = form.querySelector<HTMLInputElement>('input[name="clientSecret"]');
      if (secretInput) secretInput.value = "";
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
        <Form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              isSelected={enabled}
              onChange={() => setEnabled((v) => !v)}
            />
            <span className="text-sm font-medium text-foreground">{enabled ? "Enabled" : "Disabled"}</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="issuer" className="w-full">
              <Label className="text-sm font-medium text-foreground">Issuer URL</Label>
              <Input
                defaultValue={initial.issuer}
                placeholder="https://auth.example.com/realms/main"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField name="clientID" className="w-full">
              <Label className="text-sm font-medium text-foreground">Client ID</Label>
              <Input
                defaultValue={initial.clientID}
                placeholder="justgate"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField name="clientSecret" className="w-full">
              <Label className="text-sm font-medium text-foreground">Client Secret</Label>
              <Input
                type="password"
                placeholder={initial.hasSecret ? "••••••••  (leave blank to keep)" : "Enter client secret"}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField name="displayName" className="w-full">
              <Label className="text-sm font-medium text-foreground">Button Label</Label>
              <Input
                defaultValue={initial.displayName || "Single Sign-On"}
                placeholder="Single Sign-On"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>
          </div>

          <TextField name="groupsClaim" className="w-full sm:w-1/2">
            <Label className="text-sm font-medium text-foreground">Groups Claim</Label>
            <Input
              defaultValue={initial.groupsClaim}
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
        </Form>
      </div>
    </div>
  );
}
