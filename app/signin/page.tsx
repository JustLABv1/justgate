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
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
          <ShieldCheck size={24} />
        </div>
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted-foreground">
            Tenant-aware access control
          </div>
          <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            Secure your proxy boundary with a clean control plane.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Manage tenants, routes, tokens, and audit trails through the Go backend with a minimal admin surface that stays out of the way.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
            <div className="text-sm font-semibold text-foreground">Go-backed auth</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Local accounts and admin token exchange stay on the backend boundary.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
            <div className="text-sm font-semibold text-foreground">OIDC optional</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enable enterprise sign-in without losing support for smaller setups.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
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
          oidcEnabled={isOIDCEnabled()}
        />
      </div>
    </div>
  );
}
