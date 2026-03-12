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
  healthCheckPath?: string;
  upstreamStatus?: string;
  upstreamLatencyMs?: number;
  upstreamLastChecked?: string;
  upstreamError?: string;
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

export interface TopologySnapshot {
  generatedAt: string;
  runtime: RuntimeState;
  stats: OverviewStats;
  tenants: TenantSummary[];
  routes: RouteSummary[];
  tokens: TokenSummary[];
  auditEvents: AuditEvent[];
}

export const fallbackOverview: AdminOverview = {
  generatedAt: new Date().toISOString(),
  runtime: {
    status: "offline",
    version: "v0.0.0-dev",
    storeKind: "none",
  },
  stats: {
    tenants: 0,
    routes: 0,
    activeTokens: 0,
    auditEvents24h: 0,
  },
};

export const fallbackTenants: TenantSummary[] = [];

export const fallbackRoutes: RouteSummary[] = [];

export const fallbackTokens: TokenSummary[] = [];

export const fallbackAuditEvents: AuditEvent[] = [];

export const fallbackTopology: TopologySnapshot = {
  generatedAt: fallbackOverview.generatedAt,
  runtime: fallbackOverview.runtime,
  stats: fallbackOverview.stats,
  tenants: fallbackTenants,
  routes: fallbackRoutes,
  tokens: fallbackTokens,
  auditEvents: fallbackAuditEvents,
};

export interface OrgSummary {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface MemberSummary {
  userID: string;
  userName: string;
  userEmail: string;
  role: string;
  joinedAt: string;
}

export interface InviteResult {
  code: string;
  orgID: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
}

export interface OIDCConfig {
  issuer: string;
  clientID: string;
  hasSecret: boolean;
  displayName: string;
  groupsClaim: string;
  enabled: boolean;
  updatedAt: string;
  /** True when the values are sourced from environment variables (no DB record yet). */
  fromEnv?: boolean;
}

export interface OIDCOrgMapping {
  id: string;
  oidcGroup: string;
  orgID: string;
  createdAt: string;
}

