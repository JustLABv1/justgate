"use client";

import { 
  Button, 
  Form, 
  Input, 
  Label, 
  ListBox, 
  Modal, 
  Select, 
  TextField,
  Tabs
} from "@heroui/react";
import { Plus, CheckCircle2, ArrowRight, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, useCallback, type FormEvent } from "react";
import type { TenantSummary, IssuedToken } from "@/lib/contracts";

interface OnboardingModalProps {
  tenantIDs: string[];
  disabled?: boolean;
}

function toApiExpiryFromDays(value: string) {
  const days = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(days) || days <= 0) {
    return value.trim();
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

export function OnboardingModal({ tenantIDs, disabled = false }: OnboardingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("tenant");
  const [isPending, startTransition] = useTransition();
  
  // Tenant state
  const [tenantError, setTenantError] = useState<string>();
  const [createdTenant, setCreatedTenant] = useState<TenantSummary>();
  
  // Route state
  const [routeError, setRouteError] = useState<string>();
  const [routeSuccess, setRouteSuccess] = useState<string>();
  
  // Token state
  const [tokenError, setTokenError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<IssuedToken>();

  const [localTenantIDs, setLocalTenantIDs] = useState<string[]>(tenantIDs);
  const [secretCopied, setSecretCopied] = useState(false);

  const handleCopySecret = useCallback((secret: string) => {
    navigator.clipboard.writeText(secret).then(() => {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    });
  }, []);

  function resetWizard() {
    setActiveTab("tenant");
    setTenantError(undefined);
    setCreatedTenant(undefined);
    setRouteError(undefined);
    setRouteSuccess(undefined);
    setTokenError(undefined);
    setIssuedToken(undefined);
    setLocalTenantIDs(tenantIDs);
  }

  async function handleTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTenantError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      upstreamURL: String(formData.get("upstreamURL") || ""),
      headerName: String(formData.get("headerName") || ""),
      authMode: "header",
    };

    const response = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setTenantError(result?.error || "Tenant creation failed");
      return;
    }

    setCreatedTenant(result as TenantSummary);
    if (!localTenantIDs.includes(payload.tenantID)) {
        setLocalTenantIDs(prev => [...prev, payload.tenantID]);
    }
    
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleRouteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRouteError(undefined);
    setRouteSuccess(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      slug: String(formData.get("slug") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      targetPath: String(formData.get("targetPath") || ""),
      requiredScope: String(formData.get("requiredScope") || ""),
      methods: String(formData.get("methods") || ""),
    };

    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setRouteError(result?.error || "Failed to create route.");
      return;
    }

    setRouteSuccess(`Created /proxy/${result?.slug || payload.slug}.`);
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTokenError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      scopes: String(formData.get("scopes") || ""),
      expiresAt: toApiExpiryFromDays(String(formData.get("expiresAt") || "")),
    };

    const response = await fetch("/api/admin/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setTokenError(result?.error || "Token issue failed");
      return;
    }

    setIssuedToken(result as IssuedToken);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          resetWizard();
        }
      }}
    >
      <Button className="rounded-full bg-foreground px-6 text-background" isDisabled={disabled} onPress={() => setIsOpen(true)}>
        <Plus size={16} />
        Onboard Tenant
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[30px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="space-y-2">
                <div className="enterprise-kicker">Guided setup</div>
                <Modal.Heading className="text-[1.9rem] font-semibold tracking-[-0.04em]">Onboarding Wizard</Modal.Heading>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Create the tenant first, then attach a route, then issue a token that is limited to that tenant and route scope.</p>
                <div className="enterprise-stat-grid pt-2">
                  {[
                    { label: "Tenant", done: Boolean(createdTenant) },
                    { label: "Route", done: Boolean(routeSuccess) },
                    { label: "Token", done: Boolean(issuedToken) },
                  ].map((step, index) => (
                    <div key={step.label} className="enterprise-panel flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="enterprise-kicker">Step {index + 1}</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{step.label}</div>
                      </div>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${step.done ? "border-success/30 bg-success/12 text-success" : "border-border bg-background/80 text-muted-foreground"}`}>
                        {step.done ? <CheckCircle2 size={15} /> : index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Modal.Header>
            <Modal.Body className="pb-8">
              <Tabs 
                aria-label="Onboarding steps" 
                selectedKey={activeTab} 
                onSelectionChange={(key) => setActiveTab(key as string)}
                className="w-full"
                variant="secondary"
              >
                <Tabs.List className="mb-6 w-full justify-start gap-6 border-b border-border/80 pb-2">
                  <Tabs.Tab id="tenant" className="flex items-center gap-2 py-2.5 px-0 outline-none">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${createdTenant ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {createdTenant ? <CheckCircle2 size={14} /> : "1"}
                    </div>
                    <span className="font-medium">Tenant</span>
                  </Tabs.Tab>
                  <Tabs.Tab id="route" className="flex items-center gap-2 py-2.5 px-0 outline-none">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${routeSuccess ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {routeSuccess ? <CheckCircle2 size={14} /> : "2"}
                    </div>
                    <span className="font-medium">Route</span>
                  </Tabs.Tab>
                  <Tabs.Tab id="token" className="flex items-center gap-2 py-2.5 px-0 outline-none">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${issuedToken ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {issuedToken ? <CheckCircle2 size={14} /> : "3"}
                    </div>
                    <span className="font-medium">Token</span>
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel id="tenant">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Step 1: Create Tenant</h3>
                      <p className="text-sm text-muted-foreground">Define where traffic for this customer or environment should go and which tenant header the proxy should inject upstream.</p>
                    </div>
                    {createdTenant ? (
                      <div className="enterprise-feedback enterprise-feedback--success space-y-4 p-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Tenant Created</p>
                          <p className="text-sm text-muted-foreground">Tenant {createdTenant.name} ({createdTenant.tenantID}) is ready.</p>
                        </div>
                        <Button 
                          onPress={() => setActiveTab("route")}
                          className="bg-foreground text-background"
                        >
                          Next: Configure Route
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                    ) : (
                      <Form className="grid gap-5" onSubmit={handleTenantSubmit}>
                        <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2">
                            <Label>Tenant name</Label>
                            <Input name="name" placeholder="Acme Observability" required variant="secondary" />
                            <div className="enterprise-note">Friendly label shown in the admin UI.</div>
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Tenant ID</Label>
                            <Input name="tenantID" placeholder="acme-prod" required variant="secondary" />
                            <div className="enterprise-note">Stable machine identifier that will be injected into the upstream tenant header.</div>
                          </TextField>
                        </div>
                        <div className="enterprise-panel grid gap-4 p-4">
                          <TextField className="grid gap-2">
                            <Label>Upstream URL</Label>
                            <Input name="upstreamURL" placeholder="https://mimir.internal.example" required type="url" variant="secondary" />
                            <div className="enterprise-note">Base URL of the backend that should receive this tenant&apos;s traffic, for example your Mimir, Loki, or Tempo endpoint.</div>
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Injected header</Label>
                            <Input name="headerName" defaultValue="X-Scope-OrgID" required variant="secondary" />
                            <div className="enterprise-note">Header name the proxy adds upstream to represent the tenant. For Grafana backends this is usually X-Scope-OrgID.</div>
                          </TextField>
                        </div>
                        {tenantError && (
                          <div className="enterprise-feedback enterprise-feedback--error">{tenantError}</div>
                        )}
                        <Button type="submit" className="mt-1 h-11 rounded-[1rem] bg-foreground text-background" isDisabled={isPending}>
                          {isPending ? "Creating..." : "Save Tenant"}
                        </Button>
                      </Form>
                    )}
                  </div>
                </Tabs.Panel>

                <Tabs.Panel id="route">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Step 2: Register Route</h3>
                      <p className="text-sm text-muted-foreground">Create the public proxy entry point that agents or operators will call for this tenant.</p>
                    </div>
                    {routeSuccess ? (
                      <div className="enterprise-feedback enterprise-feedback--success space-y-4 p-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Route Registered</p>
                          <p className="text-sm text-muted-foreground">{routeSuccess}</p>
                        </div>
                        <Button 
                          onPress={() => setActiveTab("token")}
                          className="bg-foreground text-background"
                        >
                          Next: Issue Token
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                    ) : (
                      <Form className="grid gap-5" onSubmit={handleRouteSubmit}>
                        <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2">
                            <Label>Proxy slug</Label>
                            <Input name="slug" placeholder="metrics-ingest" required variant="secondary" />
                            <div className="enterprise-note">Becomes the public path /proxy/&lt;slug&gt;. Keep it short and stable.</div>
                          </TextField>
                          <Select className="w-full" isRequired name="tenantID" defaultValue={createdTenant?.tenantID} variant="secondary">
                            <Label>Tenant ID</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {localTenantIDs.map((tid) => (
                                  <ListBox.Item key={tid} id={tid} textValue={tid}>
                                    {tid}
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                            <div className="enterprise-note md:col-span-2">Choose which tenant this route should forward to.</div>
                        </div>
                          <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2">
                            <Label>Target path</Label>
                            <Input name="targetPath" defaultValue="/" required variant="secondary" />
                              <div className="enterprise-note">Path appended to the tenant upstream URL, for example /api/v1/push.</div>
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Required scope</Label>
                            <Input name="requiredScope" placeholder="metrics:write" required variant="secondary" />
                              <div className="enterprise-note">Permission a token must contain before it can call this route.</div>
                          </TextField>
                            <TextField className="grid gap-2 md:col-span-2">
                              <Label>Allowed methods (comma separated)</Label>
                              <Input name="methods" defaultValue="POST,PUT" required variant="secondary" />
                              <div className="enterprise-note">HTTP verbs allowed on this route, for example POST or GET,POST.</div>
                            </TextField>
                        </div>
                        {routeError && (
                            <div className="enterprise-feedback enterprise-feedback--error">{routeError}</div>
                        )}
                          <Button type="submit" className="mt-1 h-11 rounded-[1rem] bg-foreground text-background" isDisabled={isPending}>
                          {isPending ? "Creating..." : "Save Route"}
                        </Button>
                      </Form>
                    )}
                  </div>
                </Tabs.Panel>

                <Tabs.Panel id="token">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Step 3: Issue Token</h3>
                      <p className="text-sm text-muted-foreground">Create the credential that clients will use. The token should include the scope required by the route you just created.</p>
                    </div>
                    {issuedToken ? (
                      <div className="enterprise-feedback enterprise-feedback--success space-y-4 p-6">
                        <div className="flex items-center gap-3 text-success">
                          <CheckCircle2 size={24} />
                          <p className="font-semibold">Token Issued Successfully</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Secret key — save this now</p>
                            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-warning">Shown once</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-4 font-mono text-sm break-all select-all">
                              {issuedToken.secret}
                            </div>
                            <Button
                              className="mt-1 h-9 w-9 min-w-9 shrink-0 rounded-xl border border-border bg-surface px-0 text-muted-foreground hover:text-foreground"
                              onPress={() => handleCopySecret(issuedToken.secret)}
                              size="sm"
                              variant="ghost"
                              title="Copy secret"
                            >
                              {secretCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            For security, this secret is never displayed again.
                          </p>
                        </div>
                        <div className="flex justify-end pt-4">
                          <Button 
                            variant="secondary"
                            onPress={() => setIsOpen(false)}
                          >
                            Finish & Close
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Form className="grid gap-5" onSubmit={handleTokenSubmit}>
                        <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2 md:col-span-2">
                            <Label>Token name</Label>
                            <Input name="name" placeholder="grafana-agent" required variant="secondary" />
                            <div className="enterprise-note">Friendly label for the client or workload that will use this token.</div>
                          </TextField>
                          <Select className="w-full" isRequired name="tenantID" defaultValue={createdTenant?.tenantID} variant="secondary">
                            <Label>Tenant ID</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {localTenantIDs.map((tid) => (
                                  <ListBox.Item key={tid} id={tid} textValue={tid}>
                                    {tid}
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <TextField className="grid gap-2">
                            <Label>Expires in (days)</Label>
                            <Input min="1" name="expiresAt" defaultValue="30" type="number" required variant="secondary" />
                            <div className="enterprise-note">How many days from now the token should remain valid.</div>
                          </TextField>
                          <div className="enterprise-note md:col-span-2">This token can only be used with routes that belong to this tenant.</div>
                        </div>
                        <div className="enterprise-panel grid gap-4 p-4">
                          <TextField className="grid gap-2">
                            <Label>Scopes (comma separated)</Label>
                            <Input name="scopes" placeholder="metrics:write" defaultValue="metrics:write" required variant="secondary" />
                            <div className="enterprise-note">Include at least the scope required by the route, for example metrics:write.</div>
                          </TextField>
                        </div>
                        {tokenError && (
                          <div className="enterprise-feedback enterprise-feedback--error">{tokenError}</div>
                        )}
                        <Button type="submit" className="mt-1 h-11 rounded-[1rem] bg-foreground text-background" isDisabled={isPending}>
                          {isPending ? "Issuing..." : "Issue Token"}
                        </Button>
                      </Form>
                    )}
                  </div>
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
