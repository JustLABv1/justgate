"use client";

import { Button, Input, Label, Switch, TextField } from "@heroui/react";
import { ArrowRight, CheckCircle, Lock, Server, ShieldCheck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Step = "welcome" | "account" | "oidc" | "complete";

interface AccountFields {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface OIDCFields {
  issuer: string;
  clientID: string;
  clientSecret: string;
  displayName: string;
  adminGroup: string;
  enabled: boolean;
}

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  // When true the user chose to skip local-account creation
  const [skipAccount, setSkipAccount] = useState(false);

  const [account, setAccount] = useState<AccountFields>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [oidc, setOIDC] = useState<OIDCFields>({
    issuer: "",
    clientID: "",
    clientSecret: "",
    displayName: "Single Sign-On",
    adminGroup: "",
    enabled: false,
  });

  function setAccountField<K extends keyof AccountFields>(key: K, value: string) {
    setAccount((f) => ({ ...f, [key]: value }));
  }

  function setOIDCField<K extends keyof OIDCFields>(key: K, value: OIDCFields[K]) {
    setOIDC((f) => {
      const next = { ...f, [key]: value };
      // Auto-enable when required fields are filled.
      if (!next.enabled && next.issuer && next.clientID && next.clientSecret) {
        next.enabled = true;
      }
      return next;
    });
  }

  function validateAccount(): string | null {
    if (!account.name.trim()) return "Name is required.";
    if (!account.email.trim()) return "Email is required.";
    if (account.password.length < 10) return "Password must be at least 10 characters.";
    if (account.password !== account.confirmPassword) return "Passwords do not match.";
    return null;
  }

  function handleAccountNext() {
    const err = validateAccount();
    if (err) { setError(err); return; }
    setError(undefined);
    setStep("oidc");
  }

  function handleSkipAccount() {
    setError(undefined);
    setSkipAccount(true);
    setStep("oidc");
  }

  function handleComplete() {
    setError(undefined);

    // OIDC-only validation: adminGroup is required when skipping the local account.
    if (skipAccount) {
      if (!oidc.issuer || !oidc.clientID || !oidc.clientSecret) {
        setError("Issuer URL, Client ID, and Client Secret are required for OIDC-only setup.");
        return;
      }
      if (!oidc.adminGroup.trim()) {
        setError("Platform Admin Group is required when skipping local account creation.");
        return;
      }
    }

    startTransition(async () => {
      const body: Record<string, unknown> = {};

      if (!skipAccount) {
        body.adminName = account.name.trim();
        body.adminEmail = account.email.trim();
        body.adminPassword = account.password;
      }

      if (oidc.issuer && oidc.clientID && oidc.clientSecret) {
        body.oidc = {
          issuer: oidc.issuer,
          clientID: oidc.clientID,
          clientSecret: oidc.clientSecret,
          displayName: oidc.displayName || "Single Sign-On",
          adminGroup: oidc.adminGroup.trim(),
        };
      }

      try {
        const res = await fetch("/api/setup/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setError(data?.error || "Setup failed. Please try again.");
          return;
        }
        setStep("complete");
      } catch {
        setError("Could not reach the backend. Check that it is running.");
      }
    });
  }

  const stepLabels: { key: Step; label: string }[] = [
    { key: "account", label: skipAccount ? "Account (skipped)" : "Admin Account" },
    { key: "oidc", label: "SSO (optional)" },
  ];

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[22px] border border-border/70 bg-surface text-foreground shadow-[var(--field-shadow)]">
          <ShieldCheck size={24} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {step === "complete" ? "Setup complete" : "Set up JustGate"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === "complete"
            ? skipAccount
              ? "OIDC is configured. Sign in with your identity provider."
              : "Your admin account is ready. Sign in to continue."
            : "Create your first admin account to get started."}
        </p>
      </div>

      {/* Step indicator */}
      {step !== "welcome" && step !== "complete" && (
        <div className="flex items-center justify-center gap-3">
          {stepLabels.map(({ key, label }, i) => {
            const currentIdx = stepLabels.findIndex((s) => s.key === step);
            const done = i < currentIdx;
            const active = key === step;
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    done
                      ? "bg-success text-white"
                      : active
                      ? "bg-foreground text-background"
                      : "bg-panel text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? <CheckCircle size={13} /> : i + 1}
                </div>
                <span
                  className={[
                    "text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <div className="ml-1 h-px w-8 bg-border" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      {step === "welcome" && (
        <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[var(--field-shadow)]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Lock, title: "Local auth", desc: "Create a secure admin account with email & password. Optional if you use OIDC groups." },
                { icon: Zap, title: "SSO ready", desc: "Connect an OIDC provider and map a group to platform admin — no local account needed." },
                { icon: Server, title: "Instant start", desc: "Backend connected and ready to configure." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border border-border/60 bg-panel/50 p-4">
                  <Icon size={16} className="mb-2 text-muted-foreground" />
                  <p className="text-[13px] font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            <Button
              className="h-12 w-full rounded-2xl bg-foreground text-background"
              onPress={() => setStep("account")}
            >
              Get started
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Admin Account ───────────────────────────────────────────────── */}
      {step === "account" && (
        <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[var(--field-shadow)]">
          <div className="mb-5 space-y-1">
            <h2 className="text-base font-semibold text-foreground">Admin account</h2>
            <p className="text-[12px] text-muted-foreground">This account will be your first platform admin.</p>
          </div>
          <div className="space-y-4">
            <TextField value={account.name} onChange={(v) => setAccountField("name", v)} className="w-full">
              <Label className="text-sm font-medium text-foreground">Full name</Label>
              <Input
                placeholder="Jane Admin"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField value={account.email} onChange={(v) => setAccountField("email", v)} className="w-full">
              <Label className="text-sm font-medium text-foreground">Email</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField value={account.password} onChange={(v) => setAccountField("password", v)} className="w-full">
              <Label className="text-sm font-medium text-foreground">Password</Label>
              <Input
                type="password"
                placeholder="At least 10 characters"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <TextField value={account.confirmPassword} onChange={(v) => setAccountField("confirmPassword", v)} className="w-full">
              <Label className="text-sm font-medium text-foreground">Confirm password</Label>
              <Input
                type="password"
                placeholder="Re-enter your password"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            {error && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                {error}
              </div>
            )}

            <Button
              className="h-11 w-full rounded-2xl bg-foreground text-background"
              onPress={handleAccountNext}
            >
              Continue
              <ArrowRight size={16} />
            </Button>

            <button
              type="button"
              onClick={handleSkipAccount}
              className="w-full text-center text-[12px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Skip — I&apos;ll use OIDC admin groups instead
            </button>
          </div>
        </div>
      )}

      {/* ── OIDC ────────────────────────────────────────────────────────── */}
      {step === "oidc" && (
        <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[var(--field-shadow)]">
          <div className="mb-5 space-y-1">
            <h2 className="text-base font-semibold text-foreground">Single sign-on</h2>
            <p className="text-[12px] text-muted-foreground">
              {skipAccount
                ? "An OIDC provider is required. Set the Platform Admin Group to the OIDC group that should get platform admin access."
                : "Optional. Connect an OIDC provider (Keycloak, Dex, Auth0, …). You can configure this later in Settings → OIDC."}
            </p>
          </div>

          {skipAccount && (
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[12px] text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-300">
              No local account will be created. Any OIDC user whose groups claim contains the <strong>Platform Admin Group</strong> value will be automatically granted platform admin on their first sign-in.
            </div>
          )}

          <div className="space-y-4">
            <TextField value={oidc.issuer} onChange={(v) => setOIDCField("issuer", v)} className="w-full">
              <Label className="text-sm font-medium text-foreground">
                Issuer URL{skipAccount && <span className="ml-1 text-danger">*</span>}
              </Label>
              <Input
                placeholder="https://auth.example.com/realms/main"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </TextField>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField value={oidc.clientID} onChange={(v) => setOIDCField("clientID", v)} className="w-full">
                <Label className="text-sm font-medium text-foreground">
                  Client ID{skipAccount && <span className="ml-1 text-danger">*</span>}
                </Label>
                <Input
                  placeholder="justgate"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </TextField>

              <TextField value={oidc.clientSecret} onChange={(v) => setOIDCField("clientSecret", v)} className="w-full">
                <Label className="text-sm font-medium text-foreground">
                  Client secret{skipAccount && <span className="ml-1 text-danger">*</span>}
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </TextField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField value={oidc.displayName} onChange={(v) => setOIDCField("displayName", v)} className="w-full">
                <Label className="text-sm font-medium text-foreground">Button label</Label>
                <Input
                  placeholder="Single Sign-On"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </TextField>

              <TextField value={oidc.adminGroup} onChange={(v) => setOIDCField("adminGroup", v)} className="w-full">
                <Label className="text-sm font-medium text-foreground">
                  Platform Admin Group{skipAccount && <span className="ml-1 text-danger">*</span>}
                </Label>
                <Input
                  placeholder="justgate-admins"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </TextField>
            </div>

            {oidc.issuer && oidc.clientID && oidc.clientSecret && (
              <div className="flex items-center justify-between rounded-xl border border-success/40 bg-success/8 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">SSO active</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    The SSO button will appear on the sign-in page.
                  </p>
                </div>
                <Switch
                  isSelected={oidc.enabled}
                  onChange={(v) => setOIDCField("enabled", v)}
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                className="h-11 flex-1 rounded-2xl border border-border bg-transparent text-foreground hover:bg-panel/60"
                variant="ghost"
                onPress={() => { setError(undefined); setSkipAccount(false); setStep("account"); }}
              >
                Back
              </Button>
              <Button
                className="h-11 flex-1 rounded-2xl bg-foreground text-background"
                isDisabled={isPending}
                onPress={handleComplete}
              >
                {isPending ? "Setting up…" : "Complete setup"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete ─────────────────────────────────────────────────────── */}
      {step === "complete" && (
        <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[var(--field-shadow)]">
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle size={24} />
            </div>
            <div className="space-y-4 text-left">
              {!skipAccount && (
                <div className="rounded-xl border border-border bg-panel/50 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">Admin email:</span>{" "}
                  <span className="text-muted-foreground">{account.email}</span>
                </div>
              )}
              {oidc.issuer && oidc.clientID && (
                <div className="rounded-xl border border-border bg-panel/50 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">OIDC provider:</span>{" "}
                  <span className="text-muted-foreground">{oidc.issuer}</span>
                </div>
              )}
              {oidc.adminGroup && (
                <div className="rounded-xl border border-border bg-panel/50 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">Platform admin group:</span>{" "}
                  <span className="font-mono text-muted-foreground">{oidc.adminGroup}</span>
                </div>
              )}
              {skipAccount && (
                <div className="rounded-xl border border-sky-200/60 bg-sky-50/60 px-4 py-3 text-[12px] text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/20 dark:text-sky-300">
                  Sign in with your identity provider. Members of <strong>{oidc.adminGroup}</strong> will receive platform admin access automatically.
                </div>
              )}
            </div>
            <Button
              className="h-12 w-full rounded-2xl bg-foreground text-background"
              onPress={() => router.push("/signin")}
            >
              Go to sign in
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
