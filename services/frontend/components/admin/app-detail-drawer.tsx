"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useToast } from "@/components/toast-provider";
import type { AppSession, AppToken, IssuedAppToken, ProtectedApp } from "@/lib/contracts";
import { Button, Modal } from "@heroui/react";
import { Copy, KeyRound, Settings, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface AppDetailDrawerProps {
  app: ProtectedApp;
  disabled?: boolean;
}

function formatDate(iso: string) {
  if (!iso || iso.startsWith("0001")) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function TokensPanel({ app, onClose }: { app: ProtectedApp; onClose: () => void }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [tokens, setTokens] = useState<AppToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState("");
  const [issuedSecret, setIssuedSecret] = useState<string>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/admin/apps/${app.id}/tokens`)
      .then((r) => r.json())
      .then((data) => setTokens(Array.isArray(data) ? data : []))
      .catch(() => setTokens([]))
      .finally(() => setLoading(false));
  }, [app.id]);

  function handleCreate() {
    if (!newTokenName.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/apps/${app.id}/tokens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      const data = (await res.json().catch(() => null)) as IssuedAppToken | { error?: string } | null;
      if (!res.ok) {
        addToast("Failed to create token", (data as { error?: string })?.error ?? "", "error");
        return;
      }
      const issued = data as IssuedAppToken;
      setIssuedSecret(issued.secret);
      setTokens((prev) => [issued.token, ...prev]);
      setNewTokenName("");
      router.refresh();
    });
  }

  function handleDelete(tokenID: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/apps/${app.id}/tokens/${tokenID}`, { method: "DELETE" });
      if (!res.ok) {
        addToast("Failed to delete token", "", "error");
        return;
      }
      setTokens((prev) => prev.filter((t) => t.id !== tokenID));
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {issuedSecret && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="mb-2 text-sm font-medium text-success">Token created — copy it now, it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-success/10 px-3 py-2 text-xs font-mono text-success">{issuedSecret}</code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onPress={() => { navigator.clipboard.writeText(issuedSecret); addToast("Copied", "", "success"); }}
            >
              <Copy size={13} />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newTokenName}
          onChange={(e) => setNewTokenName(e.target.value)}
          placeholder="Token name…"
          className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button
          size="sm"
          className="gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          isDisabled={isPending || !newTokenName.trim()}
          onPress={handleCreate}
        >
          Issue token
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tokens…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{token.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{token.preview}…</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${token.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {token.active ? "Active" : "Inactive"}
                </span>
                <ConfirmDialog
                  trigger={(open) => (
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-danger" isDisabled={isPending} onPress={open}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                  title="Revoke token"
                  description="This token will no longer be accepted by the proxy."
                  confirmLabel="Revoke"
                  onConfirm={() => handleDelete(token.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionsPanel({ app }: { app: ProtectedApp }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/admin/apps/${app.id}/sessions`)
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [app.id]);

  function handleRevoke(sessionID: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/apps/${app.id}/sessions/${sessionID}`, { method: "DELETE" });
      if (!res.ok) {
        addToast("Failed to revoke session", "", "error");
        return;
      }
      setSessions((prev) => prev.map((s) => s.id === sessionID ? { ...s, revoked: true } : s));
      router.refresh();
    });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading sessions…</p>;
  if (sessions.length === 0) return <p className="text-sm text-muted-foreground">No active sessions.</p>;

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {sessions.map((session) => (
        <div key={session.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{session.userName || session.userEmail || session.userSub}</p>
            <p className="text-xs text-muted-foreground">{session.userEmail} · {session.ip}</p>
            <p className="text-xs text-muted-foreground">Last used: {formatDate(session.lastUsedAt)} · Expires: {formatDate(session.expiresAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${session.revoked ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
              {session.revoked ? "Revoked" : "Active"}
            </span>
            {!session.revoked && (
              <ConfirmDialog
                trigger={(open) => (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-danger" isDisabled={isPending} onPress={open}>
                    <Trash2 size={13} />
                  </Button>
                )}
                title="Revoke session"
                description="The user will be logged out of this app immediately."
                confirmLabel="Revoke"
                onConfirm={() => handleRevoke(session.id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type Tab = "tokens" | "sessions";

export function AppDetailDrawer({ app, disabled }: AppDetailDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tokens");

  return (
    <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        isDisabled={disabled}
        onPress={() => setIsOpen(true)}
        size="sm"
        variant="ghost"
        className="h-8 rounded-full border border-border/60 bg-panel px-3 text-muted-foreground hover:border-accent/40 hover:text-accent"
      >
        <Settings size={13} />
        Manage
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="h-full rounded-l-2xl border-l border-border bg-overlay/96 shadow-[var(--overlay-shadow)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-xl font-semibold tracking-tight">{app.name}</Modal.Heading>
              <p className="mt-1 font-mono text-sm text-muted-foreground">/app/{app.slug}/</p>
            </Modal.Header>
            <Modal.Body className="pb-6">
              <div className="mb-6 flex gap-1 rounded-xl border border-border bg-background p-1">
                {(["tokens", "sessions"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      tab === t ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "tokens" ? <KeyRound size={14} /> : <Users size={14} />}
                    {t}
                  </button>
                ))}
              </div>

              {tab === "tokens" && <TokensPanel app={app} onClose={() => setIsOpen(false)} />}
              {tab === "sessions" && <SessionsPanel app={app} />}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
