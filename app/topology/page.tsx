import { LiveTopologyMap } from "@/components/admin/live-topology-map";
import { getTopology } from "@/lib/backend-client";

export default async function TopologyPage() {
  const topology = await getTopology();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">Topology</h1>
        <p className="text-sm text-muted-foreground">Live visualization of tenants, routes, and token bindings.</p>
      </header>
      <LiveTopologyMap initialTopology={topology} />
    </div>
  );
}
