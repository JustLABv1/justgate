"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function JoinPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { update } = useSession();

  const code = params.get("code") ?? "";

  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setMessage("No invite code provided.");
      return;
    }

    if (status !== "idle") return;

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
  // Only run once when code is available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
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
            <p className="text-sm text-muted-foreground">{message}</p>
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
