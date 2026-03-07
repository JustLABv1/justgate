export type DataSource = "backend" | "fallback";

export interface RuntimeState {
  status: "online" | "offline";
  version: string;
  storeKind: string;
}

export interface OverviewStats {
  tenants: number;
  routes: number;
  activeTokens: number;
  auditEvents24h: number;
}

export interface AdminOverview {
  generatedAt: string;
  runtime: RuntimeState;
  stats: OverviewStats;
}

export interface TenantSummary {
  id: string;
  name: string;
  tenantID: string;
  upstreamURL: string;
  authMode: string;
  headerName: string;
}

export interface RouteSummary {
  id: string;
  slug: string;
  targetPath: string;
  tenantID: string;
  requiredScope: string;
  methods: string[];
}

export interface TokenSummary {
  id: string;
  name: string;
  tenantID: string;
  scopes: string[];
  expiresAt: string;
  lastUsedAt: string;
  preview: string;
  active: boolean;
}

export interface IssuedToken {
  token: TokenSummary;
  secret: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  routeSlug: string;
  tenantID: string;
  tokenID: string;
  method: string;
  status: number;
  upstreamURL: string;
}

export interface QueryResult<T> {
  data: T;
  source: DataSource;
  backendUrl: string;
  error?: string;
}

export const fallbackOverview: AdminOverview = {
  generatedAt: "2026-03-07T10:30:00Z",
  runtime: {
    status: "offline",
    version: "seed-frontend-fallback",
    storeKind: "memory",
  },
  stats: {
    tenants: 2,
    routes: 3,
    activeTokens: 2,
    auditEvents24h: 12,
  },
};

export const fallbackTenants: TenantSummary[] = [
  {
    id: "tenant-acme",
    name: "Acme Observability",
    tenantID: "acme-prod",
    upstreamURL: "http://localhost:9009",
    authMode: "header",
    headerName: "X-Scope-OrgID",
  },
  {
    id: "tenant-northstar",
    name: "Northstar Platform",
    tenantID: "northstar-int",
    upstreamURL: "http://localhost:9010",
    authMode: "header",
    headerName: "X-Scope-OrgID",
  },
];

export const fallbackRoutes: RouteSummary[] = [
  {
    id: "route-mimir",
    slug: "mimir",
    targetPath: "/api/v1",
    tenantID: "acme-prod",
    requiredScope: "metrics:read",
    methods: ["GET"],
  },
  {
    id: "route-rules",
    slug: "rules",
    targetPath: "/prometheus/config/v1/rules",
    tenantID: "acme-prod",
    requiredScope: "rules:read",
    methods: ["GET"],
  },
  {
    id: "route-team-a",
    slug: "team-a-metrics",
    targetPath: "/api/v1/push",
    tenantID: "northstar-int",
    requiredScope: "metrics:write",
    methods: ["POST"],
  },
];

export const fallbackTokens: TokenSummary[] = [
  {
    id: "tok_ops_reader",
    name: "ops-reader",
    tenantID: "acme-prod",
    scopes: ["metrics:read", "rules:read"],
    expiresAt: "2026-06-30T00:00:00Z",
    lastUsedAt: "2026-03-07T09:26:00Z",
    preview: "jpg_ops_reader_...d3f",
    active: true,
  },
  {
    id: "tok_agent_push",
    name: "agent-push",
    tenantID: "northstar-int",
    scopes: ["metrics:write"],
    expiresAt: "2026-05-14T00:00:00Z",
    lastUsedAt: "2026-03-07T08:11:00Z",
    preview: "jpg_agent_push_...7ab",
    active: true,
  },
];

export const fallbackAuditEvents: AuditEvent[] = [
  {
    id: "audit-001",
    timestamp: "2026-03-07T09:26:00Z",
    routeSlug: "mimir",
    tenantID: "acme-prod",
    tokenID: "tok_ops_reader",
    method: "GET",
    status: 200,
    upstreamURL: "http://localhost:9009/api/v1/query",
  },
  {
    id: "audit-002",
    timestamp: "2026-03-07T08:11:00Z",
    routeSlug: "team-a-metrics",
    tenantID: "northstar-int",
    tokenID: "tok_agent_push",
    method: "POST",
    status: 202,
    upstreamURL: "http://localhost:9010/api/v1/push",
  },
  {
    id: "audit-003",
    timestamp: "2026-03-07T07:59:00Z",
    routeSlug: "rules",
    tenantID: "acme-prod",
    tokenID: "tok_ops_reader",
    method: "GET",
    status: 401,
    upstreamURL: "http://localhost:9009/prometheus/config/v1/rules",
  },
];