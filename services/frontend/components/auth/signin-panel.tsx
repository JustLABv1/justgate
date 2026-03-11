"use client";

import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { ArrowUpRight, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

type AuthMode = "signin" | "register";

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
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [isPending, startTransition] = useTransition();

  function handleOIDCSignIn() {
    setError(undefined);
    setSuccess(undefined);
    startTransition(() => {
      void signIn("oidc", { callbackUrl });
    });
  }

  async function handleLocalSignIn(event: FormEvent<HTMLFormElement>) {
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
      setError(result?.error || "Sign-in failed.");
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
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error || "Registration failed.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: registerEmail,
      password: registerPassword,
      callbackUrl,
      redirect: false,
    });

    if (!signInResult || signInResult.error) {
      setSuccess("Account created. Sign in with the new credentials.");
      return;
    }

    router.push(signInResult.url || callbackUrl);
    router.refresh();
  }

  return (
    <Card className="surface-card overflow-hidden rounded-[32px] border-0">
      <Card.Content className="space-y-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Chip className="w-fit bg-panel text-foreground">Admin access</Chip>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                Sign in to continue
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use OIDC when it is configured, or fall back to local backend-managed credentials.
              </p>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-surface text-foreground shadow-[var(--field-shadow)]">
            <ShieldCheck size={20} />
          </div>
        </div>

        {oidcEnabled ? (
          <Button
            className="h-12 w-full rounded-2xl bg-foreground text-background"
            isDisabled={isPending}
            onPress={handleOIDCSignIn}
          >
            <ArrowUpRight size={16} />
            Continue with OIDC
          </Button>
        ) : null}

        {localAccountsEnabled || localRegistrationEnabled ? (
          <div className="space-y-4 rounded-[28px] border border-border/80 bg-panel/55 p-5">
            {localRegistrationEnabled ? (
              <div className="inline-flex w-full rounded-full border border-border/80 bg-surface/90 p-1 shadow-[var(--field-shadow)]">
                <Button
                  className={[
                    "h-10 flex-1 rounded-full",
                    mode === "signin" ? "bg-foreground text-background" : "bg-transparent text-muted-foreground",
                  ].join(" ")}
                  onPress={() => setMode("signin")}
                  size="sm"
                  variant="ghost"
                >
                  Sign in
                </Button>
                <Button
                  className={[
                    "h-10 flex-1 rounded-full",
                    mode === "register" ? "bg-foreground text-background" : "bg-transparent text-muted-foreground",
                  ].join(" ")}
                  onPress={() => setMode("register")}
                  size="sm"
                  variant="ghost"
                >
                  Register
                </Button>
              </div>
            ) : null}

            {mode === "signin" || !localRegistrationEnabled ? (
              <div>
                <div className="mb-4">
                  <div className="text-sm font-semibold text-foreground">Local sign in</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Authenticate with a backend-managed local account.
                  </p>
                </div>

                <Form className="grid gap-3" onSubmit={handleLocalSignIn}>
                  <TextField className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      disabled={!localAccountsEnabled || isPending}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@example.com"
                      type="email"
                      value={email}
                    />
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Password</Label>
                    <Input
                      disabled={!localAccountsEnabled || isPending}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 10 characters"
                      type="password"
                      value={password}
                    />
                  </TextField>
                  <Button
                    className="mt-1 h-11 w-full rounded-2xl bg-foreground text-background"
                    isDisabled={!localAccountsEnabled || isPending}
                    type="submit"
                  >
                    <LockKeyhole size={16} />
                    {localAccountsEnabled ? "Sign in" : "Local sign-in disabled"}
                  </Button>
                </Form>
              </div>
            ) : null}

            {mode === "register" && localRegistrationEnabled ? (
              <div>
                <div className="mb-4">
                  <div className="text-sm font-semibold text-foreground">Create account</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Register a local admin for environments without mandatory SSO.
                  </p>
                </div>

                <Form className="grid gap-3" onSubmit={handleRegister}>
                  <TextField className="grid gap-2">
                    <Label>Name</Label>
                    <Input
                      disabled={isPending}
                      onChange={(event) => setRegisterName(event.target.value)}
                      placeholder="Jane Proxy"
                      value={registerName}
                    />
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      disabled={isPending}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      placeholder="jane@example.com"
                      type="email"
                      value={registerEmail}
                    />
                  </TextField>
                  <TextField className="grid gap-2">
                    <Label>Password</Label>
                    <Input
                      disabled={isPending}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="At least 10 characters"
                      type="password"
                      value={registerPassword}
                    />
                  </TextField>
                  <Button className="mt-1 h-11 w-full rounded-2xl" isDisabled={isPending} type="submit">
                    <UserPlus size={16} />
                    Register account
                  </Button>
                </Form>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/12 px-4 py-3 text-sm text-warning-foreground">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-success/30 bg-success/12 px-4 py-3 text-sm text-success-foreground">
            {success}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
