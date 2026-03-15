import { getAdminRequestHeaders, getBackendBaseUrl } from "@/lib/backend-server";
import {
    fallbackOverview,
    fallbackRoutes,
    fallbackTenants,
    fallbackTokens,
    type AdminOverview,
    type AdminSession,
    type AppSession,
    type AppToken,
    type AuditEvent,
    type CircuitBreakerStatus,
    type ExpiringToken,
    type HealthHistoryEntry,
    type MemberSummary,
    type OIDCConfig,
    type OIDCOrgMapping,
    type OrgAdminSummary,
    type OrgSummary,
    type PaginatedAdminAuditResponse,
    type PaginatedAuditResponse,
    type PlatformAdminSummary,
    type ProtectedApp,
    type QueryResult,
    type ReplicaInfo,
    type RouteSummary,
    type SearchResults,
    type TenantSummary,
    type TenantUpstream,
    type TokenSummary,
    type TopologySnapshot,
    type TrafficOverview,
    type TrafficStat,
    type UserAdminSummary
} from "@/lib/contracts";

const backendUrl = getBackendBaseUrl();

async function fetchBackend<T>(path: string, fallback: T): Promise<QueryResult<T>> {
  try {
    const headers = await getAdminRequestHeaders();

    const response = await fetch(`${backendUrl}${path}`, {
      cache: "no-store",
      headers,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) detail = `: ${body.error}`;
      } catch { /* ignore */ }
      throw new Error(`backend returned ${response.status}${detail}`);
    }

    const data = (await response.json()) as T;
    return {
      data,
      source: "backend",
      backendUrl,
    };
  } catch (error) {
    return {
      data: fallback,
      source: "fallback",
      backendUrl,
      error: error instanceof Error ? error.message : "unknown backend error",
    };
  }
}

export function getOverview() {
  return fetchBackend<AdminOverview>("/api/v1/admin/overview", fallbackOverview);
}

export function getRoutes() {
  return fetchBackend<RouteSummary[]>("/api/v1/admin/routes", fallbackRoutes);
}

export function getTenants() {
  return fetchBackend<TenantSummary[]>("/api/v1/admin/tenants", fallbackTenants);
}

export function getTokens() {
  return fetchBackend<TokenSummary[]>("/api/v1/admin/tokens", fallbackTokens);
}

export async function getAuditEvents(): Promise<QueryResult<AuditEvent[]>> {
  const result = await fetchBackend<PaginatedAuditResponse>(
    "/api/v1/admin/audit?page=1&pageSize=50",
    { items: [], total: 0, page: 1, pageSize: 50 },
  );
  return { ...result, data: result.data.items ?? [] };
}

export function getAuditEventsPaginated(page = 1, pageSize = 50) {
  return fetchBackend<PaginatedAuditResponse>(
    `/api/v1/admin/audit?page=${page}&pageSize=${pageSize}`,
    { items: [], total: 0, page, pageSize },
  );
}

export function getAuditEventsPaginatedFiltered(
  page = 1,
  pageSize = 50,
  filters: { status?: string; tenantID?: string; routeSlug?: string },
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.tenantID) params.set("tenantID", filters.tenantID);
  if (filters.routeSlug) params.set("routeSlug", filters.routeSlug);
  return fetchBackend<PaginatedAuditResponse>(
    `/api/v1/admin/audit/filtered?${params.toString()}`,
    { items: [], total: 0, page, pageSize },
  );
}

export function getPlatformAdmins() {
  return fetchBackend<PlatformAdminSummary[]>("/api/v1/admin/platform/admins", []);
}

export function getPlatformAdminCheck() {
  return fetchBackend<{ isPlatformAdmin: boolean }>("/api/v1/admin/platform/check", { isPlatformAdmin: false });
}

export function getAdminUsers() {
  return fetchBackend<UserAdminSummary[]>("/api/v1/admin/platform/users", []);
}

export function getAdminOrgs() {
  return fetchBackend<OrgAdminSummary[]>("/api/v1/admin/platform/orgs", []);
}

export function getOrgs() {
  return fetchBackend<OrgSummary[]>("/api/v1/admin/orgs", []);
}

export function getOrgMembers(orgID: string) {
  return fetchBackend<MemberSummary[]>(`/api/v1/admin/orgs/${encodeURIComponent(orgID)}/members`, []);
}

