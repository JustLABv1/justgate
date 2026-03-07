import { SignInPanel } from "@/components/auth/signin-panel";
import { isLocalAccountsEnabled, isLocalRegistrationEnabled, isOIDCEnabled } from "@/lib/auth";
import { Card } from "@heroui/react";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const callbackUrl = resolvedSearchParams.callbackUrl || "/";

  return (
    <div className="grid min-h-[70vh] items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <SignInPanel
        callbackUrl={callbackUrl}
        localAccountsEnabled={isLocalAccountsEnabled()}
        localRegistrationEnabled={isLocalRegistrationEnabled()}
        oidcEnabled={isOIDCEnabled()}
      />
      <Card className="border border-slate-900/10 bg-slate-950 text-slate-100 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)]">
        <Card.Content className="space-y-4 p-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Control boundary</div>
          <h2 className="font-display text-3xl text-white">Authenticated sessions become backend admin identity.</h2>
          <p className="text-sm leading-7 text-slate-300">
            The browser signs in through OIDC or backend-managed local accounts. The server then mints a short-lived admin JWT that Go validates before any control-plane read or write.
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}