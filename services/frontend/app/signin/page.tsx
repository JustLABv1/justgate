import { SignInPanel } from "@/components/auth/signin-panel";
import { isLocalAccountsEnabled, isLocalRegistrationEnabled, isOIDCEnabled } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const callbackUrl = resolvedSearchParams.callbackUrl || "/";

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,460px)]">
      <div className="max-w-2xl space-y-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] border border-border/70 bg-surface text-foreground shadow-[var(--field-shadow)]">
          <ShieldCheck size={24} />
        </div>
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-border/80 bg-surface/90 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Tenant-aware access control
          </div>
          <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-6xl">
            Secure the proxy boundary with a quieter administrative surface.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Manage tenants, routes, tokens, and audit trails through the Go backend with a minimal, readable interface suited to enterprise operations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-card rounded-[28px] border-0 p-5">
            <div className="text-sm font-semibold text-foreground">Go-backed auth</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Local accounts and admin token exchange stay on the backend boundary.
            </p>
          </div>
          <div className="surface-card rounded-[28px] border-0 p-5">
            <div className="text-sm font-semibold text-foreground">OIDC optional</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enable enterprise sign-in without losing support for smaller setups.
            </p>
          </div>
          <div className="surface-card rounded-[28px] border-0 p-5">
            <div className="text-sm font-semibold text-foreground">Operational focus</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Routes, tenants, and audit access are built for day-to-day control work.
            </p>
          </div>
        </div>
      </div>

      <div>
        <SignInPanel
          callbackUrl={callbackUrl}
          localAccountsEnabled={isLocalAccountsEnabled()}
          localRegistrationEnabled={isLocalRegistrationEnabled()}
          oidcEnabled={await isOIDCEnabled()}
        />
      </div>
    </div>
  );
}
