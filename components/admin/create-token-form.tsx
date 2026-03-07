"use client";

import type { IssuedToken } from "@/lib/contracts";
import { Button, Chip, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CreateTokenFormProps {
  existingCount: number;
  tenantIDs: string[];
  disabled?: boolean;
}

export function CreateTokenForm({ existingCount, tenantIDs, disabled = false }: CreateTokenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [issuedToken, setIssuedToken] = useState<IssuedToken>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      tenantID: String(formData.get("tenantID") || ""),
      scopes: String(formData.get("scopes") || ""),
      expiresAt: String(formData.get("expiresAt") || ""),
    };

    const response = await fetch("/api/admin/tokens", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | IssuedToken
      | { error?: string }
      | null;

    if (!response.ok) {
      setIssuedToken(undefined);
      setError(result && "error" in result ? result.error || "token issue failed" : "token issue failed");
      return;
    }

    setIssuedToken(result as IssuedToken);
    form.reset();
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Modal>
      <Button className="bg-foreground text-background" isDisabled={disabled}>
        <Plus size={16} />
        Issue token
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <Modal.Heading className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Issue token</Modal.Heading>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Go generates the credential, stores only the hash, and returns the secret once for operator handoff.
                  </p>
                </div>
                <Chip className="bg-foreground text-background">{existingCount} known</Chip>
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form className="grid gap-4" onSubmit={handleSubmit}>
                <TextField className="grid gap-2">
                  <Label>Token name</Label>
                  <Input name="name" placeholder="grafana-writer" required />
                </TextField>
                <Select className="w-full" isRequired name="tenantID" placeholder="Select tenant" variant="secondary">
                  <Label>Tenant ID</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {tenantIDs.map((tenantID) => (
                        <ListBox.Item key={tenantID} id={tenantID} textValue={tenantID}>
                          {tenantID}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <TextField className="grid gap-2">
                  <Label>Scopes</Label>
                  <Input name="scopes" placeholder="metrics:write, rules:read" required />
                </TextField>
                <TextField className="grid gap-2">
                  <Label>Expiration</Label>
                  <Input name="expiresAt" required type="datetime-local" />
                </TextField>
                {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">{error}</div> : null}
                {issuedToken ? (
                  <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <div className="font-medium">One-time secret</div>
                    <div className="mt-2 font-mono text-sm break-all">{issuedToken.secret}</div>
                    <div className="mt-2">Preview: {issuedToken.token.preview}</div>
                  </div>
                ) : null}
                <Button className="mt-2 w-full bg-foreground text-background" isDisabled={isPending} type="submit">
                  {isPending ? "Issuing token..." : "Issue token"}
                </Button>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}