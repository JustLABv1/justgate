import { getAdminRequestHeaders, getBackendBaseUrl } from "@/lib/backend-server";
import {
    fallbackOverview,
    fallbackRoutes,
    fallbackTenants,
    fallbackTokens,
    type AdminOverview,
    type AuditEvent,
    type MemberSummary,
    type OIDCConfig,
    type OIDCOrgMapping,
    type OrgAdminSummary,
    type OrgSummary,
    type PaginatedAuditResponse,
    type PlatformAdminSummary,
    type QueryResult,
    type RouteSummary,
    type TenantSummary,
    type TokenSummary,
    type TopologySnapshot,
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