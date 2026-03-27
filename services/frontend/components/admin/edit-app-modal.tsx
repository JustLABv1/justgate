"use client";

import { useToast } from "@/components/toast-provider";
import type { ProtectedApp } from "@/lib/contracts";
import { Button, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface EditAppModalProps {
  app: ProtectedApp;
  disabled?: boolean;
}

const AUTH_MODES = [
  { value: "oidc", label: "OIDC", desc: "Browser login via identity provider" },
  { value: "bearer", label: "Bearer", desc: "Machine-to-machine token auth" },
  { value: "any", label: "Any", desc: "OIDC browser or bearer token" },
  { value: "none", label: "None", desc: "IP filtering only, no auth" },
];

const RATE_LIMIT_PER: { value: "session" | "ip" | "token"; label: string }[] = [
  { value: "session", label: "Session" },
  { value: "ip", label: "IP address" },
  { value: "token", label: "Token" },
];

interface HeaderRule {
  name: string;
  value: string;
}

function headerRulesFromApp(app: ProtectedApp): HeaderRule[] {
  if (!app.injectHeaders || app.injectHeaders.length === 0) return [];
  return app.injectHeaders.map((h) => ({ name: h.name, value: h.value }));
}

function HeaderInjectionEditor({
  rules,
  onChange,
}: {
  rules: HeaderRule[];
  onChange: (rules: HeaderRule[]) => void;
}) {
  function addRule() {
    onChange([...rules, { name: "", value: "" }]);
  }
  function removeRule(i: number) {
    onChange(rules.filter((_, idx) => idx !== i));
  }
  function updateRule(i: number, field: "name" | "value", val: string) {
    onChange(rules.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }

  return (
    <div className="space-y-2">
      {rules.map((rule, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Input
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              placeholder="Header name (e.g. X-Remote-User)"
              value={rule.name}
              onChange={(e) => updateRule(i, "name", e.target.value)}
            />
            <Input
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none font-mono"
              placeholder="Value or $user.email"
              value={rule.value}
              onChange={(e) => updateRule(i, "value", e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRule(i)}
            className="mt-2 rounded-lg p-1.5 text-muted-foreground hover:text-danger transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus size={12} />
        Add header
      </button>
      {rules.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Available substitutions: <code className="font-mono">$user.email</code>{" "}
          <code className="font-mono">$user.name</code>{" "}
          <code className="font-mono">$user.sub</code>{" "}
          <code className="font-mono">$user.groups</code>
        </p>
      )}
    </div>
  );
}

function StripHeadersEditor({
  headers,
  onChange,
}: {
  headers: string[];
  onChange: (headers: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !headers.includes(trimmed)) {
      onChange([...headers, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {headers.map((h, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-full border border-border bg-panel px-2.5 py-0.5 text-[11px] font-mono"
          >
            {h}
            <button
              type="button"
              onClick={() => onChange(headers.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-danger"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          placeholder="Header to strip (e.g. X-Real-IP)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function EditAppModal({ app, disabled = false }: EditAppModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  const [name, setName] = useState(app.name);
  const [upstreamURL, setUpstreamURL] = useState(app.upstreamURL);
  const [authMode, setAuthMode] = useState(app.authMode);
  const [allowCIDRs, setAllowCIDRs] = useState(app.allowCIDRs);
  const [denyCIDRs, setDenyCIDRs] = useState(app.denyCIDRs);
  const [rateLimitRPM, setRateLimitRPM] = useState(String(app.rateLimitRPM || ""));
  const [rateLimitBurst, setRateLimitBurst] = useState(String(app.rateLimitBurst || ""));
  const [rateLimitPer, setRateLimitPer] = useState(app.rateLimitPer || "session");
  const [healthCheckPath, setHealthCheckPath] = useState(app.healthCheckPath);
  const [injectHeaders, setInjectHeaders] = useState<HeaderRule[]>(() => headerRulesFromApp(app));
  const [stripHeaders, setStripHeaders] = useState<string[]>(app.stripHeaders ?? []);
  const [extraCAPEM, setExtraCAPEM] = useState(app.extraCAPEM ?? "");

  function handleOpenChange(v: boolean) {
    if (v) {
      // Reset to current app values when reopening
      setName(app.name);
      setUpstreamURL(app.upstreamURL);
      setAuthMode(app.authMode);
      setAllowCIDRs(app.allowCIDRs);
      setDenyCIDRs(app.denyCIDRs);
      setRateLimitRPM(String(app.rateLimitRPM || ""));
      setRateLimitBurst(String(app.rateLimitBurst || ""));
      setRateLimitPer(app.rateLimitPer || "session");
      setHealthCheckPath(app.healthCheckPath);
      setInjectHeaders(headerRulesFromApp(app));
      setStripHeaders(app.stripHeaders ?? []);
      setExtraCAPEM(app.extraCAPEM ?? "");
      setError(undefined);
    }
    setOpen(v);
  }

  function handleSave() {
    startTransition(async () => {
      setError(undefined);
      const body = {
        name: name.trim(),
        slug: app.slug, // slug is read-only after creation
        upstreamURL: upstreamURL.trim(),
        authMode,
        injectHeaders: injectHeaders.filter((r) => r.name.trim() !== ""),
        stripHeaders: stripHeaders.filter((h) => h.trim() !== ""),
        extraCAPEM: extraCAPEM.trim(),
        rateLimitRPM: Number(rateLimitRPM) || 0,
        rateLimitBurst: Number(rateLimitBurst) || 0,
        rateLimitPer,
        allowCIDRs: allowCIDRs.trim(),
        denyCIDRs: denyCIDRs.trim(),
        healthCheckPath: healthCheckPath.trim(),
      };

      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | ProtectedApp | null;
      if (!res.ok) {
        setError((data as { error?: string })?.error || "Failed to update app.");
        return;
      }

      addToast("App updated", name.trim(), "success");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Modal isOpen={open} onOpenChange={handleOpenChange}>
      <Button
        className="h-8 rounded-full border border-border/60 bg-panel px-3 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        isDisabled={disabled}
        size="sm"
        variant="ghost"
      >
        <Pencil size={13} />
        Edit
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="enterprise-kicker">Edit protected app</div>
              <Modal.Heading className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground">
                {app.name}
              </Modal.Heading>
              <p className="mt-1 text-sm text-muted-foreground">
                Served at{" "}
                <code className="font-mono text-[11px] bg-surface px-1.5 py-0.5 rounded">
                  /app/{app.slug}/
                </code>{" "}
                — slug cannot be changed after creation.
              </p>
            </Modal.Header>
            <Modal.Body className="pb-8">
              <div className="space-y-6">

                {/* Identity */}
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>App name</Label>
                    <Input
                      placeholder="e.g. Grafana"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Upstream URL</Label>
                    <Input
                      placeholder="http://grafana:3000"
                      value={upstreamURL}
                      onChange={(e) => setUpstreamURL(e.target.value)}
                    />
                  </TextField>
                </div>

                {/* Auth mode */}
                <div className="enterprise-panel p-4 space-y-3">
                  <Label>Auth mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AUTH_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setAuthMode(m.value as ProtectedApp["authMode"])}
                        className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors ${
                          authMode === m.value
                            ? "border-foreground bg-foreground/5 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                        }`}
                      >
                        <span className="text-sm font-semibold">{m.label}</span>
                        <span className="text-[12px] leading-4">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* IP rules */}
                <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                  <TextField className="grid gap-2">
                    <Label>Allow CIDRs</Label>
                    <Input
                      placeholder="10.0.0.0/8, 192.168.1.0/24"
                      value={allowCIDRs}
                      onChange={(e) => setAllowCIDRs(e.target.value)}
                    />
                    <div className="enterprise-note">Leave empty to allow all.</div>
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Deny CIDRs</Label>
                    <Input
                      placeholder="203.0.113.0/24"
                      value={denyCIDRs}
                      onChange={(e) => setDenyCIDRs(e.target.value)}
                    />
                    <div className="enterprise-note">Rejected before authentication.</div>
                  </TextField>
                </div>

                {/* Rate limiting */}
                <div className="enterprise-panel p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <TextField className="grid gap-2">
                      <Label>Rate limit (RPM)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0 = unlimited"
                        value={rateLimitRPM}
                        onChange={(e) => setRateLimitRPM(e.target.value)}
                      />
                    </TextField>
                    <TextField className="grid gap-2">
                      <Label>Burst</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0 = same as RPM"
                        value={rateLimitBurst}
                        onChange={(e) => setRateLimitBurst(e.target.value)}
                      />
                    </TextField>
                  </div>
                  <div className="grid gap-2">
                    <Label>Rate per</Label>
                    <div className="flex gap-2">
                      {RATE_LIMIT_PER.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setRateLimitPer(p.value)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium text-center transition-colors ${
                            rateLimitPer === p.value
                              ? "border-foreground bg-foreground/5 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextField className="grid gap-2">
                    <Label>
                      Health check path{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      placeholder="/healthz"
                      value={healthCheckPath}
                      onChange={(e) => setHealthCheckPath(e.target.value)}
                    />
                  </TextField>
                </div>

                {/* Header injection */}
                <div className="enterprise-panel p-4 space-y-3">
                  <div>
                    <Label>Inject headers</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Headers added to every proxied request. Use substitution variables to
                      forward authenticated user identity to the upstream.
                    </p>
                  </div>
                  <HeaderInjectionEditor rules={injectHeaders} onChange={setInjectHeaders} />
                </div>

                {/* Strip headers */}
                <div className="enterprise-panel p-4 space-y-3">
                  <div>
                    <Label>Strip headers</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Headers removed from the incoming request before forwarding. Useful to
                      prevent clients from spoofing identity headers.
                    </p>
                  </div>
                  <StripHeadersEditor headers={stripHeaders} onChange={setStripHeaders} />
                </div>

                {/* Extra CA */}
                <div className="enterprise-panel p-4 space-y-2">
                  <Label>
                    Extra CA certificate{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <TextArea
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[12px] font-mono text-muted-foreground placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none resize-y"
                    rows={4}
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                    value={extraCAPEM}
                    onChange={(e) => setExtraCAPEM(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    PEM-encoded CA certificate for verifying the upstream TLS connection.
                  </p>
                </div>

                {error && <div className="enterprise-feedback enterprise-feedback--error">{error}</div>}

                <div className="flex items-center justify-end gap-3">
                  <Button variant="ghost" onPress={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-foreground text-background"
                    isDisabled={isPending || !name.trim() || !upstreamURL.trim()}
                    onPress={handleSave}
                  >
                    {isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
