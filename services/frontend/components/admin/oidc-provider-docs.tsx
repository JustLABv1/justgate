"use client";

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ProviderDoc {
  id: string;
  name: string;
  steps: Array<{
    title: string;
    content: string | React.ReactNode;
  }>;
  callbackNote: string;
}

const PROVIDERS: ProviderDoc[] = [
  {
    id: "keycloak",
    name: "Keycloak",
    callbackNote:
      "Use your actual JustGate domain in place of <your-domain>.",
    steps: [
      {
        title: "1. Create or select a Realm",
        content:
          'Log in to the Keycloak admin console. Create a new realm (e.g. "justgate") or use an existing one. Copy the realm name — you will need it for the Issuer URL.',
      },
      {
        title: "2. Create a Client",
        content: (
          <ul className="space-y-1 list-disc list-inside text-[13px] text-muted-foreground leading-relaxed">
            <li>Go to <strong>Clients</strong> → <strong>Create client</strong></li>
            <li>
              <strong>Client type:</strong> OpenID Connect &nbsp;|&nbsp; <strong>Client ID:</strong> <code className="font-mono text-[11px] bg-background px-1 rounded">justgate</code>
            </li>
            <li>Enable <strong>Client authentication</strong> (so a client secret is generated)</li>
            <li>
              Leave <strong>Standard flow</strong> enabled (Authorization Code). Disable Direct access grants if not needed.
            </li>
          </ul>
        ),
      },
      {
        title: "3. Set redirect URIs",
        content: (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              Under <strong>Valid redirect URIs</strong> add both:
            </p>
            <pre className="rounded-md bg-background/60 px-4 py-3 text-[12px] font-mono text-muted-foreground whitespace-pre-wrap">
{`https://<your-domain>/api/auth/callback/oidc
https://<your-domain>/app/*/_auth/callback`}
            </pre>
            <p className="text-[12px] text-muted-foreground">
              The first is for admin sign-in. The second covers all protected app OIDC flows.
            </p>
          </div>
        ),
      },
      {
        title: "4. Copy your credentials",
        content: (
          <div className="space-y-2">
            <ul className="space-y-1 list-disc list-inside text-[13px] text-muted-foreground">
              <li>
                <strong>Issuer URL:</strong>{" "}
                <code className="font-mono text-[11px] bg-background px-1 rounded">
                  https://{"<keycloak-host>"}/realms/{"<realm-name>"}
                </code>
              </li>
              <li>
                <strong>Client ID:</strong> the value you set (e.g. <code className="font-mono text-[11px] bg-background px-1 rounded">justgate</code>)
              </li>
              <li>
                <strong>Client Secret:</strong> available under <em>Clients → your client → Credentials</em> tab
              </li>
            </ul>
          </div>
        ),
      },
      {
        title: "5. Configure groups claim (optional)",
        content: (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              To populate the <strong>Groups Claim</strong> field (used for org auto-join mapping):
            </p>
            <ul className="space-y-1 list-disc list-inside text-[13px] text-muted-foreground">
              <li>Go to <strong>Clients → your client → Client scopes</strong></li>
              <li>Open the dedicated scope (e.g. <code className="font-mono text-[11px] bg-background px-1 rounded">justgate-dedicated</code>)</li>
              <li>Add a mapper: <strong>Add mapper → By configuration → Group Membership</strong></li>
              <li>Set <strong>Token Claim Name</strong> to <code className="font-mono text-[11px] bg-background px-1 rounded">groups</code> and enable <em>Add to ID token</em></li>
            </ul>
            <p className="text-[13px] text-muted-foreground">Set the <strong>Groups Claim</strong> field in JustGate to <code className="font-mono text-[11px] bg-background px-1 rounded">groups</code>.</p>
          </div>
        ),
      },
    ],
  },
  {
    id: "authentik",
    name: "Authentik",
    callbackNote:
      "Use your actual JustGate domain in place of <your-domain>.",
    steps: [
      {
        title: "1. Create an OAuth2/OIDC Provider",
        content: (
          <ul className="space-y-1 list-disc list-inside text-[13px] text-muted-foreground leading-relaxed">
            <li>In the Authentik admin UI go to <strong>Applications → Providers → Create</strong></li>
            <li>Choose <strong>OAuth2/OpenID Provider</strong></li>
            <li>
              <strong>Authorization flow:</strong> implicit-consent or explicit-consent &nbsp;|&nbsp;
              <strong>Client type:</strong> Confidential
            </li>
            <li>Note the auto-generated <strong>Client ID</strong> and <strong>Client Secret</strong></li>
          </ul>
        ),
      },
      {
        title: "2. Set redirect URIs",
        content: (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">Add the following to <strong>Redirect URIs/Origins</strong>:</p>
            <pre className="rounded-md bg-background/60 px-4 py-3 text-[12px] font-mono text-muted-foreground whitespace-pre-wrap">
{`https://<your-domain>/api/auth/callback/oidc
https://<your-domain>/app/*/_auth/callback`}
            </pre>
          </div>
        ),
      },
      {
        title: "3. Create an Application",
        content:
          'Go to Applications → Applications → Create. Select the provider you just created. Give it a name (e.g. "JustGate") and a slug.',
      },
      {
        title: "4. Copy your credentials",
        content: (
          <div className="space-y-2">
            <ul className="space-y-1 list-disc list-inside text-[13px] text-muted-foreground">
              <li>
                <strong>Issuer URL:</strong>{" "}
                <code className="font-mono text-[11px] bg-background px-1 rounded">
                  https://{"<authentik-host>"}/application/o/{"<app-slug>"}/
                </code>
                <span className="text-[11px]"> (find it under the provider&apos;s <em>OpenID Configuration URL</em> — strip <code className="font-mono">.well-known/openid-configuration</code>)</span>
              </li>
              <li><strong>Client ID</strong> and <strong>Client Secret</strong> shown on the provider detail page</li>
            </ul>
          </div>
        ),
      },
      {
        title: "5. Configure groups claim (optional)",
        content: (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              Authentik includes a <code className="font-mono text-[11px] bg-background px-1 rounded">groups</code> scope by default
              which adds a <code className="font-mono text-[11px] bg-background px-1 rounded">groups</code> array claim to the ID token.
            </p>
            <ul className="space-y-1 list-disc list-inside text-[13px] text-muted-foreground">
              <li>In the provider settings enable the <strong>groups</strong> scope under <em>Advanced protocol settings → Scopes</em></li>
              <li>Set the <strong>Groups Claim</strong> field in JustGate to <code className="font-mono text-[11px] bg-background px-1 rounded">groups</code></li>
            </ul>
          </div>
        ),
      },
    ],
  },
];

