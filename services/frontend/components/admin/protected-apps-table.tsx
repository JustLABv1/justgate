"use client";

import { AppDetailDrawer } from "@/components/admin/app-detail-drawer";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EditAppModal } from "@/components/admin/edit-app-modal";
import { useToast } from "@/components/toast-provider";
import type { ProtectedApp } from "@/lib/contracts";
import { Button } from "@heroui/react";
import { AppWindow, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface ProtectedAppsTableProps {
  apps: ProtectedApp[];
  actionsDisabled?: boolean;
}

function AuthModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    oidc: "bg-accent/10 text-accent",
    bearer: "bg-success/10 text-success",
    any: "bg-warning/10 text-warning",
    none: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    oidc: "OIDC",
    bearer: "Bearer",
    any: "Any",
    none: "None",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[mode] ?? "bg-muted text-muted-foreground"}`}>
      {labels[mode] ?? mode}
    </span>
  );
}

function DeleteAppButton({ appID, disabled }: { appID: string; disabled?: boolean }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const response = await fetch(`/api/admin/apps/${appID}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        addToast("Delete failed", payload?.error || "App could not be deleted", "error");
        return;
      }
      addToast("App deleted", appID, "success");
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={(open) => (
        <Button
          className="h-8 rounded-full border border-border/60 bg-panel px-3 text-muted-foreground hover:border-danger/40 hover:bg-danger/8 hover:text-danger"
          isDisabled={disabled || isPending}
          onPress={open}
          size="sm"
          variant="ghost"
        >
          <Trash2 size={13} />
          Delete
        </Button>
      )}
      title="Delete protected app"
      description="This will remove the app configuration and revoke all its tokens and sessions. Are you sure?"
      confirmLabel="Delete app"
      onConfirm={handleDelete}
    />
  );
}

export function ProtectedAppsTable({ apps, actionsDisabled }: ProtectedAppsTableProps) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <AppWindow size={22} className="text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground">No protected apps yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Create a protected app to proxy access to an upstream through OIDC or bearer-token auth.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name / Slug</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Upstream</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Auth</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Rate limit</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {apps.map((app) => (
          <tr key={app.id} className="group hover:bg-muted/30 transition-colors">
            <td className="px-4 py-3">
              <div className="font-medium text-foreground">{app.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <code className="font-mono">/app/{app.slug}/</code>
                <Link
                  href={`/app/${app.slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ExternalLink size={11} />
                </Link>
              </div>
            </td>
            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{app.upstreamURL}</td>
            <td className="px-4 py-3">
              <AuthModeBadge mode={app.authMode} />
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground">
              {app.rateLimitRPM > 0 ? `${app.rateLimitRPM} RPM / ${app.rateLimitPer}` : "—"}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                <EditAppModal app={app} disabled={actionsDisabled} />
                <AppDetailDrawer app={app} disabled={actionsDisabled} />
                <DeleteAppButton appID={app.id} disabled={actionsDisabled} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
