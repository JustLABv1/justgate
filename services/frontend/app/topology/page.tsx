import { LiveTopologyMap } from "@/components/admin/live-topology-map";
import { auth } from "@/lib/auth";
import { getTopology } from "@/lib/backend-client";

export default async function TopologyPage() {
  const [topology, session] = await Promise.all([getTopology(), auth()]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Topology</h1>
        <p className="text-sm text-muted-foreground">Live visualization of tenants, routes, and token bindings.</p>
      </header>
      <LiveTopologyMap initialTopology={topology} orgId={session?.activeOrgId ?? null} />
    </div>
  );
}