function ProviderSection({ provider }: { provider: ProviderDoc }) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {provider.steps.map((step, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium hover:bg-surface/60 transition-colors"
            onClick={() => setOpenStep(openStep === i ? null : i)}
          >
            {step.title}
            {openStep === i ? (
              <ChevronUp size={13} className="text-muted-foreground/60 shrink-0" />
            ) : (
              <ChevronDown size={13} className="text-muted-foreground/60 shrink-0" />
            )}
          </button>
          {openStep === i && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              {typeof step.content === "string" ? (
                <p className="text-[13px] text-muted-foreground leading-relaxed">{step.content}</p>
              ) : (
                step.content
              )}
            </div>
          )}
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">{provider.callbackNote}</p>
    </div>
  );
}

export function OIDCProviderDocs() {
  const [open, setOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState(0);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-panel/60"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <BookOpen size={11} />
          OIDC provider setup guide
        </div>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground/60" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground/60" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          <div className="enterprise-panel p-4 space-y-2">
            <div className="enterprise-kicker">How to obtain credentials</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              JustGate uses the OAuth 2.0 Authorization Code flow. You need to create a{" "}
              <strong>confidential client</strong> in your identity provider and paste the
              Issuer URL, Client ID, and Client Secret into the form above. Select your provider
              for step-by-step instructions.
            </p>
          </div>

          {/* Provider tabs */}
          <div className="flex gap-2">
            {PROVIDERS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProvider(i)}
                className={`rounded-lg border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  activeProvider === i
                    ? "border-foreground bg-foreground/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <ProviderSection provider={PROVIDERS[activeProvider]} />
        </div>
      )}
    </div>
  );
}
