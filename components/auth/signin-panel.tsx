"use client";

import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

interface SignInPanelProps {
  callbackUrl: string;
  oidcEnabled: boolean;
  localAccountsEnabled: boolean;
  localRegistrationEnabled: boolean;
}

export function SignInPanel({
  callbackUrl,
  oidcEnabled,
  localAccountsEnabled,
  localRegistrationEnabled,
}: SignInPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
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
    setSuccess(undefined);

    const result = await signIn("credentials", {
      email,
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

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: registerEmail,
        name: registerName,
        password: registerPassword,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; email?: string }
      | null;
    if (!response.ok) {
      setError(payload?.error || "Local account registration failed.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: registerEmail,
      password: registerPassword,
      callbackUrl,
      redirect: false,
    });
    if (!signInResult || signInResult.error) {
      setSuccess("Account created. Sign in with your new credentials.");
      return;
    }

    router.push(signInResult.url || callbackUrl);
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

        <div className="grid gap-6 lg:grid-cols-3">
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
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Built-in</div>
                <div className="mt-2 font-display text-2xl text-slate-950">Local account sign-in</div>
              </div>
              <p className="text-sm leading-7 text-slate-600">
                Use credentials stored by the Go backend when you want account-based access without external identity infrastructure.
              </p>
              <Form className="grid gap-3" onSubmit={handleDevSignIn}>
                <TextField className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    disabled={!localAccountsEnabled || isPending}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    value={email}
                  />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Password</Label>
                  <Input
                    disabled={!localAccountsEnabled || isPending}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    value={password}
                  />
                </TextField>
                <Button
                  className="w-full bg-white text-slate-950 ring-1 ring-slate-900/10"
                  isDisabled={!localAccountsEnabled || isPending}
                  type="submit"
                >
                  {localAccountsEnabled ? "Sign in locally" : "Local login disabled"}
                </Button>
              </Form>
            </Card.Content>
          </Card>

          <Card className="border border-slate-900/10 bg-[rgba(252,250,245,0.72)] shadow-none">
            <Card.Content className="space-y-4 p-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Self-service</div>
                <div className="mt-2 font-display text-2xl text-slate-950">Create local account</div>
              </div>
              <p className="text-sm leading-7 text-slate-600">
                Register a local admin account when OIDC is optional or not yet wired for the environment.
              </p>
              <Form className="grid gap-3" onSubmit={handleRegister}>
                <TextField className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    disabled={!localRegistrationEnabled || isPending}
                    onChange={(event) => setRegisterName(event.target.value)}
                    value={registerName}
                  />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    disabled={!localRegistrationEnabled || isPending}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    type="email"
                    value={registerEmail}
                  />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Password</Label>
                  <Input
                    disabled={!localRegistrationEnabled || isPending}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    type="password"
                    value={registerPassword}
                  />
                </TextField>
                <Button
                  className="w-full bg-slate-950 text-white"
                  isDisabled={!localRegistrationEnabled || isPending}
                  type="submit"
                >
                  {localRegistrationEnabled ? "Register local account" : "Registration disabled"}
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
        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            {success}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}