"use client";

import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

interface SignInPanelProps {
  callbackUrl: string;
  oidcEnabled: boolean;
  devAuthEnabled: boolean;
}

export function SignInPanel({ callbackUrl, oidcEnabled, devAuthEnabled }: SignInPanelProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleOIDCSignIn() {
    setError(undefined);
    startTransition(() => {
      void signIn("oidc", { callbackUrl });
    });
  }

  async function handleDevSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const result = await signIn("credentials", {
      password,
      callbackUrl,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Local admin sign-in failed.");
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  return (
    <Card className="border border-slate-900/10 bg-white/84 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.42)] backdrop-blur">
      <Card.Content className="space-y-6 p-8">
        <div className="space-y-3">
          <Chip className="w-fit bg-slate-950 text-white">Admin access</Chip>
          <div>
            <h2 className="font-display text-4xl text-slate-950">Authenticate to control the proxy</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              The admin UI now requires a signed session before it can read or mutate Go control-plane state.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-slate-900/10 bg-[rgba(252,250,245,0.72)] shadow-none">
            <Card.Content className="space-y-4 p-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Recommended</div>
                <div className="mt-2 font-display text-2xl text-slate-950">OIDC single sign-on</div>
              </div>
              <p className="text-sm leading-7 text-slate-600">
                Use your identity provider when issuer and client credentials are configured for the admin console.
              </p>
              <Button
                className="w-full bg-slate-950 text-white"
                isDisabled={!oidcEnabled || isPending}
                onPress={handleOIDCSignIn}
              >
                {oidcEnabled ? "Continue with OIDC" : "OIDC not configured"}
              </Button>
            </Card.Content>
          </Card>

          <Card className="border border-slate-900/10 bg-[rgba(252,250,245,0.72)] shadow-none">
            <Card.Content className="space-y-4 p-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Development fallback</div>
                <div className="mt-2 font-display text-2xl text-slate-950">Local admin password</div>
              </div>
              <p className="text-sm leading-7 text-slate-600">
                This fallback is intended for local development when external OIDC is not available.
              </p>
              <Form className="grid gap-3" onSubmit={handleDevSignIn}>
                <TextField className="grid gap-2">
                  <Label>Password</Label>
                  <Input
                    disabled={!devAuthEnabled || isPending}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />
                </TextField>
                <Button
                  className="w-full bg-white text-slate-950 ring-1 ring-slate-900/10"
                  isDisabled={!devAuthEnabled || isPending}
                  type="submit"
                >
                  {devAuthEnabled ? "Use local admin login" : "Local login disabled"}
                </Button>
              </Form>
            </Card.Content>
          </Card>
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {error}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}