export async function getTopology(): Promise<QueryResult<TopologySnapshot>> {
  const [overview, tenants, routes, tokens, auditEvents] = await Promise.all([
    getOverview(),
    getTenants(),
    getRoutes(),
    getTokens(),
    getAuditEvents(),
  ]);

  const allLive = [overview, tenants, routes, tokens, auditEvents].every((result) => result.source === "backend");
  const errors = [overview, tenants, routes, tokens, auditEvents]
    .map((result) => result.error)
    .filter(Boolean)
    .join(" | ");

  return {
    data: {
      generatedAt: overview.data.generatedAt,
      runtime: overview.data.runtime,
      stats: overview.data.stats,
      tenants: tenants.data,
      routes: routes.data,
      tokens: tokens.data,
      auditEvents: auditEvents.data,
    },
    source: allLive ? "backend" : "fallback",
    backendUrl,
    error: errors || undefined,
  } satisfies QueryResult<TopologySnapshot>;
}

const fallbackOIDCConfig: OIDCConfig = {
  issuer: "",
  clientID: "",
  hasSecret: false,
  displayName: "Single Sign-On",
  groupsClaim: "",
  enabled: false,
  updatedAt: "",
};

export function getOIDCConfig() {
  return fetchBackend<OIDCConfig>("/api/v1/admin/settings/oidc", fallbackOIDCConfig);
}

export function getOIDCOrgMappings() {
  return fetchBackend<OIDCOrgMapping[]>("/api/v1/admin/settings/oidc/mappings", []);
}

// ── Traffic & Analytics ─────────────────────────────────────────

export function getTrafficStats(hours = 24) {
  return fetchBackend<TrafficStat[]>(`/api/v1/admin/traffic/stats?hours=${hours}`, []);
}

export function getTrafficOverview() {
  return fetchBackend<TrafficOverview>("/api/v1/admin/traffic/overview", {
    totalRequests: 0,
    errorRate: 0,
    avgLatencyMs: 0,
    priorRequests: 0,
    priorErrorRate: 0,
    priorAvgLatency: 0,
  });
}

// ── Admin Audit ─────────────────────────────────────────────────

export function getAdminAuditEvents(page = 1, pageSize = 50) {
  return fetchBackend<PaginatedAdminAuditResponse>(
    `/api/v1/admin/admin-audit?page=${page}&pageSize=${pageSize}`,
    { items: [], total: 0, page, pageSize },
  );
}

// ── Health History ──────────────────────────────────────────────

export function getHealthHistory(tenantID: string) {
  return fetchBackend<HealthHistoryEntry[]>(
    `/api/v1/admin/health-history?tenantID=${encodeURIComponent(tenantID)}`,
    [],
  );
}

// ── Tenant Upstreams ────────────────────────────────────────────

export function getTenantUpstreams(tenantInternalID: string) {
  return fetchBackend<TenantUpstream[]>(
    `/api/v1/admin/tenant-upstreams/${encodeURIComponent(tenantInternalID)}`,
    [],
  );
}

// ── Sessions ────────────────────────────────────────────────────

export function getAdminSessions() {
  return fetchBackend<AdminSession[]>("/api/v1/admin/sessions", []);
}

// ── Circuit Breakers ────────────────────────────────────────────

export function getCircuitBreakers() {
  return fetchBackend<CircuitBreakerStatus[]>("/api/v1/admin/circuit-breakers", []);
}

// ── Expiring Tokens ─────────────────────────────────────────────

export function getExpiringTokens(days = 7) {
  return fetchBackend<ExpiringToken[]>(`/api/v1/admin/tokens/expiring?days=${days}`, []);
}

// ── Replicas (Platform Admin) ───────────────────────────────────

export function getReplicas() {
  return fetchBackend<ReplicaInfo[]>("/api/v1/admin/platform/replicas", []);
}

// ── Global Search ───────────────────────────────────────────────

export function getSearchResults(query: string) {
  return fetchBackend<SearchResults>(
    `/api/v1/admin/search?q=${encodeURIComponent(query)}`,
    { routes: [], tenants: [], tokens: [] },
  );
}

// ── Protected Apps ───────────────────────────────────────────────

export function getProtectedApps() {
  return fetchBackend<ProtectedApp[]>("/api/v1/admin/apps", []);
}

export function getAppTokens(appID: string) {
  return fetchBackend<AppToken[]>(`/api/v1/admin/apps/${encodeURIComponent(appID)}/tokens`, []);
}

export function getAppSessions(appID: string) {
  return fetchBackend<AppSession[]>(`/api/v1/admin/apps/${encodeURIComponent(appID)}/sessions`, []);
}