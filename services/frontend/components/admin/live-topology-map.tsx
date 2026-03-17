"use client";

import { CreateRouteForm } from "@/components/admin/create-route-form";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { CreateTokenForm } from "@/components/admin/create-token-form";
import { TokenStatsPanel } from "@/components/admin/token-stats-panel";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import { UpdateTenantForm } from "@/components/admin/update-tenant-form";
import type { QueryResult, TopologySnapshot } from "@/lib/contracts";
import { Button, Card, Chip, Surface } from "@heroui/react";
import { Activity, ArrowRight, KeyRound, LocateFixed, Maximize2, Minimize2, Move, Plus, RefreshCw, Route, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface LiveTopologyMapProps {
  initialTopology: QueryResult<TopologySnapshot>;
  orgId?: string | null;
}

type SelectedNode =
  | { kind: "token"; id: string }
  | { kind: "route"; id: string }
  | { kind: "tenant"; id: string }
  | null;

type ConnectionMode =
  | { kind: "route-from-tenant" }
  | { kind: "token-from-tenant" }
  | { kind: "token-from-route" }
  | null;

type GraphNode = {
  id: string;
  kind: "token" | "route" | "tenant" | "draft" | "upstream";
  label: string;
  meta: string;
  stats?: string;
  cbState?: string;
  x: number;
  y: number;
  tone: string;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: "access" | "binding" | "draft" | "upstream";
  hot: boolean;
  error: boolean;
  reachable?: boolean;
  revoked?: boolean;
  latencyMs?: number;
  circuitBreakerState?: string;
  circuitBreakerLocked?: boolean;
  label?: string;
};

type CameraState = {
  scale: number;
  x: number;
  y: number;
};

const SCENE_WIDTH = 2420;
const LANE_X = {
  token: 240,
  route: 920,
  tenant: 1600,
  upstream: 2120,
};
const CAMERA_MARGIN = 160;
const SCALE_LIMITS = {
  max: 1.35,
  min: 0.18,
};

function distributePositions(count: number, start: number, end: number) {
  if (count <= 1) {
    return [(start + end) / 2];
  }

  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

function pathBetween(from: GraphNode, to: GraphNode) {
  const forward = from.x <= to.x;
  const startX = from.x + (forward ? 120 : -120);
  const endX = to.x + (forward ? -120 : 120);
  const startY = from.y;
  const endY = to.y;
  const controlOffset = Math.max(120, Math.abs(endX - startX) * 0.36);
  return `M ${startX} ${startY} C ${startX + (forward ? controlOffset : -controlOffset)} ${startY}, ${endX - (forward ? controlOffset : -controlOffset)} ${endY}, ${endX} ${endY}`;
}

function edgeGlow(color: string) {
  return `0 0 0 6px color-mix(in oklab, ${color} 18%, transparent)`;
}

/** Maps avg latency (ms) to packet animation duration (s). Low latency = fast packets. */
function latencyToDuration(ms: number): string {
  const clamped = Math.min(Math.max(ms, 0), 2000);
  const dur = 0.6 + (clamped / 2000) * 3.4; // 0.6s (0ms) → 4.0s (2000ms)
  return `${dur.toFixed(2)}s`;
}

/** Returns the midpoint of a cubic bezier path for badge positioning. */
function bezierMidpoint(from: GraphNode, to: GraphNode): { x: number; y: number } {
  const forward = from.x <= to.x;
  const p0x = from.x + (forward ? 120 : -120);
  const p0y = from.y;
  const p3x = to.x + (forward ? -120 : 120);
  const p3y = to.y;
  const controlOffset = Math.max(120, Math.abs(p3x - p0x) * 0.36);
  const p1x = p0x + (forward ? controlOffset : -controlOffset);
  const p1y = p0y;
  const p2x = p3x - (forward ? controlOffset : -controlOffset);
  const p2y = p3y;
  // De Casteljau at t=0.5
  const x = 0.125 * p0x + 0.375 * p1x + 0.375 * p2x + 0.125 * p3x;
  const y = 0.125 * p0y + 0.375 * p1y + 0.375 * p2y + 0.125 * p3y;
  return { x, y };
}

function clampCamera(camera: CameraState, viewportWidth: number, viewportHeight: number, sceneHeight: number): CameraState {
  const scaledWidth = SCENE_WIDTH * camera.scale;
  const scaledHeight = sceneHeight * camera.scale;

  let x = camera.x;
  if (scaledWidth + CAMERA_MARGIN * 2 <= viewportWidth) {
    x = (viewportWidth - scaledWidth) / 2;
  } else {
    const minX = viewportWidth - scaledWidth - CAMERA_MARGIN;
    const maxX = CAMERA_MARGIN;
    x = Math.min(maxX, Math.max(minX, camera.x));
  }

  let y = camera.y;
  if (scaledHeight + CAMERA_MARGIN * 2 <= viewportHeight) {
    y = (viewportHeight - scaledHeight) / 2;
  } else {
    const minY = viewportHeight - scaledHeight - CAMERA_MARGIN;
    const maxY = CAMERA_MARGIN;
    y = Math.min(maxY, Math.max(minY, camera.y));
  }

  return {
    scale: camera.scale,
    x,
    y,
  };
}

function fitCamera(viewportWidth: number, viewportHeight: number, sceneHeight: number): CameraState {
  const scale = Math.min(
    SCALE_LIMITS.max,
    Math.max(
      SCALE_LIMITS.min,
      Math.min((viewportWidth - 80) / SCENE_WIDTH, (viewportHeight - 120) / sceneHeight),
    ),
  );

  return clampCamera(
    {
      scale,
      x: (viewportWidth - SCENE_WIDTH * scale) / 2,
      y: (viewportHeight - sceneHeight * scale) / 2,
    },
    viewportWidth,
    viewportHeight,
    sceneHeight,
  );
}

export function LiveTopologyMap({ initialTopology, orgId }: LiveTopologyMapProps) {
  const [snapshot, setSnapshot] = useState(initialTopology);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(null);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "retrying" | "offline">("connecting");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [camera, setCamera] = useState<CameraState>({ scale: 0.8, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false);
  const [isCreateRouteOpen, setIsCreateRouteOpen] = useState(false);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [routeDraftTenantID, setRouteDraftTenantID] = useState<string>();
  const [tokenDraftTenantID, setTokenDraftTenantID] = useState<string>();
  const [tokenDraftScopes, setTokenDraftScopes] = useState<string>();
  const [editingRouteID, setEditingRouteID] = useState<string>();
  const [editingTenantID, setEditingTenantID] = useState<string>();
  const [selectedCBEdge, setSelectedCBEdge] = useState<{
    routeID: string;
    routeLabel: string;
    tenantLabel: string;
    state: string;
    locked: boolean;
    latencyMs: number;
    sceneX: number;
    sceneY: number;
  } | null>(null);
  const [isForcingCB, setIsForcingCB] = useState(false);
  const [pendingCBAction, setPendingCBAction] = useState<"open" | "close" | null>(null);
  const [selectedTokenEdge, setSelectedTokenEdge] = useState<{
    tokenID: string;
    routeID: string;
    tokenLabel: string;
    routeLabel: string;
    sceneX: number;
    sceneY: number;
  } | null>(null);
  const [pendingTokenAction, setPendingTokenAction] = useState<"revoke" | "reactivate" | null>(null);
  const [isActingOnToken, setIsActingOnToken] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const connectionAttemptRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ originX: number; originY: number; startX: number; startY: number } | null>(null);
  const sceneHeightRef = useRef(980);

  const routeTenants = snapshot.data.tenants;
  const routeTenantIDs = useMemo(() => snapshot.data.tenants.map((tenant) => tenant.tenantID), [snapshot.data.tenants]);

  const selectedRoute = useMemo(
    () => (editingRouteID ? snapshot.data.routes.find((route) => route.id === editingRouteID) || null : null),
    [editingRouteID, snapshot.data.routes],
  );

  const selectedTenant = useMemo(
    () => (editingTenantID ? snapshot.data.tenants.find((tenant) => tenant.id === editingTenantID) || null : null),
    [editingTenantID, snapshot.data.tenants],
  );

  const selectedRouteForInspector = useMemo(
    () => (selectedNode?.kind === "route" ? snapshot.data.routes.find((route) => route.id === selectedNode.id) || null : null),
    [selectedNode, snapshot.data.routes],
  );

  const selectedTenantForInspector = useMemo(
    () => (selectedNode?.kind === "tenant" ? snapshot.data.tenants.find((tenant) => tenant.id === selectedNode.id) || null : null),
    [selectedNode, snapshot.data.tenants],
  );

  const selectedTokenForInspector = useMemo(
    () => (selectedNode?.kind === "token" ? snapshot.data.tokens.find((token) => token.id === selectedNode.id) || null : null),
    [selectedNode, snapshot.data.tokens],
  );

  async function pollTopology() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/admin/topology", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const next = (await response.json()) as QueryResult<TopologySnapshot>;
      setSnapshot(next);
    } finally {
      setIsRefreshing(false);
    }
  }

  function clearConnectionMode() {
    setConnectionMode(null);
    setRouteDraftTenantID(undefined);
    setTokenDraftTenantID(undefined);
    setTokenDraftScopes(undefined);
  }

  function handleTopologyChanged() {
    void pollTopology();
  }

  // Keep a ref to the current orgId so the socket cleanup can compare
  const orgIdRef = useRef(orgId);
  useEffect(() => {
    orgIdRef.current = orgId;
  }, [orgId]);

  useEffect(() => {
    let disposed = false;

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        void connect();
      }, 3000);
    };

    const connect = async () => {
      const attemptID = connectionAttemptRef.current + 1;
      connectionAttemptRef.current = attemptID;

      // Close any existing SSE connection.
      if (socketRef.current) {
        (socketRef.current as unknown as EventSource).close();
        socketRef.current = null;
      }

      setStreamStatus((current) => (current === "live" ? current : current === "retrying" ? "retrying" : "connecting"));

      try {
        const response = await fetch("/api/admin/topology/socket-info", { cache: "no-store" });
        if (disposed || attemptID !== connectionAttemptRef.current) {
          return;
        }
        if (!response.ok) {
          setStreamStatus("offline");
          scheduleReconnect();
          return;
        }

        const socketInfo = (await response.json()) as { token: string; sseUrl: string; orgId?: string | null };
        const orgParam = socketInfo.orgId ? `&org_id=${encodeURIComponent(socketInfo.orgId)}` : "";
        const es = new EventSource(`${socketInfo.sseUrl}?access_token=${encodeURIComponent(socketInfo.token)}${orgParam}`);
        // Store as unknown cast – the ref type is WebSocket for legacy reasons.
        socketRef.current = es as unknown as WebSocket;

        es.onopen = () => {
          if (disposed || attemptID !== connectionAttemptRef.current) {
            return;
          }
          if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          setStreamStatus("live");
        };

        es.onmessage = (event) => {
          if (disposed || attemptID !== connectionAttemptRef.current) {
            return;
          }
          const message = JSON.parse(event.data) as { type: "snapshot" | "error"; data?: TopologySnapshot };
          if (message.type !== "snapshot" || !message.data) {
            return;
          }
          setSnapshot((current) => ({
            ...current,
            data: message.data as TopologySnapshot,
            error: undefined,
            source: "backend",
          }));
        };

        es.onerror = () => {
          if (disposed || attemptID !== connectionAttemptRef.current) {
            return;
          }
          // EventSource auto-reconnects; just show retrying status.
          setStreamStatus("retrying");
        };
      } catch {
        if (disposed || attemptID !== connectionAttemptRef.current) {
          return;
        }
        setStreamStatus("offline");
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  // Re-run whenever the active org changes so the socket reconnects to the right stream
  }, [orgId]);

  const graph = useMemo(() => {
    const now = Date.now();
    const ACTIVE_THRESHOLD_MS = 30 * 1000; // 30 seconds — edges animate only when traffic is live
    const recentAudits = snapshot.data.auditEvents.slice(0, 18);
    const activeAudits = recentAudits.filter((event) => now - new Date(event.timestamp).getTime() < ACTIVE_THRESHOLD_MS);

    // Sort tenants first — their Y positions anchor the downstream columns
    const tenants = [...snapshot.data.tenants].sort((a, b) => a.tenantID.localeCompare(b.tenantID));
    const rawRoutes = [...snapshot.data.routes];
    const rawTokens = [...snapshot.data.tokens];

    const rowCount = Math.max(rawTokens.length, rawRoutes.length, tenants.length, 1);
    const sceneHeight = Math.max(980, 260 + rowCount * 170);

    // Tenant Y positions are determined first
    const tenantYArr = distributePositions(tenants.length || 1, 220, sceneHeight - 180);
    const tenantYByTenantID = new Map(tenants.map((t, i) => [t.tenantID, tenantYArr[i] ?? sceneHeight / 2]));

    // Routes sorted by their tenant's Y position — route→tenant edges will not cross each other
    const routes = rawRoutes.sort((a, b) => {
      const ay = tenantYByTenantID.get(a.tenantID) ?? 0;
      const by = tenantYByTenantID.get(b.tenantID) ?? 0;
      return ay - by || a.slug.localeCompare(b.slug);
    });
    const routeYArr = distributePositions(routes.length || 1, 180, sceneHeight - 180);
    const routeYByRouteID = new Map(routes.map((r, i) => [r.id, routeYArr[i] ?? sceneHeight / 2]));

    // Tokens sorted by the average Y of their accessible routes — token→route edges will not cross each other
    const tokens = rawTokens.sort((a, b) => {
      const avgY = (token: typeof a) => {
        const accessible = routes.filter((r) => r.tenantID === token.tenantID && token.scopes.includes(r.requiredScope));
        if (accessible.length === 0) return tenantYByTenantID.get(token.tenantID) ?? sceneHeight / 2;
        return accessible.reduce((sum, r) => sum + (routeYByRouteID.get(r.id) ?? 0), 0) / accessible.length;
      };
      const diff = avgY(a) - avgY(b);
      return diff !== 0 ? diff : Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
    });
    const tokenYArr = distributePositions(tokens.length || 1, 220, sceneHeight - 180);

    // Aliased for backward compat with node constructors below
    const tokenY = tokenYArr;
    const routeY = routeYArr;
    const tenantY = tenantYArr;
    const routeMetrics = new Map<string, { throughput: number; errors: number; avgLatencyMs: number }>();

    for (const route of routes) {
      const matchingAudits = recentAudits.filter((audit) => audit.routeSlug === route.slug && audit.tenantID === route.tenantID);
      // Only count errors within the active window so lines stop being red once errors age out
      const activeMatchingAudits = activeAudits.filter((audit) => audit.routeSlug === route.slug && audit.tenantID === route.tenantID);
      const latencyAudits = matchingAudits.filter((a) => a.latencyMs > 0);
      const avgLatencyMs = latencyAudits.length > 0
        ? latencyAudits.reduce((sum, a) => sum + a.latencyMs, 0) / latencyAudits.length
        : 0;
      routeMetrics.set(route.id, {
        throughput: matchingAudits.length,
        errors: activeMatchingAudits.filter((audit) => audit.status >= 400).length,
        avgLatencyMs,
      });
    }

    const tokenNodes: GraphNode[] = tokens.map((token, index) => ({
      id: `token:${token.id}`,
      kind: "token",
      label: token.name,
      meta: `${token.tenantID} • ${token.scopes.join(", ")}`,
      stats: token.active ? "Active credential" : "Inactive credential",
      x: LANE_X.token,
      y: tokenY[index] ?? sceneHeight / 2,
      tone: token.active ? "var(--success)" : "var(--muted)",
    }));

    const routeNodes: GraphNode[] = routes.map((route, index) => {
      const metrics = routeMetrics.get(route.id) || { throughput: 0, errors: 0 };
      const cbState = snapshot.data.routes.find((r) => r.id === route.id)?.circuitBreakerState;
      const cbOpen = cbState === "open" || cbState === "half_open";
      return {
        id: `route:${route.id}`,
        kind: "route",
        label: `/proxy/${route.slug}`,
        meta: `${route.tenantID} • ${route.requiredScope} • ${route.methods.join(", ")}`,
        stats: `${metrics.throughput} req • ${metrics.errors} err`,
        cbState,
        x: LANE_X.route,
        y: routeY[index] ?? sceneHeight / 2,
        tone: cbOpen ? (cbState === "open" ? "var(--danger)" : "var(--warning)") : metrics.errors > 0 ? "var(--danger)" : "var(--accent)",
      } satisfies GraphNode;
    });

    const tenantNodes: GraphNode[] = tenants.map((tenant, index) => ({
      id: `tenant:${tenant.id}`,
      kind: "tenant" as const,
      label: tenant.name,
      meta: `${tenant.tenantID} • ${tenant.authMode}`,
      stats: tenant.headerName,
      x: LANE_X.tenant,
      y: tenantY[index] ?? sceneHeight / 2,
      tone: "var(--accent)",
    }));

    // Build upstream entries. Edge goes Tenant → Upstream to show
    // that the tenant is the processing step that injects the header before forwarding.
    // When a route has LB upstreams configured, expand into one node per pool member (with weight).
    // Otherwise show a single node for the primary upstreamURL.
    type UpstreamEntry = {
      nodeId: string;
      label: string;
      meta: string;
      routeSlug: string;
      statsText: string | undefined;
      tone: string;
      fromNodeId: string;
      isDown: boolean;
      isReachable: boolean;
      upstreamURL: string;
    };
    const healthIndex = new Map<string, string>();
    for (const h of snapshot.data.upstreamHealth ?? []) {
      healthIndex.set(`${h.routeID}::${h.upstreamURL}`, h.status);
    }

    // Group LB upstreams by routeID
    const lbByRoute = new Map<string, typeof snapshot.data.routeUpstreams>();
    for (const u of snapshot.data.routeUpstreams ?? []) {
      const arr = lbByRoute.get(u.routeID) ?? [];
      arr.push(u);
      lbByRoute.set(u.routeID, arr);
    }

    function upstreamTone(routeID: string, upstreamURL: string, cbOpen: boolean) {
      const healthStatus = healthIndex.get(`${routeID}::${upstreamURL}`);
      const isDown = cbOpen || healthStatus === "down";
      const isUp = healthStatus === "up" && !cbOpen;
      return { tone: isDown ? "var(--danger)" : isUp ? "var(--success)" : "var(--muted)", isDown, healthStatus };
    }

    function upstreamStatsText(cbOpen: boolean, cbState: string | undefined, healthStatus: string | undefined, healthCheckPath: string | undefined, weightLabel?: string) {
      let s = "";
      if (cbOpen) s = `CB: ${cbState}`;
      else if (healthStatus === "up") s = "healthy";
      else if (healthStatus === "down") s = "unreachable";
      else if (healthCheckPath) s = `healthz ${healthCheckPath}`;
      if (weightLabel) s = s ? `${weightLabel} · ${s}` : weightLabel;
      return s || undefined;
    }

    const upstreamEntries: UpstreamEntry[] = [];
    for (const route of routes) {
      if (!route.upstreamURL) continue;
      const cbState = snapshot.data.routes.find((r) => r.id === route.id)?.circuitBreakerState;
      const cbOpen = cbState === "open" || cbState === "half_open";
      const owningTenant = tenants.find((t) => t.tenantID === route.tenantID);
      const fromNodeId = owningTenant ? `tenant:${owningTenant.id}` : `route:${route.id}`;
      const lbPool = lbByRoute.get(route.id);

      if (lbPool && lbPool.length > 0) {
        // Expand into one node per LB pool member
        const totalWeight = lbPool.reduce((s, u) => s + u.weight, 0) || 1;
        lbPool.forEach((u, i) => {
          const pct = Math.round((u.weight / totalWeight) * 100);
          const weightLabel = `${pct}% · w${u.weight}`;
          const { tone, isDown, healthStatus } = upstreamTone(route.id, u.upstreamURL, cbOpen);
          let urlLabel = u.upstreamURL;
          try { urlLabel = new URL(u.upstreamURL).host; } catch { /* keep full URL */ }
          upstreamEntries.push({
            nodeId: `upstream:${u.id}`,
            label: urlLabel,
            meta: `/proxy/${route.slug}`,
            routeSlug: route.slug,
            statsText: upstreamStatsText(cbOpen, cbState, healthStatus, route.healthCheckPath, weightLabel),
            tone,
            fromNodeId,
            isDown,
            isReachable: !isDown,
            upstreamURL: u.upstreamURL,
          });
        });
      } else {
        // Single primary upstream node
        const { tone, isDown, healthStatus } = upstreamTone(route.id, route.upstreamURL, cbOpen);
        let urlLabel = route.upstreamURL;
        try { urlLabel = new URL(route.upstreamURL).host; } catch { /* keep full URL */ }
        upstreamEntries.push({
          nodeId: `upstream:${route.id}`,
          label: urlLabel,
          meta: `/proxy/${route.slug}`,
          routeSlug: route.slug,
          statsText: upstreamStatsText(cbOpen, cbState, healthStatus, route.healthCheckPath),
          tone,
          fromNodeId,
          isDown,
          isReachable: !isDown,
          upstreamURL: route.upstreamURL,
        });
      }
    }

    const upstreamYArr = distributePositions(upstreamEntries.length || 1, 220, sceneHeight - 180);
    const upstreamNodes: GraphNode[] = upstreamEntries.map((entry, i) => ({
      id: entry.nodeId,
      kind: "upstream" as const,
      label: entry.label,
      meta: entry.meta,
      stats: entry.statsText,
      x: LANE_X.upstream,
      y: upstreamYArr[i] ?? sceneHeight / 2,
      tone: entry.tone,
    }));

    const allNodes = [...tokenNodes, ...routeNodes, ...tenantNodes, ...upstreamNodes];
    const tenantNodeByTenantID = new Map(tenants.map((tenant, index) => [tenant.tenantID, tenantNodes[index]]));
    const routeNodeByRouteID = new Map(routes.map((route, index) => [route.id, routeNodes[index]]));
    const hotRouteKeys = new Set(activeAudits.map((event) => `route:${event.routeSlug}:${event.tenantID}`));
    const hotTokenKeys = new Set(activeAudits.map((event) => `token:${event.tokenID}:${event.routeSlug}`));
    const tokenRouteErrorKeys = new Set(
      activeAudits
        .filter((a) => a.status >= 400)
        .map((a) => `${a.tokenID}:${a.routeSlug}:${a.tenantID}`),
    );
    // Only animate the upstream edge when the request was actually forwarded.
    // Gateway-level rejections (auth 401, IP/scope 403, CB-blocked 503, rate limit 429) never reach the upstream.
    const hotUpstreamOrigins = new Set(
      activeAudits
        .filter((e) => e.status !== 401 && e.status !== 403 && e.status !== 429 && e.status !== 503 && e.upstreamURL)
        .map((e) => {
          try { return new URL(e.upstreamURL).origin; } catch { return e.upstreamURL; }
        }),
    );

    const tokenEdges: GraphEdge[] = [];
    for (const token of tokens) {
      for (const route of routes) {
        const canAccessRoute = token.tenantID === route.tenantID && token.scopes.includes(route.requiredScope);
        if (!canAccessRoute) {
          continue;
        }
        tokenEdges.push({
          id: `edge:${token.id}:${route.id}`,
          from: `token:${token.id}`,
          to: `route:${route.id}`,
          kind: "access",
          hot: !token.active ? false : hotTokenKeys.has(`token:${token.id}:${route.slug}`),
          error: !token.active ? false : tokenRouteErrorKeys.has(`${token.id}:${route.slug}:${route.tenantID}`),
          revoked: !token.active,
          latencyMs: routeMetrics.get(route.id)?.avgLatencyMs ?? 0,
        });
      }
    }

    const tenantEdges: GraphEdge[] = routes
      .map((route) => {
        const tenant = tenants.find((item) => item.tenantID === route.tenantID);
        if (!tenant) {
          return null;
        }
        const routeHasErrors = (routeMetrics.get(route.id)?.errors ?? 0) > 0;
        const routeSummary = snapshot.data.routes.find((r) => r.id === route.id);
        return {
          id: `edge:${route.id}:${tenant.id}`,
          from: `route:${route.id}`,
          to: `tenant:${tenant.id}`,
          kind: "binding",
          hot: hotRouteKeys.has(`route:${route.slug}:${route.tenantID}`),
          error: routeHasErrors,
          latencyMs: routeMetrics.get(route.id)?.avgLatencyMs ?? 0,
          circuitBreakerState: routeSummary?.circuitBreakerState,
          circuitBreakerLocked: routeSummary?.circuitBreakerLocked,
        } satisfies GraphEdge;
      })
      .filter(Boolean) as GraphEdge[];

    const upstreamEdges: GraphEdge[] = upstreamEntries.map((entry) => {
      let upstreamOrigin = entry.upstreamURL;
      try { upstreamOrigin = new URL(entry.upstreamURL).origin; } catch { /* keep as-is */ }
      return {
        id: `edge:${entry.fromNodeId}:${entry.nodeId}`,
        from: entry.fromNodeId,
        to: entry.nodeId,
        kind: "upstream" as const,
        hot: hotUpstreamOrigins.has(upstreamOrigin),
        error: entry.isDown,
        reachable: entry.isReachable,
        label: entry.routeSlug,
      };
    });

    return {
      nodes: allNodes,
      recentAudits,
      routeNodeByRouteID,
      sceneHeight,
      tenantEdges,
      tenantNodeByTenantID,
      tokenEdges,
      upstreamEdges,
    };
  }, [snapshot]);

  useEffect(() => {
    sceneHeightRef.current = graph.sceneHeight;
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    setCamera((current) => {
      const nextCamera = fitCamera(viewport.clientWidth, viewport.clientHeight, graph.sceneHeight);
      if (
        Math.abs(current.scale - nextCamera.scale) < 0.001 &&
        Math.abs(current.x - nextCamera.x) < 0.5 &&
        Math.abs(current.y - nextCamera.y) < 0.5
      ) {
        return current;
      }

      return nextCamera;
    });

    function handleResize() {
      const activeViewport = viewportRef.current;
      if (!activeViewport) {
        return;
      }

      setCamera((current) => clampCamera(current, activeViewport.clientWidth, activeViewport.clientHeight, graph.sceneHeight));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [graph.sceneHeight]);

  // Non-passive wheel listener so event.preventDefault() actually suppresses page scroll
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      setCamera((prev) => {
        const nextScale = Math.max(SCALE_LIMITS.min, Math.min(SCALE_LIMITS.max, prev.scale - event.deltaY * 0.001));
        const sceneX = (pointerX - prev.x) / prev.scale;
        const sceneY = (pointerY - prev.y) / prev.scale;
        return clampCamera(
          { scale: nextScale, x: pointerX - sceneX * nextScale, y: pointerY - sceneY * nextScale },
          el.clientWidth,
          el.clientHeight,
          sceneHeightRef.current,
        );
      });
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []); // empty — handler reads sceneHeight via ref and camera via functional updater

  // Track browser fullscreen state changes
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const draftGraph = useMemo(() => {
    const draftNodes: GraphNode[] = [];
    const draftEdges: GraphEdge[] = [];

    if (routeDraftTenantID) {
      const tenantNode = graph.tenantNodeByTenantID.get(routeDraftTenantID);
      if (tenantNode) {
        draftNodes.push({
          id: "draft:route",
          kind: "draft",
          label: "New route",
          meta: `Linked to ${routeDraftTenantID}`,
          stats: "Pending route details",
          x: 1220,
          y: tenantNode.y,
          tone: "var(--warning)",
        });
        draftEdges.push({
          id: `draft-edge:route:${routeDraftTenantID}`,
          from: "draft:route",
          to: tenantNode.id,
          kind: "draft",
          hot: true,
          error: false,
        });
      }
    }

    if (tokenDraftTenantID) {
      const tenantNode = graph.tenantNodeByTenantID.get(tokenDraftTenantID);
      const routeNode = selectedNode?.kind === "route" && tokenDraftScopes ? graph.routeNodeByRouteID.get(selectedNode.id) : null;

      draftNodes.push({
        id: "draft:token",
        kind: "draft",
        label: "New token",
        meta: tokenDraftScopes ? `${tokenDraftTenantID} • ${tokenDraftScopes}` : `Linked to ${tokenDraftTenantID}`,
        stats: tokenDraftScopes ? "Will satisfy selected route" : "Tenant-scoped credential",
        x: 520,
        y: routeNode?.y ?? tenantNode?.y ?? graph.sceneHeight / 2,
        tone: "var(--warning)",
      });

      if (routeNode) {
        draftEdges.push({
          id: `draft-edge:token-route:${routeNode.id}`,
          from: "draft:token",
          to: routeNode.id,
          kind: "draft",
          hot: true,
          error: false,
        });
      } else if (tenantNode) {
        draftEdges.push({
          id: `draft-edge:token-tenant:${tenantNode.id}`,
          from: "draft:token",
          to: tenantNode.id,
          kind: "draft",
          hot: true,
          error: false,
        });
      }
    }

    return {
      draftEdges,
      draftNodes,
    };
  }, [graph.routeNodeByRouteID, graph.sceneHeight, graph.tenantNodeByTenantID, routeDraftTenantID, selectedNode, tokenDraftScopes, tokenDraftTenantID]);

  const selectedNodeId = selectedNode ? `${selectedNode.kind}:${selectedNode.id}` : null;

  const emphasis = useMemo(() => {
    const activeNodes = new Set<string>();
    const activeEdges = new Set<string>();

    if (selectedNodeId) {
      activeNodes.add(selectedNodeId);
      for (const edge of [...graph.tokenEdges, ...graph.tenantEdges, ...graph.upstreamEdges]) {
        if (edge.from === selectedNodeId || edge.to === selectedNodeId) {
          activeEdges.add(edge.id);
          activeNodes.add(edge.from);
          activeNodes.add(edge.to);
        }
      }
    }

    for (const node of draftGraph.draftNodes) {
      activeNodes.add(node.id);
    }
    for (const edge of draftGraph.draftEdges) {
      activeEdges.add(edge.id);
      activeNodes.add(edge.from);
      activeNodes.add(edge.to);
    }

    return {
      edges: activeEdges,
      nodes: activeNodes,
    };
  }, [draftGraph.draftEdges, draftGraph.draftNodes, graph.tenantEdges, graph.tokenEdges, graph.upstreamEdges, selectedNodeId]);

  function handleBackgroundPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }

    setSelectedCBEdge(null);
    setPendingCBAction(null);
    setSelectedTokenEdge(null);
    setPendingTokenAction(null);
    panRef.current = {
      originX: camera.x,
      originY: camera.y,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleBackgroundPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !panRef.current) {
      return;
    }

    const nextCamera = clampCamera(
      {
        ...camera,
        x: panRef.current.originX + (event.clientX - panRef.current.startX),
        y: panRef.current.originY + (event.clientY - panRef.current.startY),
      },
      viewport.clientWidth,
      viewport.clientHeight,
      graph.sceneHeight,
    );

    setCamera(nextCamera);
  }

  function handleBackgroundPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panRef.current = null;
    setIsPanning(false);
  }

  function activateConnectionMode(mode: ConnectionMode) {
    setSelectedNode(null);
    setConnectionMode(mode);
    setRouteDraftTenantID(undefined);
    setTokenDraftTenantID(undefined);
    setTokenDraftScopes(undefined);
  }

  function handleNodeSelect(node: GraphNode) {
    const [kind, id] = node.id.split(":");

    if (connectionMode?.kind === "route-from-tenant" && kind === "tenant") {
      const tenant = snapshot.data.tenants.find((item) => item.id === id);
      if (!tenant) {
        return;
      }
      setRouteDraftTenantID(tenant.tenantID);
      setIsCreateRouteOpen(true);
      setConnectionMode(null);
      return;
    }

    if (connectionMode?.kind === "token-from-tenant" && kind === "tenant") {
      const tenant = snapshot.data.tenants.find((item) => item.id === id);
      if (!tenant) {
        return;
      }
      setTokenDraftTenantID(tenant.tenantID);
      setTokenDraftScopes(undefined);
      setIsCreateTokenOpen(true);
      setConnectionMode(null);
      return;
    }

    if (connectionMode?.kind === "token-from-route" && kind === "route") {
      const route = snapshot.data.routes.find((item) => item.id === id);
      if (!route) {
        return;
      }
      setSelectedNode({ kind: "route", id: route.id });
      setTokenDraftTenantID(route.tenantID);
      setTokenDraftScopes(route.requiredScope);
      setIsCreateTokenOpen(true);
      setConnectionMode(null);
      return;
    }

    if (kind === "route" || kind === "tenant" || kind === "token") {
      setSelectedNode((current) => (current?.kind === kind && current.id === id ? null : { kind, id }));
    }
  }

  const graphEdges = [...graph.tokenEdges, ...graph.tenantEdges, ...graph.upstreamEdges, ...draftGraph.draftEdges];
  const graphNodes = [...graph.nodes, ...draftGraph.draftNodes];
  const isLive = snapshot.source === "backend";
  const modalTrigger = <span aria-hidden className="hidden" />;
  const chipLabel = streamStatus === "live"
    ? "WebSocket live"
    : streamStatus === "retrying"
      ? "Reconnecting"
      : streamStatus === "connecting"
        ? "Connecting..."
        : isLive
          ? "Snapshot live"
          : "Fallback snapshot";

  const chipClassName = streamStatus === "live"
    ? "border border-success/25 bg-success/12 text-success"
    : streamStatus === "retrying" || streamStatus === "connecting"
      ? "border border-warning/25 bg-warning/12 text-warning"
      : "border border-border bg-surface text-foreground";

  const inspectorTitle = selectedRouteForInspector
    ? selectedRouteForInspector.slug
    : selectedTenantForInspector
      ? selectedTenantForInspector.name
      : selectedTokenForInspector
        ? selectedTokenForInspector.name
        : "Nothing selected";

  const inspectorMeta = selectedRouteForInspector
    ? `${selectedRouteForInspector.tenantID} • ${selectedRouteForInspector.requiredScope}`
    : selectedTenantForInspector
      ? `${selectedTenantForInspector.tenantID} • ${selectedTenantForInspector.authMode}`
      : selectedTokenForInspector
        ? `${selectedTokenForInspector.tenantID} • ${selectedTokenForInspector.scopes.join(", ")}`
        : "Select a tenant, route, or token node to inspect its available actions and live links.";

  const connectionHelper = connectionMode?.kind === "route-from-tenant"
    ? "Click a tenant node to create a route already connected to it."
    : connectionMode?.kind === "token-from-tenant"
      ? "Click a tenant node to issue a token directly into that tenant."
      : connectionMode?.kind === "token-from-route"
        ? "Click a route node to issue a token preloaded with that route’s required scope."
        : isPanning
          ? "Dragging the graph camera."
          : "Drag the background to pan. Use the toolbar to create and connect entities directly on the map.";

  const openCircuitBreakers = snapshot.data.routes.filter((r) => r.circuitBreakerState === "open" || r.circuitBreakerState === "half_open").length;

  const summaryMetrics = [
    { label: "Tenants", value: snapshot.data.tenants.length, alert: false },
    { label: "Routes", value: snapshot.data.routes.length, alert: false },
    { label: "Active tokens", value: snapshot.data.tokens.filter((token) => token.active).length, alert: false },
    { label: "Open breakers", value: openCircuitBreakers, alert: openCircuitBreakers > 0 },
  ];

  const inspectorRows = selectedTenantForInspector
    ? [
        { label: "Tenant ID", value: selectedTenantForInspector.tenantID },
        { label: "Auth mode", value: selectedTenantForInspector.authMode },
        { label: "Header", value: selectedTenantForInspector.headerName },
      ]
    : selectedRouteForInspector
      ? [
          { label: "Tenant", value: selectedRouteForInspector.tenantID },
          { label: "Upstream", value: selectedRouteForInspector.upstreamURL },
          { label: "Scope", value: selectedRouteForInspector.requiredScope },
          { label: "Methods", value: selectedRouteForInspector.methods.join(", ") },
          { label: "Circuit breaker", value: selectedRouteForInspector.circuitBreakerState === "open" ? "Open — traffic blocked" : selectedRouteForInspector.circuitBreakerState === "half_open" ? "Half-open — probing" : "Closed — healthy" },
        ]
      : selectedTokenForInspector
        ? [
            { label: "Tenant", value: selectedTokenForInspector.tenantID },
            { label: "Scopes", value: selectedTokenForInspector.scopes.join(", ") },
            { label: "Preview", value: selectedTokenForInspector.preview },
          ]
        : [];

  return (
    <div className="space-y-6">
      <Surface className="overflow-hidden rounded-[28px] border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="enterprise-kicker">Topology workspace</div>
            <h2 className="mt-2 text-[1.85rem] font-semibold tracking-[-0.045em] text-foreground">Interactive tenant network</h2>
            <p className="mt-2.5 max-w-3xl text-sm leading-6 text-muted-foreground">
              Move around the graph with the mouse, inspect live connections, and create tenants, routes, or tokens directly in the network instead of leaving the workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Chip className={chipClassName}>{chipLabel}</Chip>
            <Button className="h-9 rounded-full px-3" isDisabled={isRefreshing} size="sm" variant="ghost" onPress={() => void pollTopology()}>
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={() => {
              const viewport = viewportRef.current;
              if (!viewport) {
                return;
              }
              setCamera(fitCamera(viewport.clientWidth, viewport.clientHeight, graph.sceneHeight));
            }}>
              <LocateFixed size={14} />
              Fit view
            </Button>
            <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryMetrics.map((metric) => (
            <div key={metric.label} className={`enterprise-panel px-4 py-3 ${metric.alert ? "border-danger/30 bg-danger/5" : ""}`}>
              <div className={`enterprise-kicker ${metric.alert ? "text-danger" : ""}`}>{metric.label}</div>
              <div className={`mt-1 text-[1.6rem] font-semibold tracking-[-0.05em] ${metric.alert ? "text-danger" : "text-foreground"}`}>{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="h-10 rounded-full px-4" isDisabled={snapshot.source !== "backend"} variant="outline" onPress={() => {
            clearConnectionMode();
            setIsCreateTenantOpen(true);
          }}>
            <Plus size={14} />
            New tenant
          </Button>
          <Button className={connectionMode?.kind === "route-from-tenant" ? "h-10 rounded-full border border-warning/30 bg-warning/12 px-4 text-warning" : "h-10 rounded-full px-4"} isDisabled={snapshot.source !== "backend"} variant="ghost" onPress={() => {
            if (connectionMode?.kind === "route-from-tenant") {
              clearConnectionMode();
              return;
            }
            activateConnectionMode({ kind: "route-from-tenant" });
          }}>
            <Route size={14} />
            Route to tenant
          </Button>
          <Button className={connectionMode?.kind === "token-from-tenant" ? "h-10 rounded-full border border-warning/30 bg-warning/12 px-4 text-warning" : "h-10 rounded-full px-4"} isDisabled={snapshot.source !== "backend"} variant="ghost" onPress={() => {
            if (connectionMode?.kind === "token-from-tenant") {
              clearConnectionMode();
              return;
            }
            activateConnectionMode({ kind: "token-from-tenant" });
          }}>
            <KeyRound size={14} />
            Token to tenant
          </Button>
          <Button className={connectionMode?.kind === "token-from-route" ? "h-10 rounded-full border border-warning/30 bg-warning/12 px-4 text-warning" : "h-10 rounded-full px-4"} isDisabled={snapshot.source !== "backend"} variant="ghost" onPress={() => {
            if (connectionMode?.kind === "token-from-route") {
              clearConnectionMode();
              return;
            }
            activateConnectionMode({ kind: "token-from-route" });
          }}>
            <Sparkles size={14} />
            Token to route
          </Button>
        </div>

        <div ref={fullscreenContainerRef} className={`topology-stage relative mt-5 overflow-hidden rounded-[24px] border border-border p-4 ${isFullscreen ? "!mt-0 !rounded-none !border-0" : ""}`}>
          <div
            ref={viewportRef}
            className={`relative overflow-hidden rounded-[20px] border border-border/80 bg-background/42 ${isPanning ? "cursor-grabbing" : "cursor-grab"} ${isFullscreen ? "min-h-screen !rounded-none !border-0" : "min-h-[680px]"}`}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handleBackgroundPointerMove}
            onPointerUp={handleBackgroundPointerEnd}
            onPointerCancel={handleBackgroundPointerEnd}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                height: graph.sceneHeight,
                transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
                width: SCENE_WIDTH,
              }}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[90px] top-[54px] text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tokens</div>
                <div className="absolute left-[770px] top-[54px] text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Routes</div>
                <div className="absolute left-[1450px] top-[54px] text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tenants</div>
                <div className="absolute left-[1970px] top-[54px] text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Upstream</div>
              </div>

              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${SCENE_WIDTH} ${graph.sceneHeight}`}>
                <defs>
                  <filter id="topology-packet-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {graphEdges.map((edge) => {
                  const from = graphNodes.find((node) => node.id === edge.from);
                  const to = graphNodes.find((node) => node.id === edge.to);
                  if (!from || !to) {
                    return null;
                  }

                  const active = emphasis.nodes.size === 0 || emphasis.edges.has(edge.id) || emphasis.nodes.has(edge.from) || emphasis.nodes.has(edge.to);
                  const d = pathBetween(from, to);
                  const mid = bezierMidpoint(from, to);
                  const isSelected = (selectedCBEdge?.sceneX === mid.x && selectedCBEdge?.sceneY === mid.y) ||
                    (selectedTokenEdge?.sceneX === mid.x && selectedTokenEdge?.sceneY === mid.y);
                  const className = edge.kind === "draft"
                    ? "topology-flow-line topology-flow-line--draft"
                    : edge.revoked
                      ? "topology-flow-line topology-flow-line--revoked"
                      : edge.error
                        ? "topology-flow-line topology-flow-line--error"
                        : edge.hot
                          ? "topology-flow-line topology-flow-line--hot"
                          : edge.reachable
                            ? "topology-flow-line topology-flow-line--reachable"
                            : "topology-flow-line";
                  const glowClass = edge.revoked
                    ? "topology-flow-line topology-flow-line--glow-revoked"
                    : edge.error
                      ? "topology-flow-line topology-flow-line--glow-error"
                      : edge.reachable
                        ? "topology-flow-line topology-flow-line--glow-reachable"
                        : "topology-flow-line topology-flow-line--glow";
                  const packetColor = edge.error ? "var(--danger)" : (edge.kind === "binding" || edge.kind === "upstream") ? "var(--success)" : "var(--accent)";
                  const packetDur = latencyToDuration(edge.latencyMs ?? 0);
                  const packetBegin1 = `${(parseFloat(packetDur) / 3).toFixed(2)}s`;
                  const packetBegin2 = `${((parseFloat(packetDur) / 3) * 2).toFixed(2)}s`;
                  const cbState = edge.circuitBreakerState ?? "closed";
                  // Show CB badge only when breaker is actively open/half-open
                  const cbBadgePos = (cbState === "open" || cbState === "half_open") ? bezierMidpoint(from, to) : null;
                  // binding edges (route→tenant) and access edges (token→route) are both interactive
                  const isBinding = edge.kind === "binding";
                  const isAccess = edge.kind === "access";
                  const midpoint = (isBinding || isAccess) ? mid : null;

                  function openEdgePanel(e: React.MouseEvent) {
                    e.stopPropagation();
                    if (!midpoint) return;
                    if (isBinding) {
                      const routeID = from!.id.startsWith("route:") ? from!.id.slice("route:".length) : from!.id;
                      setSelectedTokenEdge(null);
                      setPendingTokenAction(null);
                      setSelectedCBEdge((prev) =>
                        prev?.sceneX === midpoint.x && prev?.sceneY === midpoint.y
                          ? (setPendingCBAction(null), null)
                          : { routeID, routeLabel: from!.label, tenantLabel: to!.label, state: cbState, locked: edge.circuitBreakerLocked ?? false, latencyMs: edge.latencyMs ?? 0, sceneX: midpoint.x, sceneY: midpoint.y }
                      );
                      setPendingCBAction(null);
                    } else if (isAccess) {
                      const tokenID = from!.id.startsWith("token:") ? from!.id.slice("token:".length) : from!.id;
                      const routeID = to!.id.startsWith("route:") ? to!.id.slice("route:".length) : to!.id;
                      setSelectedCBEdge(null);
                      setPendingCBAction(null);
                      setSelectedTokenEdge((prev) =>
                        prev?.sceneX === midpoint.x && prev?.sceneY === midpoint.y
                          ? (setPendingTokenAction(null), null)
                          : { tokenID, routeID, tokenLabel: from!.label, routeLabel: to!.label, sceneX: midpoint.x, sceneY: midpoint.y }
                      );
                      setPendingTokenAction(null);
                    }
                  }

                  return (
                    <g key={edge.id} opacity={active ? 1 : 0.12}>
                      <path className={glowClass} d={d} vectorEffect="non-scaling-stroke" />
                      <path className={className} d={d} vectorEffect="non-scaling-stroke"
                        style={isSelected ? { stroke: "var(--accent)", opacity: 0.6 } : undefined}
                      />
                      {/* Wide invisible hit area for interactive edges */}
                      {(isBinding || isAccess) && (
                        <path
                          d={d}
                          stroke="transparent"
                          strokeWidth="24"
                          fill="none"
                          vectorEffect="non-scaling-stroke"
                          style={{ pointerEvents: "stroke", cursor: "pointer" }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={openEdgePanel}
                        />
                      )}
                      {edge.hot && edge.kind !== "draft" && (
                        <>
                          <circle r="5" fill={packetColor} opacity="0.9" filter="url(#topology-packet-glow)">
                            <animateMotion dur={packetDur} repeatCount="indefinite" path={d} />
                          </circle>
                          <circle r="5" fill={packetColor} opacity="0.9" filter="url(#topology-packet-glow)">
                            <animateMotion dur={packetDur} begin={packetBegin1} repeatCount="indefinite" path={d} />
                          </circle>
                          <circle r="5" fill={packetColor} opacity="0.9" filter="url(#topology-packet-glow)">
                            <animateMotion dur={packetDur} begin={packetBegin2} repeatCount="indefinite" path={d} />
                          </circle>
                        </>
                      )}
                      {edge.kind === "upstream" && edge.label && (() => {
                        const labelMid = bezierMidpoint(from, to);
                        const textW = Math.min(edge.label.length * 6.5 + 14, 140);
                        return (
                          <g transform={`translate(${labelMid.x}, ${labelMid.y - 14})`} opacity={0.82}>
                            <rect x={-textW / 2} y="-9" width={textW} height="16" rx="5"
                              fill="var(--overlay)" stroke="var(--border)" strokeWidth="0.8" />
                            <text x="0" y="4" textAnchor="middle" fontSize="8.5"
                              fontFamily="monospace" fontWeight="500" fill="var(--muted-foreground)">
                              {edge.label.length > 18 ? `${edge.label.slice(0, 17)}…` : edge.label}
                            </text>
                          </g>
                        );
                      })()}
                      {cbBadgePos && (
                        <g
                          transform={`translate(${cbBadgePos.x}, ${cbBadgePos.y})`}
                          style={{ pointerEvents: "all", cursor: "pointer" }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={openEdgePanel}
                        >
                          {/* Enlarged invisible hit area */}
                          <rect x="-32" y="-18" width="64" height="36" fill="transparent" />
                          <rect x="-22" y="-10" width="44" height="20" rx="6"
                            fill={cbState === "open" ? "var(--danger)" : "var(--warning)"}
                            opacity="0.92"
                            className={cbState === "open" ? "topology-cb-open-flash" : ""}
                          />
                          <text x="0" y="4" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" letterSpacing="0.05em">
                            {cbState === "open" ? "OPEN" : "½ OPEN"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {graphNodes.map((node) => {
                const selected = selectedNodeId === node.id;
                const active = emphasis.nodes.size === 0 || emphasis.nodes.has(node.id);
                const badge = node.kind === "tenant" ? "Tenant" : node.kind === "route" ? "Route" : node.kind === "token" ? "Token" : node.kind === "upstream" ? "Upstream" : "Draft";
                const showPulse = (node.kind === "tenant" || node.kind === "upstream") && node.tone !== "var(--muted)";
                const pulseHealth = node.tone === "var(--success)" ? "up" : node.tone === "var(--danger)" ? "down" : "unknown";

                return (
                  <button
                    key={node.id}
                    className="absolute rounded-[20px] border text-left transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      left: node.x,
                      opacity: active ? 1 : 0.26,
                      top: node.y,
                      transform: "translate(-50%, -50%)",
                      width: 270,
                      background: selected
                        ? "color-mix(in oklab, var(--panel) 88%, var(--surface))"
                        : node.kind === "draft"
                          ? "color-mix(in oklab, var(--warning) 7%, var(--surface))"
                          : "color-mix(in oklab, var(--surface) 88%, white 12%)",
                      borderColor: selected ? "color-mix(in oklab, var(--foreground) 18%, var(--border))" : "color-mix(in oklab, var(--border) 82%, white 18%)",
                      boxShadow: selected
                        ? "0 12px 26px -22px color-mix(in oklab, var(--foreground) 18%, transparent)"
                        : node.kind === "draft"
                          ? "0 10px 22px -18px color-mix(in oklab, var(--warning) 22%, transparent)"
                          : "0 10px 24px -20px color-mix(in oklab, var(--foreground) 18%, transparent)",
                      backdropFilter: "blur(14px)",
                    }}
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => handleNodeSelect(node)}
                  >
                    {showPulse && (
                      <div
                        className="topology-health-pulse pointer-events-none absolute rounded-[20px]"
                        data-health={pulseHealth}
                        style={{ inset: "-6px" }}
                      />
                    )}
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{badge}</span>
                        <span className="h-3 w-3 rounded-full" style={{ background: node.tone, boxShadow: edgeGlow(node.tone) }} />
                      </div>
                      <div className="mt-2.5 text-sm font-semibold leading-5 text-foreground">{node.label}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{node.meta}</div>
                      {node.stats ? <div className="mt-2.5 text-[11px] font-medium text-foreground/80">{node.stats}</div> : null}
                      {node.cbState && node.cbState !== "closed" && (
                        <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${node.cbState === "open" ? "bg-danger/12 text-danger topology-cb-open-flash" : "bg-warning/12 text-warning"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${node.cbState === "open" ? "bg-danger" : "bg-warning"}`} />
                          {node.cbState === "open" ? "CB Open" : "CB ½ Open"}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mini-map */}
            <div
              className="absolute bottom-[60px] right-4 overflow-hidden rounded-xl border border-border/70 bg-surface/85 backdrop-blur-sm"
              style={{ width: 176, height: 110, pointerEvents: "none" }}
            >
              <svg
                width="176"
                height="110"
                viewBox={`0 0 ${SCENE_WIDTH} ${graph.sceneHeight}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {graphEdges.map((edge) => {
                  const from = graphNodes.find((n) => n.id === edge.from);
                  const to = graphNodes.find((n) => n.id === edge.to);
                  if (!from || !to) return null;
                  const stroke = edge.error ? "var(--danger)" : edge.hot ? "var(--accent)" : edge.reachable ? "var(--success)" : "var(--border)";
                  return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={stroke} strokeOpacity="0.5" strokeWidth="12" />;
                })}
                {graphNodes.map((node) => (
                  <circle key={node.id} cx={node.x} cy={node.y} r="28" fill={node.tone} opacity="0.8" />
                ))}
                {/* Viewport indicator */}
                <rect
                  x={Math.max(0, -camera.x / camera.scale)}
                  y={Math.max(0, -camera.y / camera.scale)}
                  width={Math.min(SCENE_WIDTH, (viewportRef.current?.clientWidth ?? 800) / camera.scale)}
                  height={Math.min(graph.sceneHeight, (viewportRef.current?.clientHeight ?? 600) / camera.scale)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="18"
                  rx="20"
                  opacity="0.7"
                />
              </svg>
              <div className="absolute bottom-1 left-2 text-[8px] font-medium uppercase tracking-wider text-muted-foreground/60">Map</div>
            </div>

            {/* ── Edge popover (route → tenant) ────────────────────── */}
            {selectedCBEdge && (() => {
              const cbState = selectedCBEdge.state;
              const isClosed = cbState === "closed";
              const isOpen = cbState === "open";
              const vpX = selectedCBEdge.sceneX * camera.scale + camera.x;
              const vpY = selectedCBEdge.sceneY * camera.scale + camera.y;
              const vw = viewportRef.current?.clientWidth ?? 700;
              const vh = viewportRef.current?.clientHeight ?? 500;
              const panelW = 312;
              const panelH = isClosed ? 220 : 330;
              const left = Math.min(Math.max(vpX - panelW / 2, 8), vw - panelW - 8);
              const top = vpY - panelH - 20 < 8 ? vpY + 24 : vpY - panelH - 20;

              const accentColor = isClosed ? "var(--border)" : isOpen ? "var(--danger)" : "var(--warning)";
              const accentBg = isClosed
                ? "color-mix(in oklab, var(--success) 6%, var(--surface))"
                : isOpen
                  ? "color-mix(in oklab, var(--danger) 8%, var(--surface))"
                  : "color-mix(in oklab, var(--warning) 8%, var(--surface))";

              async function execForceState(state: string) {
                setIsForcingCB(true);
                try {
                  await fetch(`/api/admin/circuit-breakers/${selectedCBEdge!.routeID}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ state }),
                  });
                  setPendingCBAction(null);
                  setSelectedCBEdge(null);
                  void pollTopology();
                } finally {
                  setIsForcingCB(false);
                }
              }

              const selectedRouteData = snapshot.data.routes.find((r) => r.id === selectedCBEdge.routeID);

              return (
                <div
                  className="absolute z-50 overflow-hidden rounded-[16px] border bg-surface shadow-2xl"
                  style={{
                    left,
                    top: Math.min(Math.max(top, 8), vh - panelH - 8),
                    width: panelW,
                    borderColor: accentColor,
                    boxShadow: `0 12px 32px -8px color-mix(in oklab, ${accentColor} 22%, transparent)`,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: accentBg }}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${isOpen ? "topology-cb-open-flash" : ""}`}
                        style={{ background: isClosed ? "var(--success)" : isOpen ? "var(--danger)" : "var(--warning)" }}
                      />
                      <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${isClosed ? "text-success" : isOpen ? "text-danger" : "text-warning"}`}>
                        {isClosed ? "Route binding" : isOpen ? `Circuit Breaker — Open${selectedCBEdge.locked ? " (locked)" : ""}` : "Circuit Breaker — Half Open"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => { setSelectedCBEdge(null); setPendingCBAction(null); }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="space-y-3 px-4 py-3 text-xs">
                    {/* Route / Tenant / Latency */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[8px] bg-panel px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Route</div>
                        <div className="mt-0.5 truncate font-mono text-foreground">{selectedCBEdge.routeLabel}</div>
                      </div>
                      <div className="rounded-[8px] bg-panel px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tenant</div>
                        <div className="mt-0.5 truncate font-mono text-foreground">{selectedCBEdge.tenantLabel}</div>
                      </div>
                    </div>

                    {/* Route metadata */}
                    {selectedRouteData && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRouteData.methods.map((m) => (
                          <span key={m} className="rounded-md bg-panel border border-border/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">{m}</span>
                        ))}
                        {selectedRouteData.requiredScope && (
                          <span className="rounded-md bg-panel border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">scope: {selectedRouteData.requiredScope}</span>
                        )}
                        {selectedCBEdge.latencyMs > 0 && (
                          <span className="rounded-md bg-panel border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">~{selectedCBEdge.latencyMs}ms</span>
                        )}
                      </div>
                    )}

                    {/* State description — only for non-closed breakers */}
                    {!isClosed && (
                      <div className="space-y-1.5 leading-[1.55] text-muted-foreground">
                        {isOpen ? (
                          <>
                            <p><span className="font-semibold text-danger">Traffic is blocked.</span> {selectedCBEdge.locked ? "This breaker was manually locked open and will not recover automatically." : "JustGate detected 5 or more consecutive upstream failures and stopped forwarding requests to protect against cascading errors."}</p>
                            {!selectedCBEdge.locked && <p>The breaker will automatically allow a single <span className="font-medium text-foreground">trial request</span> after ~30 seconds to probe upstream recovery.</p>}
                          </>
                        ) : (
                          <>
                            <p><span className="font-semibold text-warning">Probing upstream.</span> One trial request is being allowed through to check if the upstream has recovered.</p>
                            <p>A <span className="font-medium text-success">successful response</span> closes the circuit. Another <span className="font-medium text-danger">failure</span> re-opens it for 30 seconds.</p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Actions — two-step inline confirm for destructive changes */}
                    {pendingCBAction ? (
                      <div className="space-y-2.5 rounded-[10px] border border-border bg-panel p-3">
                        <p className="text-[11px] leading-[1.5] text-muted-foreground">
                          {pendingCBAction === "open"
                            ? <>Manually <span className="font-semibold text-danger">opening the circuit breaker</span> will immediately stop all traffic to <span className="font-medium text-foreground">{selectedCBEdge.routeLabel}</span>. The breaker will be <span className="font-semibold">locked open</span> and will not recover automatically — you must close it manually.</>
                            : <>Manually <span className="font-semibold text-success">closing the circuit breaker</span> will resume traffic to <span className="font-medium text-foreground">{selectedCBEdge.routeLabel}</span>. The lock is released and failures will re-open it automatically.</>
                          }
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-opacity hover:opacity-80"
                            onClick={() => setPendingCBAction(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isForcingCB}
                            className={`flex-1 rounded-[8px] border px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 ${
                              pendingCBAction === "open"
                                ? "border-danger/30 bg-danger/10 text-danger"
                                : "border-success/30 bg-success/10 text-success"
                            }`}
                            onClick={() => void execForceState(pendingCBAction === "open" ? "open" : "closed")}
                          >
                            {isForcingCB ? "Applying…" : "Confirm"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-[8px] border border-border bg-panel px-3 py-1.5 text-[11px] font-semibold text-foreground transition-opacity hover:opacity-80"
                          onClick={() => {
                            setSelectedCBEdge(null);
                            setEditingRouteID(selectedCBEdge.routeID);
                          }}
                        >
                          Edit route
                        </button>
                        {!isClosed && (
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-success/30 bg-success/10 px-3 py-1.5 text-[11px] font-semibold text-success transition-opacity hover:opacity-80"
                            onClick={() => setPendingCBAction("close")}
                          >
                            Close circuit breaker
                          </button>
                        )}
                        {isClosed && (
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-danger/30 bg-danger/10 px-3 py-1.5 text-[11px] font-semibold text-danger transition-opacity hover:opacity-80"
                            onClick={() => setPendingCBAction("open")}
                          >
                            Open circuit breaker
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Token edge popover (token → route) ──────────────── */}
            {selectedTokenEdge && (() => {
              const tokenData = snapshot.data.tokens.find((t) => t.id === selectedTokenEdge.tokenID);
              const isActive = tokenData?.active ?? true;
              const vpX = selectedTokenEdge.sceneX * camera.scale + camera.x;
              const vpY = selectedTokenEdge.sceneY * camera.scale + camera.y;
              const vw = viewportRef.current?.clientWidth ?? 700;
              const vh = viewportRef.current?.clientHeight ?? 500;
              const panelW = 312;
              const panelH = 240;
              const left = Math.min(Math.max(vpX - panelW / 2, 8), vw - panelW - 8);
              const top = vpY - panelH - 20 < 8 ? vpY + 24 : vpY - panelH - 20;

              async function execTokenAction(action: "revoke" | "reactivate") {
                setIsActingOnToken(true);
                try {
                  await fetch(`/api/admin/tokens/${selectedTokenEdge!.tokenID}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ active: action === "reactivate" }),
                  });
                  setPendingTokenAction(null);
                  setSelectedTokenEdge(null);
                  void pollTopology();
                } finally {
                  setIsActingOnToken(false);
                }
              }

              return (
                <div
                  className="absolute z-50 overflow-hidden rounded-[16px] border border-border bg-surface shadow-2xl"
                  style={{
                    left,
                    top: Math.min(Math.max(top, 8), vh - panelH - 8),
                    width: panelW,
                    boxShadow: isActive
                      ? "0 12px 32px -8px color-mix(in oklab, var(--accent) 16%, transparent)"
                      : "0 12px 32px -8px color-mix(in oklab, var(--muted) 16%, transparent)",
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: isActive ? "color-mix(in oklab, var(--accent) 6%, var(--surface))" : "color-mix(in oklab, var(--muted) 6%, var(--surface))" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: isActive ? "var(--accent)" : "var(--muted-foreground)" }} />
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                        Token access
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => { setSelectedTokenEdge(null); setPendingTokenAction(null); }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="space-y-3 px-4 py-3 text-xs">
                    {/* Token / Route */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[8px] bg-panel px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Token</div>
                        <div className="mt-0.5 truncate font-semibold text-foreground">{selectedTokenEdge.tokenLabel}</div>
                        {tokenData && (
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{tokenData.preview}</div>
                        )}
                      </div>
                      <div className="rounded-[8px] bg-panel px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Route</div>
                        <div className="mt-0.5 truncate font-mono text-foreground">{selectedTokenEdge.routeLabel}</div>
                        {tokenData && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground/70">scope: {tokenData.scopes.join(", ")}</div>
                        )}
                      </div>
                    </div>

                    {/* Status pills */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "border-success/30 bg-success/10 text-success" : "border-border bg-panel text-muted-foreground line-through"}`}>
                        {isActive ? "Active" : "Revoked"}
                      </span>
                      {tokenData?.expiresAt && new Date(tokenData.expiresAt).getFullYear() < 9999 && (
                        <span className="rounded-md border border-border bg-panel px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          expires {new Date(tokenData.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {tokenData?.lastUsedAt && tokenData.lastUsedAt !== "0001-01-01T00:00:00Z" && (
                        <span className="rounded-md border border-border bg-panel px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          last used {new Date(tokenData.lastUsedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Inline confirm or action buttons */}
                    {pendingTokenAction ? (
                      <div className="space-y-2.5 rounded-[10px] border border-border bg-panel p-3">
                        <p className="text-[11px] leading-[1.5] text-muted-foreground">
                          {pendingTokenAction === "revoke"
                            ? <><span className="font-semibold text-warning">Revoking this token</span> stops all access immediately. Any service using it will receive 401 errors. This cannot be undone.</>
                            : <><span className="font-semibold text-success">Re-activating this token</span> restores access for <span className="font-medium text-foreground">{selectedTokenEdge.tokenLabel}</span>.</>
                          }
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-opacity hover:opacity-80"
                            onClick={() => setPendingTokenAction(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isActingOnToken}
                            className={`flex-1 rounded-[8px] border px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 ${
                              pendingTokenAction === "revoke"
                                ? "border-warning/30 bg-warning/10 text-warning"
                                : "border-success/30 bg-success/10 text-success"
                            }`}
                            onClick={() => void execTokenAction(pendingTokenAction)}
                          >
                            {isActingOnToken ? "Applying…" : "Confirm"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-[8px] border border-border bg-panel px-3 py-1.5 text-[11px] font-semibold text-foreground transition-opacity hover:opacity-80"
                          onClick={() => {
                            setSelectedTokenEdge(null);
                            setSelectedNode({ kind: "token", id: selectedTokenEdge.tokenID });
                          }}
                        >
                          Inspect token
                        </button>
                        {isActive ? (
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-warning/30 bg-warning/10 px-3 py-1.5 text-[11px] font-semibold text-warning transition-opacity hover:opacity-80"
                            onClick={() => setPendingTokenAction("revoke")}
                          >
                            Revoke token
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-success/30 bg-success/10 px-3 py-1.5 text-[11px] font-semibold text-success transition-opacity hover:opacity-80"
                            onClick={() => setPendingTokenAction("reactivate")}
                          >
                            Re-activate token
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-surface/88 px-4 py-2.5 text-[11px] text-muted-foreground backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Move size={14} />
                {connectionHelper}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-background/75 px-3 py-1">Wheel to zoom</span>
                <span className="rounded-full border border-border bg-background/75 px-3 py-1">Current zoom {Math.round(camera.scale * 100)}%</span>
                <span className="rounded-full border border-border bg-background/75 px-3 py-1">Click any line to inspect or act on it</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_300px]">
          <Surface className="rounded-[22px] border border-border bg-surface/90 p-5 shadow-none xl:col-span-2">
            <div className="enterprise-kicker">Inspector</div>
            <div className="mt-2 text-lg font-semibold text-foreground">{inspectorTitle}</div>
            <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{inspectorMeta}</div>
            {inspectorRows.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {inspectorRows.map((row) => (
                  <div key={row.label} className="enterprise-panel px-4 py-3">
                    <div className="enterprise-kicker">{row.label}</div>
                    <div className="mt-1 text-sm font-semibold text-foreground break-words">{row.value}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedTenantForInspector ? (
                <>
                  <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={() => setEditingTenantID(selectedTenantForInspector.id)}>Edit tenant</Button>
                  <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={() => {
                    clearConnectionMode();
                    setRouteDraftTenantID(selectedTenantForInspector.tenantID);
                    setIsCreateRouteOpen(true);
                  }}>New route</Button>
                  <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={() => {
                    clearConnectionMode();
                    setTokenDraftTenantID(selectedTenantForInspector.tenantID);
                    setTokenDraftScopes(undefined);
                    setIsCreateTokenOpen(true);
                  }}>Issue token</Button>
                </>
              ) : null}
              {selectedRouteForInspector ? (
                <>
                  <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={() => setEditingRouteID(selectedRouteForInspector.id)}>Edit route</Button>
                  <Button className="h-9 rounded-full px-3" size="sm" variant="ghost" onPress={() => {
                    clearConnectionMode();
                    setTokenDraftTenantID(selectedRouteForInspector.tenantID);
                    setTokenDraftScopes(selectedRouteForInspector.requiredScope);
                    setIsCreateTokenOpen(true);
                  }}>Issue token for route</Button>
                </>
              ) : null}
              {selectedTokenForInspector ? <Chip className="bg-background text-foreground ring-1 ring-border">Preview {selectedTokenForInspector.preview}</Chip> : null}
            </div>
            {selectedTokenForInspector && (
              <div className="mt-4 rounded-xl border border-border bg-background/60">
                <div className="border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Usage (24h)
                </div>
                <TokenStatsPanel tokenID={selectedTokenForInspector.id} />
              </div>
            )}
          </Surface>

          <Surface className="surface-card-muted rounded-[22px] border-0 p-5 shadow-none">
            <div className="enterprise-kicker">Graph stats</div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground">{snapshot.data.tenants.length}</div>
                <div className="text-[13px] text-muted-foreground">tenants in the workspace</div>
              </div>
              <div>
                <div className="text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground">{snapshot.data.routes.length}</div>
                <div className="text-[13px] text-muted-foreground">routes connected across tenants</div>
              </div>
              <div>
                <div className="text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground">{snapshot.data.tokens.filter((token) => token.active).length}</div>
                <div className="text-[13px] text-muted-foreground">active tokens represented live</div>
              </div>
            </div>
          </Surface>
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-3">
        <Surface className="col-span-2 rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Activity size={14} />
            Recent Flow activity
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {graph.recentAudits.length === 0 ? (
              <div className="col-span-full rounded-[24px] border border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                No recent audit traffic has been recorded yet.
              </div>
            ) : (
              graph.recentAudits.slice(0, 4).map((event) => (
                <Card key={event.id} className="rounded-[18px] border border-border bg-background shadow-none">
                  <Card.Content className="space-y-2.5 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">/{event.routeSlug}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</div>
                      </div>
                      <Chip className={event.status < 400 ? "border border-success/25 bg-success/12 text-success" : event.status < 500 ? "border border-warning/25 bg-warning/12 text-warning" : "border border-danger/25 bg-danger/12 text-danger"}>{event.status}</Chip>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border bg-surface px-2 py-1">{event.tokenID}</span>
                      <ArrowRight size={12} />
                      <span className="rounded-full border border-border bg-surface px-2 py-1">{event.tenantID}</span>
                    </div>
                  </Card.Content>
                </Card>
              ))
            )}
          </div>
        </Surface>

        <Surface className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="enterprise-kicker">Workspace hints</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <div>Use the mouse to pan the scene and the wheel to zoom into a dense section.</div>
            <div>Route to tenant asks you to click a tenant node, then opens a route modal already bound to that tenant.</div>
            <div>Token to route asks you to click a route node, then opens a token modal preloaded with the route scope and tenant.</div>
          </div>
        </Surface>
      </div>

      <CreateTenantForm
        disabled={snapshot.source !== "backend"}
        existingCount={snapshot.data.tenants.length}
        isOpen={isCreateTenantOpen}
        onCreated={() => {
          handleTopologyChanged();
        }}
        onOpenChange={(open) => {
          setIsCreateTenantOpen(open);
        }}
        trigger={modalTrigger}
      />

      <CreateRouteForm
        disabled={snapshot.source !== "backend"}
        existingCount={snapshot.data.routes.length}
        initialTenantID={routeDraftTenantID}
        isOpen={isCreateRouteOpen}
        onCreated={() => {
          clearConnectionMode();
          handleTopologyChanged();
        }}
        onOpenChange={(open) => {
          setIsCreateRouteOpen(open);
          if (!open) {
            clearConnectionMode();
          }
        }}
        tenants={routeTenants}
        trigger={modalTrigger}
      />

      <CreateTokenForm
        disabled={snapshot.source !== "backend"}
        existingCount={snapshot.data.tokens.length}
        initialScopes={tokenDraftScopes}
        initialTenantID={tokenDraftTenantID}
        isOpen={isCreateTokenOpen}
        onCreated={() => {
          clearConnectionMode();
          handleTopologyChanged();
        }}
        onOpenChange={(open) => {
          setIsCreateTokenOpen(open);
          if (!open) {
            clearConnectionMode();
          }
        }}
        tenantIDs={routeTenantIDs}
        trigger={modalTrigger}
      />

      {selectedRoute ? (
        <UpdateRouteForm
          key={`${selectedRoute.id}:${selectedRoute.slug}:${selectedRoute.tenantID}:${selectedRoute.targetPath}:${selectedRoute.requiredScope}:${selectedRoute.methods.join(",")}`}
          disabled={snapshot.source !== "backend"}
          isOpen={Boolean(selectedRoute)}
          label="Edit"
          onOpenChange={(open) => {
            if (!open) {
              setEditingRouteID(undefined);
            }
          }}
          route={selectedRoute}
          tenants={routeTenants}
          trigger={modalTrigger}
        />
      ) : null}

      {selectedTenant ? (
        <UpdateTenantForm
          key={`${selectedTenant.id}:${selectedTenant.tenantID}:${selectedTenant.headerName}:${selectedTenant.name}`}
          disabled={snapshot.source !== "backend"}
          isOpen={Boolean(selectedTenant)}
          label="Edit"
          onOpenChange={(open) => {
            if (!open) {
              setEditingTenantID(undefined);
            }
          }}
          tenant={selectedTenant}
          trigger={modalTrigger}
        />
      ) : null}
    </div>
  );
}
