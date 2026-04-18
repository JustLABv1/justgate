"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface Preview {
  orgID: string;
  orgName: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
}

function JoinPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { update } = useSession();

  const code = params.get("code") ?? "";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<"loading" | "confirm" | "joining" | "done" | "error">(() => code ? "loading" : "error");
  const [message, setMessage] = useState<string | undefined>(() => code ? undefined : "No invite code provided.");
  const [now] = useState(Date.now);

  useEffect(() => {
    if (!code) return;

    fetch(`/api/invite-preview?code=${encodeURIComponent(code)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          setStatus("error");
          setMessage(data?.error || "Invalid or expired invite.");
          return;
        }
        setPreview(data as Preview);
        setStatus("confirm");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Could not load invite details. Please try again.");
      });
  }, [code]);

  function handleAccept() {
    if (status !== "confirm") return;
    setStatus("joining");

    fetch("/api/admin/orgs/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          setStatus("error");
          setMessage(data?.error || "Failed to accept invite.");
          return;
        }
        await update({ activeOrgId: data.orgID });
        setStatus("done");
        setTimeout(() => router.replace("/"), 1500);
      })
      .catch(() => {
        setStatus("error");
        setMessage("Unexpected error. Please try again.");
      });
  }

  function expiresLabel(iso: string) {
    const diff = new Date(iso).getTime() - now;
    if (diff < 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Expires today";
    return `Expires in ${days} day${days !== 1 ? "s" : ""}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
            <p className="text-sm text-muted-foreground">Loading invite…</p>
          </>
        )}

        {status === "confirm" && preview && (
          <>
            <div className="rounded-xl border border-border bg-surface p-6 text-left space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">You&apos;re invited to join</p>
                <p className="text-xl font-bold text-foreground">{preview.orgName}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                  {preview.useCount} / {preview.maxUses === 0 ? "∞" : preview.maxUses} uses
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                  {expiresLabel(preview.expiresAt)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAccept}
              className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
            >
              Accept and join {preview.orgName}
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Cancel
            </button>
          </>
        )}

        {status === "joining" && (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
            <p className="text-sm text-muted-foreground">Accepting invite…</p>
          </>
        )}

        {status === "done" && (
          <>
            <div className="text-success text-4xl">✓</div>
            <p className="font-semibold text-foreground">You have joined the organisation.</p>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-destructive text-4xl">✗</div>
            <p className="font-semibold text-foreground">Invite failed</p>
            <p className="text-sm text-muted-foreground">{message || "Invalid or expired invite."}</p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="text-sm underline text-muted-foreground hover:text-foreground"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}
