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
  /** Additional configured upstream targets with per-URL health status */
  upstreams?: TenantUpstream[];
}

export interface RouteSummary {
  id: string;
  slug: string;
  targetPath: string;
  tenantID: string;
  requiredScope: string;
  methods: string[];
  rateLimitRPM: number;
  rateLimitBurst: number;
  allowCIDRs: string;
  denyCIDRs: string;
  circuitBreakerState?: string;
}

export interface TokenSummary {
  id: string;
  name: string;
  tenantID: string;
  scopes: string[];
  expiresAt: string;
  lastUsedAt: string;
  createdAt: string;
  preview: string;
  active: boolean;
  rateLimitRPM: number;
  rateLimitBurst: number;
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
  latencyMs: number;
  requestPath?: string;
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

export interface PaginatedAuditResponse {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlatformAdminSummary {
  userID: string;
  userName: string;
  userEmail: string;
  grantedBy: string;
  grantedAt: string;
}

export interface UserAdminSummary {
  id: string;
  name: string;
  email: string;
  source: string;
  createdAt: string;
  isPlatformAdmin: boolean;
}

export interface OrgAdminSummary {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
}

// ── Traffic & Analytics ─────────────────────────────────────────────

export interface TrafficStat {
  bucket: string;
  tenantID: string;
  routeSlug: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

export interface TrafficOverview {
  totalRequests: number;
  errorRate: number;
  avgLatencyMs: number;
  priorRequests: number;
  priorErrorRate: number;
  priorAvgLatency: number;
}

// ── Admin Audit ─────────────────────────────────────────────────

export interface AdminAuditEvent {
  id: string;
  timestamp: string;
  userID: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceID: string;
  details: string;
  orgID: string;
}

export interface PaginatedAdminAuditResponse {
  items: AdminAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Health History ──────────────────────────────────────────────

export interface HealthHistoryEntry {
  id: string;
  tenantID: string;
  status: string;
  latencyMs: number;
  error: string;
  checkedAt: string;
}

// ── Tenant Upstreams (Load Balancing) ──────────────────────────

export interface TenantUpstream {
  id: string;
  upstreamURL: string;
  weight: number;
  isPrimary: boolean;
  /** Health check result for this specific upstream URL */
  status?: string;
  latencyMs?: number;
  error?: string;
  lastChecked?: string;
}

// ── Sessions ────────────────────────────────────────────────────

export interface AdminSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  isRevoked: boolean;
}

// ── Circuit Breakers ────────────────────────────────────────────

export interface CircuitBreakerStatus {
  tenantID: string;
  state: string;
  failureCount: number;
  lastFailure: string;
  lastSuccess: string;
}

// ── Expiring Tokens ─────────────────────────────────────────────

export interface ExpiringToken {
  id: string;
  name: string;
  tenantID: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

// ── Route Test ──────────────────────────────────────────────────

export interface RouteTestResult {
  statusCode: number;
  headers: Record<string, string[]>;
  body: string;
  latencyMs: number;
  error: string;
}

// ── Multi-region / Replicas ─────────────────────────────────────

export interface ReplicaInfo {
  instanceID: string;
  region: string;
  hostname: string;
  lastHeartbeat: string;
  status: string;
}

// ── Global Search ───────────────────────────────────────────────

export interface SearchResults {
  routes: RouteSummary[];
  tenants: TenantSummary[];
  tokens: TokenSummary[];
  grants: GrantSummary[];
  apps: ProtectedApp[];
}

// ── Protected Apps ───────────────────────────────────────────────

export interface HeaderInjectionRule {
  name: string;
  value: string;
}

export interface ProtectedApp {
  id: string;
  name: string;
  slug: string;
  upstreamURL: string;
  orgID: string;
  authMode: "oidc" | "bearer" | "any" | "none";
  injectHeaders: HeaderInjectionRule[];
  stripHeaders: string[];
  extraCAPEM: string;
  rateLimitRPM: number;
  rateLimitBurst: number;
  rateLimitPer: "session" | "ip" | "token";
  allowCIDRs: string;
  denyCIDRs: string;
  healthCheckPath: string;
  createdAt: string;
  createdBy: string;
}

export interface AppSession {
  id: string;
  appID: string;
  userSub: string;
  userEmail: string;
  userName: string;
  userGroups: string[];
  ip: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  revoked: boolean;
}

export interface AppToken {
  id: string;
  name: string;
  appID: string;
  preview: string;
  active: boolean;
  rateLimitRPM: number;
  rateLimitBurst: number;
  expiresAt: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface IssuedAppToken {
  token: AppToken;
  secret: string;
}

// ── Provisioning Grants ─────────────────────────────────────────

export interface GrantSummary {
  id: string;
  name: string;
  tenantID: string;
  scopes: string[];
  tokenTTLHours: number;
  maxUses: number;
  useCount: number;
  active: boolean;
  preview: string;
  rateLimitRPM: number;
  rateLimitBurst: number;
  orgID: string;
  expiresAt: string;
  createdAt: string;
}

export interface IssuedGrant {
  grant: GrantSummary;
  secret: string;
}

export interface BulkTokenResponse {
  tokens: IssuedToken[];
}

// ── Traffic Heatmap ──────────────────────────────────────────────

export interface TrafficHeatmapCell {
  routeSlug: string;
  hour: number;
  requestCount: number;
}

// ── Token Usage Analytics ────────────────────────────────────────

export interface TokenTrafficStat {
  bucket: string;
  routeSlug: string;
  tenantID: string;
  tokenID: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
}

// ── Grant Issuances ──────────────────────────────────────────────

export interface GrantIssuance {
  id: string;
  grantID: string;
  tokenID: string;
  agentName: string;
  issuedAt: string;
}

// ── Org IP Rules ─────────────────────────────────────────────────

export interface OrgIPRule {
  id: string;
  cidr: string;
  description: string;
  createdAt: string;
  createdBy: string;
}
