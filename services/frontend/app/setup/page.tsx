import { SetupWizard } from "@/components/admin/setup-wizard";
import { getBackendBaseUrl } from "@/lib/backend-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function getSetupStatus(): Promise<{ setupRequired: boolean }> {
  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/v1/setup/status`, {
      cache: "no-store",
    });
    if (!res.ok) return { setupRequired: false };
    return (await res.json()) as { setupRequired: boolean };
  } catch {
    return { setupRequired: false };
  }
}

export default async function SetupPage() {
  const { setupRequired } = await getSetupStatus();

  if (!setupRequired) {
    redirect("/");
  }

  return (
    <div className="flex w-full items-center justify-center p-6">
      <SetupWizard />
    </div>
  );
}
