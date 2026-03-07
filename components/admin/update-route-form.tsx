"use client";

import type { RouteSummary } from "@/lib/contracts";
import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useTransition } from "react";

interface UpdateRouteFormProps {
  routes: RouteSummary[];
  tenantIDs: string[];
}

function toFormState(route: RouteSummary | undefined) {
  return {
    routeID: route?.id || "",
    slug: route?.slug || "",
    tenantID: route?.tenantID || "",
    targetPath: route?.targetPath || "",
    requiredScope: route?.requiredScope || "",
    methods: route?.methods.join(", ") || "",
  };
}

export function UpdateRouteForm({ routes, tenantIDs }: UpdateRouteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [formState, setFormState] = useState(() => toFormState(routes[0]));

  useEffect(() => {
    const selectedRoute = routes.find((route) => route.id === formState.routeID) || routes[0];
    setFormState(toFormState(selectedRoute));
  }, [formState.routeID, routes]);

  if (routes.length === 0) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);

    const response = await fetch(`/api/admin/routes/${formState.routeID}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        slug: formState.slug,
        tenantID: formState.tenantID,
        targetPath: formState.targetPath,
        requiredScope: formState.requiredScope,
        methods: formState.methods,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | RouteSummary
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(result && "error" in result ? result.error || "route update failed" : "route update failed");
      return;
    }

    setSuccess(`Updated /proxy/${(result as RouteSummary).slug}.`);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card className="border border-slate-900/10 bg-white/85 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.45)]">
      <Card.Header className="flex flex-col gap-3 border-b border-slate-900/10 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Card.Title className="font-display text-2xl text-slate-950">Edit route</Card.Title>
            <Card.Description className="mt-2 max-w-xl text-sm leading-7 text-slate-600">
              Adjust route policy in place without changing the agent-facing control surface pattern.
            </Card.Description>
          </div>
          <Chip className="bg-slate-950 text-white">{routes.length} editable</Chip>
        </div>
      </Card.Header>
      <Card.Content className="space-y-5 pt-6">
        <Form className="grid gap-4" onSubmit={handleSubmit}>
          <TextField className="grid gap-2">
            <Label>Route ID</Label>
            <Input
              list="route-options"
              onChange={(event) =>
                setFormState((current) => ({ ...current, routeID: event.target.value }))
              }
              value={formState.routeID}
            />
          </TextField>
          <datalist id="route-options">
            {routes.map((route) => (
              <option key={route.id} value={route.id} />
            ))}
          </datalist>
          <TextField className="grid gap-2">
            <Label>Proxy slug</Label>
            <Input
              onChange={(event) =>
                setFormState((current) => ({ ...current, slug: event.target.value }))
              }
              value={formState.slug}
            />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Tenant ID</Label>
            <Input
              list="route-tenant-options"
              onChange={(event) =>
                setFormState((current) => ({ ...current, tenantID: event.target.value }))
              }
              value={formState.tenantID}
            />
          </TextField>
          <datalist id="route-tenant-options">
            {tenantIDs.map((tenantID) => (
              <option key={tenantID} value={tenantID} />
            ))}
          </datalist>
          <TextField className="grid gap-2">
            <Label>Target path</Label>
            <Input
              onChange={(event) =>
                setFormState((current) => ({ ...current, targetPath: event.target.value }))
              }
              value={formState.targetPath}
            />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Required scope</Label>
            <Input
              onChange={(event) =>
                setFormState((current) => ({ ...current, requiredScope: event.target.value }))
              }
              value={formState.requiredScope}
            />
          </TextField>
          <TextField className="grid gap-2">
            <Label>Allowed methods</Label>
            <Input
              onChange={(event) =>
                setFormState((current) => ({ ...current, methods: event.target.value }))
              }
              value={formState.methods}
            />
          </TextField>
          <Button className="mt-2 w-full bg-slate-950 text-white" isDisabled={isPending} type="submit">
            {isPending ? "Updating route..." : "Update route"}
          </Button>
        </Form>
        {error ? <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">{error}</div> : null}
        {success ? <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-950">{success}</div> : null}
      </Card.Content>
    </Card>
  );
}