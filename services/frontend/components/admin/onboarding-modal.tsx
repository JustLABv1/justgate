"use client";

import { AnimatedStep, type StepDef, StepList } from "@/components/admin/modal-stepper";
import { useToast } from "@/components/toast-provider";
import type { IssuedToken, OrgSummary, TenantSummary } from "@/lib/contracts";
import { Button, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

interface OnboardingModalProps {
  tenantIDs: string[];
  disabled?: boolean;
}

function toApiExpiryFromDays(value: string) {
  const days = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(days) || days <= 0) return value.trim();
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function OnboardingModal({ tenantIDs, disabled = false }: OnboardingModalProps) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const hasOrg = Boolean(session?.activeOrgId);

  const stepDefs: StepDef[] = useMemo(
    () =>
      hasOrg
        ? [
            { id: "tenant", label: "Tenant" },
            { id: "route", label: "Route" },
            { id: "token", label: "Token" },
          ]
        : [
            { id: "org", label: "Organisation" },
            { id: "tenant", label: "Tenant" },
            { id: "route", label: "Route" },
            { id: "token", label: "Token" },
          ],
    [hasOrg],
  );

  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Org
  const [orgName, setOrgName] = useState("");
  const [orgError, setOrgError] = useState<string>();
  const [createdOrg, setCreatedOrg] = useState<OrgSummary>();

  // Tenant
  const [tenantName, setTenantName] = useState("");
  const [tenantID, setTenantID] = useState("");
  const [upstreamURL, setUpstreamURL] = useState("");
  const [headerName, setHeaderName] = useState("X-Scope-OrgID");
  const [tenantError, setTenantError] = useState<string>();
  const [createdTenant, setCreatedTenant] = useState<TenantSummary>();

  // Route
  const [routeSlug, setRouteSlug] = useState("");
  const [routeTenantID, setRouteTenantID] = useState("");
  const [targetPath, setTargetPath] = useState("/");
  const [requiredScope, setRequiredScope] = useState("");
  const [routeMethods, setRouteMethods] = useState("POST");
  const [routeError, setRouteError] = useState<string>();
  const [routeCreated, setRouteCreated] = useState(false);

  // Token
  const [tokenName, setTokenName] = useState("");
  const [tokenTenantID, setTokenTenantID] = useState("");
  const [scopes, setScopes] = useState("metrics:write");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [tokenError, setTokenError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<IssuedToken>();
  const [secretCopied, setSecretCopied] = useState(false);

  const [localTenantIDs, setLocalTenantIDs] = useState<string[]>(tenantIDs);

  const handleCopySecret = useCallback((secret: string) => {
    navigator.clipboard.writeText(secret).then(() => {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    });
  }, []);

  function goNext() {
    setDirection(1);
    setActiveStepIndex((i) => Math.min(i + 1, stepDefs.length - 1));
  }

  function goBack() {
    setDirection(-1);
    setActiveStepIndex((i) => Math.max(i - 1, 0));
  }

  function resetWizard() {
    setActiveStepIndex(0);
    setDirection(1);
    setOrgName(""); setOrgError(undefined); setCreatedOrg(undefined);
    setTenantName(""); setTenantID(""); setUpstreamURL(""); setHeaderName("X-Scope-OrgID");
    setTenantError(undefined); setCreatedTenant(undefined);
    setRouteSlug(""); setRouteTenantID(tenantIDs[0] ?? "");
    setTargetPath("/"); setRequiredScope(""); setRouteMethods("POST");
    setRouteError(undefined); setRouteCreated(false);
    setTokenName(""); setTokenTenantID(tenantIDs[0] ?? "");
    setScopes("metrics:write"); setExpiresInDays("30");
    setTokenError(undefined); setIssuedToken(undefined);
    setLocalTenantIDs(tenantIDs);
  }

  async function submitOrg() {
    setOrgError(undefined);
    const response = await fetch("/api/admin/orgs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: orgName }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setOrgError(result?.error || "Organisation creation failed"); return; }
    const org = result as OrgSummary;
    setCreatedOrg(org);
    await update({ activeOrgId: org.id });
    startTransition(() => router.refresh());
    goNext();
  }

  async function submitTenant() {
    setTenantError(undefined);
    const response = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: tenantName, tenantID, upstreamURL, headerName, authMode: "header" }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setTenantError(result?.error || "Tenant creation failed"); return; }
    setCreatedTenant(result as TenantSummary);
    if (!localTenantIDs.includes(tenantID)) setLocalTenantIDs((p) => [...p, tenantID]);
    setRouteTenantID(tenantID);
    setTokenTenantID(tenantID);
    startTransition(() => router.refresh());
    goNext();
  }

  async function submitRoute() {
    setRouteError(undefined);
    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: routeSlug, tenantID: routeTenantID, targetPath, requiredScope, methods: routeMethods }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setRouteError(result?.error || "Failed to create route."); return; }
    setRouteCreated(true);
    startTransition(() => router.refresh());
    goNext();
  }

  async function submitToken() {
    setTokenError(undefined);
    const response = await fetch("/api/admin/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: tokenName, tenantID: tokenTenantID, scopes, expiresAt: toApiExpiryFromDays(expiresInDays) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setTokenError(result?.error || "Token issue failed"); return; }
    setIssuedToken(result as IssuedToken);
    addToast("Setup complete", "Your first token is ready", "success");
    startTransition(() => router.refresh());
  }

  const activeStepId = stepDefs[activeStepIndex]?.id;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetWizard();
      }}
    >
      <Button
        className="rounded-full bg-foreground px-6 text-background"
        isDisabled={disabled}
        onPress={() => { setActiveStepIndex(0); setIsOpen(true); }}
      >
        <Plus size={16} />
        Onboard Tenant
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-[28px] border border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="enterprise-kicker">Guided setup</div>
              <Modal.Heading className="mt-2 text-[1.9rem] leading-none tracking-[-0.04em] text-foreground">
                Onboarding Wizard
              </Modal.Heading>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Set up your first tenant, route and token in a few steps.
              </p>
              <div className="mt-5">
                <StepList steps={stepDefs} currentStep={activeStepIndex} />
              </div>
            </Modal.Header>
            <Modal.Body className="pb-8">
              <AnimatedStep stepKey={activeStepIndex} direction={direction}>
                {/* ── Org step ── */}
                {activeStepId === "org" && (
                  <div className="space-y-5">
                    {(createdOrg || hasOrg) ? (
                      <div className="enterprise-feedback enterprise-feedback--success flex items-center gap-3 p-4">
                        <CheckCircle2 size={16} className="shrink-0 text-success" />
                        <p className="text-sm">
                          {createdOrg ? `"${createdOrg.name}" created.` : "Organisation already active."}
                        </p>
                        <Button className="ml-auto bg-foreground text-background" size="sm" onPress={goNext}>
                          Continue <ArrowRight size={14} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="enterprise-panel grid gap-4 p-4">
                          <TextField className="grid gap-2">
                            <Label>Organisation name</Label>
                            <Input placeholder="Acme Platform" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                            <div className="enterprise-note">Your team or company name — visible to all members.</div>
                          </TextField>
                        </div>
                        {orgError && <div className="enterprise-feedback enterprise-feedback--error">{orgError}</div>}
                        <div className="flex justify-end">
                          <Button
                            className="bg-foreground text-background"
                            isDisabled={!orgName.trim() || isPending}
                            onPress={submitOrg}
                          >
                            {isPending ? "Creating…" : "Create Organisation"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Tenant step ── */}
                {activeStepId === "tenant" && (
                  <div className="space-y-5">
                    {createdTenant ? (
                      <div className="enterprise-feedback enterprise-feedback--success flex items-center gap-3 p-4">
                        <CheckCircle2 size={16} className="shrink-0 text-success" />
                        <p className="text-sm">Tenant <strong>{createdTenant.tenantID}</strong> created.</p>
                        <Button className="ml-auto bg-foreground text-background" size="sm" onPress={goNext}>
                          Continue <ArrowRight size={14} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="enterprise-panel grid gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2">
                            <Label>Tenant name</Label>
                            <Input placeholder="Acme Observability" required value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
                            <div className="enterprise-note">Friendly label for the admin UI.</div>
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Tenant ID</Label>
                            <Input placeholder="acme-prod" required value={tenantID} onChange={(e) => setTenantID(e.target.value)} />
                            <div className="enterprise-note">Stable machine identifier injected upstream.</div>
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Upstream URL</Label>
                            <Input placeholder="https://mimir.internal.example" required type="url" value={upstreamURL} onChange={(e) => setUpstreamURL(e.target.value)} />
                            <div className="enterprise-note">Backend that receives this tenant's traffic.</div>
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Injected header</Label>
                            <Input required value={headerName} onChange={(e) => setHeaderName(e.target.value)} />
                            <div className="enterprise-note">Usually X-Scope-OrgID for Grafana backends.</div>
                          </TextField>
                        </div>
                        {upstreamURL && tenantID && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 font-mono text-[12px]"
                          >
                            <span className="text-muted-foreground">{headerName || "X-Scope-OrgID"}: </span>
                            <span className="text-accent">{tenantID}</span>
                            <span className="ml-2 text-muted-foreground/60 truncate">&rarr; {upstreamURL}</span>
                          </motion.div>
                        )}
                        {tenantError && <div className="enterprise-feedback enterprise-feedback--error">{tenantError}</div>}
                        <div className="flex items-center justify-between gap-3">
                          {!hasOrg ? (
                            <Button variant="ghost" onPress={goBack}><ArrowLeft size={15} />Back</Button>
                          ) : <div />}
                          <Button
                            className="bg-foreground text-background"
                            isDisabled={!tenantName.trim() || !tenantID.trim() || !upstreamURL.trim() || isPending}
                            onPress={submitTenant}
                          >
                            {isPending ? "Creating…" : "Save Tenant"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Route step ── */}
                {activeStepId === "route" && (
                  <div className="space-y-5">
                    {routeCreated ? (
                      <div className="enterprise-feedback enterprise-feedback--success flex items-center gap-3 p-4">
                        <CheckCircle2 size={16} className="shrink-0 text-success" />
                        <p className="text-sm">Route <strong>/proxy/{routeSlug}</strong> registered.</p>
                        <Button className="ml-auto bg-foreground text-background" size="sm" onPress={goNext}>
                          Continue <ArrowRight size={14} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="enterprise-panel grid items-start gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2">
                            <Label>Proxy slug</Label>
                            <Input placeholder="metrics-ingest" required value={routeSlug} onChange={(e) => setRouteSlug(e.target.value)} />
                            <div className="enterprise-note">Becomes /proxy/&lt;slug&gt;. No slashes.</div>
                          </TextField>
                          <Select
                            className="w-full"
                            isRequired
                            placeholder="Select tenant"
                            value={routeTenantID}
                            variant="secondary"
                            onChange={(v) => setRouteTenantID(String(v))}
                          >
                            <Label>Tenant ID</Label>
                            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {localTenantIDs.map((tid) => (
                                  <ListBox.Item key={tid} id={tid} textValue={tid}>{tid}<ListBox.ItemIndicator /></ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <TextField className="grid gap-2">
                            <Label>Target path</Label>
                            <Input placeholder="/api/v1/push" required value={targetPath} onChange={(e) => setTargetPath(e.target.value)} />
                          </TextField>
                          <TextField className="grid gap-2">
                            <Label>Required scope</Label>
                            <Input placeholder="metrics:write" required value={requiredScope} onChange={(e) => setRequiredScope(e.target.value)} />
                          </TextField>
                          <TextField className="grid gap-2 md:col-span-2">
                            <Label>Allowed methods</Label>
                            <Input placeholder="POST, PUT" required value={routeMethods} onChange={(e) => setRouteMethods(e.target.value)} />
                            <div className="enterprise-note">Comma-separated HTTP verbs.</div>
                          </TextField>
                        </div>
                        {(routeSlug || routeTenantID) && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 font-mono text-[12px]"
                          >
                            <span className="text-muted-foreground">{(routeMethods.split(",")[0] || "POST").trim()} </span>
                            <span className="text-accent">/proxy/{routeSlug || "…"}</span>
                            {routeTenantID && <span className="text-muted-foreground"> &rarr; {routeTenantID}{targetPath}</span>}
                            {requiredScope && <span className="text-muted-foreground/70 ml-2">scope: {requiredScope}</span>}
                          </motion.div>
                        )}
                        {routeError && <div className="enterprise-feedback enterprise-feedback--error">{routeError}</div>}
                        <div className="flex items-center justify-between gap-3">
                          <Button variant="ghost" onPress={goBack}><ArrowLeft size={15} />Back</Button>
                          <Button
                            className="bg-foreground text-background"
                            isDisabled={!routeSlug.trim() || !routeTenantID || !requiredScope.trim() || isPending}
                            onPress={submitRoute}
                          >
                            {isPending ? "Saving…" : "Save Route"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Token step ── */}
                {activeStepId === "token" && (
                  <div className="space-y-5">
                    {issuedToken ? (
                      <div className="enterprise-feedback enterprise-feedback--success space-y-4 p-5">
                        <div className="flex items-center gap-2 text-success">
                          <Check size={16} />
                          <p className="font-semibold text-sm">Setup complete — copy your secret now</p>
                          <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-warning">Shown once</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1 rounded-[0.9rem] border border-border/70 bg-background/75 px-3 py-3 font-mono text-sm break-all select-all">
                            {issuedToken.secret}
                          </div>
                          <Button
                            aria-label="Copy secret"
                            className="mt-1 h-9 w-9 min-w-9 shrink-0 rounded-xl border border-border bg-surface px-0 text-muted-foreground hover:text-foreground"
                            size="sm"
                            variant="ghost"
                            onPress={() => handleCopySecret(issuedToken.secret)}
                          >
                            {secretCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                          </Button>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button variant="secondary" onPress={() => setIsOpen(false)}>Finish &amp; close</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="enterprise-panel grid items-start gap-4 p-4 md:grid-cols-2">
                          <TextField className="grid gap-2 md:col-span-2">
                            <Label>Token name</Label>
                            <Input placeholder="grafana-agent" required value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
                            <div className="enterprise-note">Friendly label for the workload using this token.</div>
                          </TextField>
                          <Select
                            className="w-full"
                            isRequired
                            placeholder="Select tenant"
                            value={tokenTenantID}
                            variant="secondary"
                            onChange={(v) => setTokenTenantID(String(v))}
                          >
                            <Label>Tenant ID</Label>
                            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {localTenantIDs.map((tid) => (
                                  <ListBox.Item key={tid} id={tid} textValue={tid}>{tid}<ListBox.ItemIndicator /></ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <TextField className="grid gap-2">
                            <Label>Expires in (days)</Label>
                            <Input min="1" required type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
                          </TextField>
                          <TextField className="grid gap-2 md:col-span-2">
                            <Label>Scopes</Label>
                            <Input placeholder="metrics:write" required value={scopes} onChange={(e) => setScopes(e.target.value)} />
                            <div className="enterprise-note">Include at least the scope required by the route, e.g. metrics:write.</div>
                          </TextField>
                        </div>
                        {tokenError && <div className="enterprise-feedback enterprise-feedback--error">{tokenError}</div>}
                        <div className="flex items-center justify-between gap-3">
                          <Button variant="ghost" onPress={goBack}><ArrowLeft size={15} />Back</Button>
                          <Button
                            className="bg-foreground text-background"
                            isDisabled={!tokenName.trim() || !tokenTenantID || !scopes.trim() || isPending}
                            onPress={submitToken}
                          >
                            {isPending ? "Issuing…" : "Issue Token"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </AnimatedStep>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
