import { LiveTopologyMap } from "@/components/admin/live-topology-map";
import { getTopology } from "@/lib/backend-client";

export default async function TopologyPage() {
  const topology = await getTopology();

  return (
    <div className="space-y-8">
      <LiveTopologyMap initialTopology={topology} />
    </div>
  );
}