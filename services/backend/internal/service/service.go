package service

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const defaultAdminJWTSecret = "justgate-local-backend-jwt-secret"

type Config struct {
	Version          string
	StoreKind        string
	AdminJWTSecret   string
	DatabaseURL      string
	TenantHeaderName string
	OIDCIssuer       string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCDisplayName  string
	// InitialPlatformAdminEmail seeds the first platform admin on startup.
	InitialPlatformAdminEmail string
	// Path to a PEM file containing extra CA certificates for outbound TLS.
	ExtraCAFile string
}

type dataStore interface {
	ListTenants(ctx context.Context) ([]tenantRecord, error)
	ListRoutes(ctx context.Context) ([]routeRecord, error)
	ListTokens(ctx context.Context) ([]tokenRecord, error)
	ListAudits(ctx context.Context) ([]auditRecord, error)
	ListAuditsPaginated(ctx context.Context, limit, offset int) ([]auditRecord, int, error)
	// Platform admin management
	IsPlatformAdmin(ctx context.Context, userID string) (bool, error)
	ListPlatformAdmins(ctx context.Context) ([]platformAdminRecord, error)
	CountPlatformAdmins(ctx context.Context) (int, error)
	GrantPlatformAdmin(ctx context.Context, userID, grantedBy string) error
	RevokePlatformAdmin(ctx context.Context, userID string) error
	ListAllUsers(ctx context.Context) ([]userRecord, error)
	DeleteUser(ctx context.Context, userID string) error
	ListAllOrgs(ctx context.Context) ([]orgRecord, error)
	DeleteOrg(ctx context.Context, orgID string) error
	GetOrgWithMemberCount(ctx context.Context, orgID string) (orgRecord, int, error)
	CreateLocalAdmin(ctx context.Context, account localAdminRecord) (localAdminRecord, error)
	GetLocalAdminByEmail(ctx context.Context, email string) (localAdminRecord, bool, error)
	CreateTenant(ctx context.Context, payload createTenantRequest) (tenantRecord, error)
	UpdateTenant(ctx context.Context, tenantID string, payload createTenantRequest) (tenantRecord, error)
	DeleteTenant(ctx context.Context, tenantID string) error
	CreateRoute(ctx context.Context, payload createRouteRequest, methods []string) (routeRecord, error)
	UpdateRoute(ctx context.Context, routeID string, payload createRouteRequest, methods []string) (routeRecord, error)
	DeleteRoute(ctx context.Context, routeID string) error
	CreateToken(ctx context.Context, payload createTokenRequest, scopes []string, expiresAt time.Time, secret string) (tokenRecord, error)
	SetTokenActive(ctx context.Context, tokenID string, active bool) (tokenRecord, error)
	DeleteToken(ctx context.Context, tokenID string) error
	RouteBySlug(ctx context.Context, slug string) (routeRecord, bool, error)
	ValidateToken(ctx context.Context, secret string) (tokenRecord, bool, error)
	RecordAudit(ctx context.Context, audit auditRecord) error
	// Org management
	UpsertUser(ctx context.Context, user userRecord) error
	GetUserByEmail(ctx context.Context, email string) (userRecord, bool, error)
	GetUserByID(ctx context.Context, userID string) (userRecord, bool, error)
	CreateOrg(ctx context.Context, name, createdBy string) (orgRecord, error)
	ListOrgs(ctx context.Context, userID string) ([]orgRecord, error)
	GetOrgMembership(ctx context.Context, orgID, userID string) (orgMemberRecord, bool, error)
	AddOrgMember(ctx context.Context, orgID, userID, role string) error
	RemoveOrgMember(ctx context.Context, orgID, userID string) error
	ListOrgMembers(ctx context.Context, orgID string) ([]orgMemberRecord, error)
	CreateOrgInvite(ctx context.Context, orgID, createdBy string, expiresAt time.Time, maxUses int) (orgInviteRecord, error)
	GetOrgInviteByCode(ctx context.Context, code string) (orgInviteRecord, bool, error)
	ConsumeOrgInvite(ctx context.Context, code, userID string) (string, error)
	// OIDC config
	GetOIDCConfig(ctx context.Context) (oidcConfigRecord, bool, error)
	UpsertOIDCConfig(ctx context.Context, cfg oidcConfigRecord) error
	ListOIDCOrgMappings(ctx context.Context) ([]oidcOrgMappingRecord, error)
	CreateOIDCOrgMapping(ctx context.Context, mapping oidcOrgMappingRecord) error
	DeleteOIDCOrgMapping(ctx context.Context, id string) error
	// Upstream health
	UpsertUpstreamHealth(ctx context.Context, health upstreamHealthRecord) error
	ListUpstreamHealth(ctx context.Context) ([]upstreamHealthRecord, error)
}

type createOrgRequest struct {
	Name string `json:"name"`
}

type orgSummary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

type memberSummary struct {
	UserID    string `json:"userID"`
	UserName  string `json:"userName"`
	UserEmail string `json:"userEmail"`
	Role      string `json:"role"`
	JoinedAt  string `json:"joinedAt"`
}

type addMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type orgInviteSummary struct {
	Code      string `json:"code"`
	OrgID     string `json:"orgID"`
	ExpiresAt string `json:"expiresAt"`
	MaxUses   int    `json:"maxUses"`
	UseCount  int    `json:"useCount"`
}

type acceptInviteRequest struct {
	Code string `json:"code"`
}

type Service struct {
	config    Config
	store     dataStore
	start     time.Time
	logger    *slog.Logger
	stop      chan struct{}
	transport *http.Transport
}

type overviewResponse struct {
	GeneratedAt string       `json:"generatedAt"`
	Runtime     runtimeState `json:"runtime"`
	Stats       stats        `json:"stats"`
}

type runtimeState struct {
	Status    string `json:"status"`
	Version   string `json:"version"`
	StoreKind string `json:"storeKind"`
}

type stats struct {
	Tenants        int `json:"tenants"`
	Routes         int `json:"routes"`
	ActiveTokens   int `json:"activeTokens"`
	AuditEvents24h int `json:"auditEvents24h"`
}

type tenantSummary struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	TenantID            string `json:"tenantID"`
	Upstream            string `json:"upstreamURL"`
	AuthMode            string `json:"authMode"`
	HeaderName          string `json:"headerName"`
	HealthCheckPath     string `json:"healthCheckPath,omitempty"`
	UpstreamStatus      string `json:"upstreamStatus,omitempty"`
	UpstreamLatencyMs   int    `json:"upstreamLatencyMs,omitempty"`
	UpstreamLastChecked string `json:"upstreamLastChecked,omitempty"`
	UpstreamError       string `json:"upstreamError,omitempty"`
}

type routeSummary struct {
	ID            string   `json:"id"`
	Slug          string   `json:"slug"`
	TargetPath    string   `json:"targetPath"`
	TenantID      string   `json:"tenantID"`
	RequiredScope string   `json:"requiredScope"`
	Methods       []string `json:"methods"`
}

type tokenSummary struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	TenantID   string   `json:"tenantID"`
	Scopes     []string `json:"scopes"`
	ExpiresAt  string   `json:"expiresAt"`
	LastUsedAt string   `json:"lastUsedAt"`
	Preview    string   `json:"preview"`
	Active     bool     `json:"active"`
}

type auditEvent struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	RouteSlug string `json:"routeSlug"`
	TenantID  string `json:"tenantID"`
	TokenID   string `json:"tokenID"`
	Method    string `json:"method"`
	Status    int    `json:"status"`
	Upstream  string `json:"upstreamURL"`
}

type topologyResponse struct {
	GeneratedAt string          `json:"generatedAt"`
	Runtime     runtimeState    `json:"runtime"`
	Stats       stats           `json:"stats"`
	Tenants     []tenantSummary `json:"tenants"`
	Routes      []routeSummary  `json:"routes"`
	Tokens      []tokenSummary  `json:"tokens"`
	AuditEvents []auditEvent    `json:"auditEvents"`
}

type createTenantRequest struct {
	Name            string `json:"name"`
	TenantID        string `json:"tenantID"`
	Upstream        string `json:"upstreamURL"`
	AuthMode        string `json:"authMode"`
	HeaderName      string `json:"headerName"`
	HealthCheckPath string `json:"healthCheckPath"`
}

type createRouteRequest struct {
	Slug          string          `json:"slug"`
	TargetPath    string          `json:"targetPath"`
	TenantID      string          `json:"tenantID"`
	RequiredScope string          `json:"requiredScope"`
	Methods       json.RawMessage `json:"methods"`
}

type createTokenRequest struct {
	Name      string          `json:"name"`
	TenantID  string          `json:"tenantID"`
	Scopes    json.RawMessage `json:"scopes"`
	ExpiresAt string          `json:"expiresAt"`
}

type updateTokenRequest struct {
	Active *bool `json:"active"`
}

type registerLocalAdminRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

type verifyLocalAdminRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type issuedTokenResponse struct {
	Token  tokenSummary `json:"token"`
	Secret string       `json:"secret"`
}

type routeRecord struct {
	ID            string
	Slug          string
	TargetPath    string
	TenantID      string
	RequiredScope string
	Methods       []string
	UpstreamURL   string
}

type tenantRecord struct {
	ID              string
	Name            string
	TenantID        string
	Upstream        string
	AuthMode        string
	HeaderName      string
	OrgID           string
	HealthCheckPath string
}

type tokenRecord struct {
	ID         string
	Name       string
	TenantID   string
	Scopes     []string
	ExpiresAt  time.Time
	LastUsedAt time.Time
	Preview    string
	Active     bool
	Hash       string
}

type auditRecord struct {
	ID        string
	Timestamp time.Time
	RouteSlug string
	TenantID  string
	TokenID   string
	Method    string
	Status    int
	Upstream  string
}

type localAdminRecord struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	CreatedAt    time.Time
}

type userRecord struct {
	ID        string
	Email     string
	Name      string
	Source    string
	CreatedAt time.Time
}

type orgRecord struct {
	ID        string
	Name      string
	CreatedBy string
	Role      string // populated when listing for a specific user
	CreatedAt time.Time
}

type orgMemberRecord struct {
	OrgID     string
	UserID    string
	Role      string
	JoinedAt  time.Time
	UserName  string
	UserEmail string
}

type orgInviteRecord struct {
	ID        string
	OrgID     string
	Code      string
	CreatedBy string
	ExpiresAt time.Time
	MaxUses   int
	UseCount  int
	CreatedAt time.Time
}

type oidcConfigRecord struct {
	ID                    string
	Issuer                string
	ClientID              string
	ClientSecretEncrypted string
	DisplayName           string
	GroupsClaim           string
	Enabled               bool
	UpdatedAt             time.Time
}

type oidcOrgMappingRecord struct {
	ID        string
	OIDCGroup string
	OrgID     string
	CreatedAt time.Time
}

type upstreamHealthRecord struct {
	TenantID      string
	Status        string
	LastCheckedAt time.Time
	LatencyMs     int
	Error         string
}

type requestContextKey string

const (
	contextKeyOrgID   requestContextKey = "orgID"
	contextKeyAdminID requestContextKey = "adminID"
	contextKeyOrgRole requestContextKey = "orgRole"
)

func orgIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(contextKeyOrgID).(string)
	return v
}

func adminIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(contextKeyAdminID).(string)
	return v
}

func orgRoleFromContext(ctx context.Context) string {
	v, _ := ctx.Value(contextKeyOrgRole).(string)
	return v
}

func New(config Config) (*Service, error) {
	if config.Version == "" {
		config.Version = "dev"
	}
	if config.AdminJWTSecret == "" {
		config.AdminJWTSecret = defaultAdminJWTSecret
	}
	if config.DatabaseURL == "" {
		config.DatabaseURL = defaultDatabaseURL()
	}
	if config.TenantHeaderName == "" {
		config.TenantHeaderName = "X-Scope-OrgID"
	}
	storeKind, store, err := newSQLStore(config.DatabaseURL)
	if err != nil {
		return nil, err
	}
	config.StoreKind = storeKind

	transport, err := buildTransport(config.ExtraCAFile)
	if err != nil {
		return nil, fmt.Errorf("loading extra CA file %q: %w", config.ExtraCAFile, err)
	}

	service := &Service{
		config:    config,
		store:     store,
		start:     time.Now().UTC(),
		logger:    slog.Default(),
		stop:      make(chan struct{}),
		transport: transport,
	}

	service.logStartup()
	if config.AdminJWTSecret == defaultAdminJWTSecret {
		service.logger.Warn("using default admin JWT secret; set JUST_GATE_BACKEND_JWT_SECRET outside local development")
	}

	// Seed the initial platform admin from env var (idempotent)
	if email := strings.ToLower(strings.TrimSpace(config.InitialPlatformAdminEmail)); email != "" {
		go service.seedInitialPlatformAdmin(email)
	}

	go service.runHealthChecker()

	return service, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/api/v1/auth/local/register", s.handleRegisterLocalAdmin)
	mux.HandleFunc("/api/v1/auth/local/verify", s.handleVerifyLocalAdmin)
	mux.HandleFunc("/api/v1/admin/overview", s.withAdminAuth(s.withOptionalOrgContext(s.handleOverview)))
	mux.HandleFunc("/api/v1/admin/routes", s.withAdminAuth(s.withOrgContext(s.handleRoutes)))
	mux.HandleFunc("/api/v1/admin/routes/", s.withAdminAuth(s.withOrgContext(s.handleRouteByID)))
	mux.HandleFunc("/api/v1/admin/tenants", s.withAdminAuth(s.withOrgContext(s.handleTenants)))
	mux.HandleFunc("/api/v1/admin/tenants/", s.withAdminAuth(s.withOrgContext(s.handleTenantByID)))
	mux.HandleFunc("/api/v1/admin/tokens", s.withAdminAuth(s.withOrgContext(s.handleTokens)))
	mux.HandleFunc("/api/v1/admin/tokens/", s.withAdminAuth(s.withOrgContext(s.handleTokenByID)))
	mux.HandleFunc("/api/v1/admin/audit", s.withAdminAuth(s.withOrgContext(s.handleAudit)))
	mux.HandleFunc("/api/v1/admin/topology", s.withAdminAuth(s.withOrgContext(s.handleTopology)))
	mux.HandleFunc("/api/v1/admin/topology/stream", s.handleTopologyStream)
	mux.HandleFunc("/api/v1/admin/orgs", s.withAdminAuth(s.handleOrgs))
	mux.HandleFunc("/api/v1/admin/orgs/", s.withAdminAuth(s.handleOrgByID))
	mux.HandleFunc("/api/v1/admin/settings/oidc", s.withAdminAuth(s.handleOIDCSettings))
	mux.HandleFunc("/api/v1/admin/settings/oidc/mappings", s.withAdminAuth(s.handleOIDCMappings))
	mux.HandleFunc("/api/v1/admin/settings/oidc/mappings/", s.withAdminAuth(s.handleOIDCMappings))
	mux.HandleFunc("/api/v1/internal/oidc-provider-config", s.withAdminAuth(s.handleInternalOIDCProviderConfig))
	s.registerPlatformRoutes(mux)
	mux.HandleFunc("/proxy/", s.handleProxy)

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		startedAt := time.Now()
		loggingWriter := &statusLoggingResponseWriter{ResponseWriter: writer}

		defer func() {
			s.logRequest(request, loggingWriter.statusCode(), loggingWriter.bytesWritten, time.Since(startedAt))
		}()

		loggingWriter.Header().Set("Access-Control-Allow-Origin", "*")
		loggingWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		loggingWriter.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if request.Method == http.MethodOptions {
			loggingWriter.WriteHeader(http.StatusNoContent)
			return
		}

		mux.ServeHTTP(loggingWriter, request)
	})
}

var topologyUpgrader = websocket.Upgrader{
	CheckOrigin: func(_ *http.Request) bool { return true },
}

func (s *Service) withAdminAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		tokenValue := extractBearerToken(request.Header.Get("Authorization"))
		identity, err := validateAdminToken(tokenValue, s.config.AdminJWTSecret)
		if err != nil {
			s.logger.Warn("admin authentication failed", "path", request.URL.Path, "remote_addr", clientAddress(request), "error", err.Error())
			writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": err.Error()})
			return
		}
		_ = s.store.UpsertUser(request.Context(), userRecord{
			ID:        identity.Subject,
			Email:     identity.Email,
			Name:      identity.Name,
			Source:    "admin",
			CreatedAt: time.Now().UTC(),
		})
		ctx := context.WithValue(request.Context(), contextKeyAdminID, identity.Subject)
		next(writer, request.WithContext(ctx))
	}
}

func (s *Service) withOptionalOrgContext(next http.HandlerFunc) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		orgID := strings.TrimSpace(request.Header.Get("X-Org-ID"))
		if orgID == "" {
			next(writer, request)
			return
		}
		adminID := adminIDFromContext(request.Context())
		membership, ok, err := s.store.GetOrgMembership(request.Context(), orgID, adminID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to verify organisation membership"})
			return
		}
		if !ok {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "not a member of this organisation"})
			return
		}
		ctx := context.WithValue(request.Context(), contextKeyOrgID, orgID)
		ctx = context.WithValue(ctx, contextKeyOrgRole, membership.Role)
		next(writer, request.WithContext(ctx))
	}
}

func (s *Service) withOrgContext(next http.HandlerFunc) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		orgID := strings.TrimSpace(request.Header.Get("X-Org-ID"))
		if orgID == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "X-Org-ID header is required"})
			return
		}
		adminID := adminIDFromContext(request.Context())
		membership, ok, err := s.store.GetOrgMembership(request.Context(), orgID, adminID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to verify organisation membership"})
			return
		}
		if !ok {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "not a member of this organisation"})
			return
		}
		ctx := context.WithValue(request.Context(), contextKeyOrgID, orgID)
		ctx = context.WithValue(ctx, contextKeyOrgRole, membership.Role)
		next(writer, request.WithContext(ctx))
	}
}

func (s *Service) handleHealth(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]string{
		"status":    "ok",
		"version":   s.config.Version,
		"startedAt": s.start.Format(time.RFC3339),
	})
}

func (s *Service) handleRegisterLocalAdmin(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload registerLocalAdminRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	payload.Email = normalizeLocalAccountEmail(payload.Email)
	payload.Name = strings.TrimSpace(payload.Name)
	if payload.Email == "" || payload.Name == "" || payload.Password == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "email, name, and password are required"})
		return
	}
	if err := validateLocalAccountPassword(payload.Password); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	passwordHash, err := hashLocalAccountPassword(payload.Password)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to store password"})
		return
	}

	account, err := s.store.CreateLocalAdmin(request.Context(), localAdminRecord{
		ID:           newResourceID("admin"),
		Email:        payload.Email,
		Name:         payload.Name,
		PasswordHash: passwordHash,
		CreatedAt:    time.Now().UTC(),
	})
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusCreated, map[string]string{
		"id":    account.ID,
		"email": account.Email,
		"name":  account.Name,
	})
}

func (s *Service) handleVerifyLocalAdmin(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload verifyLocalAdminRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	account, ok, err := s.store.GetLocalAdminByEmail(request.Context(), normalizeLocalAccountEmail(payload.Email))
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to verify account"})
		return
	}
	if !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "account not found"})
		return
	}
	if verifyLocalAccountPassword(account.PasswordHash, payload.Password) != nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "wrong password"})
		return
	}

	writeJSON(writer, http.StatusOK, map[string]string{
		"id":    account.ID,
		"email": account.Email,
		"name":  account.Name,
	})
}

func (s *Service) handleOverview(writer http.ResponseWriter, request *http.Request) {
	// Without an active org (e.g. first install), still confirm the backend is reachable.
	if orgIDFromContext(request.Context()) == "" {
		writeJSON(writer, http.StatusOK, overviewResponse{
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
			Runtime: runtimeState{
				Status:    "online",
				Version:   s.config.Version,
				StoreKind: s.config.StoreKind,
			},
			Stats: stats{},
		})
		return
	}

	topology, err := s.buildTopologyResponse(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusOK, overviewResponse{
		GeneratedAt: topology.GeneratedAt,
		Runtime:     topology.Runtime,
		Stats:       topology.Stats,
	})
}

func (s *Service) handleRoutes(writer http.ResponseWriter, request *http.Request) {
	if request.Method == http.MethodPost {
		s.handleCreateRoute(writer, request)
		return
	}
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	routes, err := s.store.ListRoutes(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load routes"})
		return
	}

	items := make([]routeSummary, 0, len(routes))
	for _, route := range routes {
		items = append(items, routeSummary{
			ID:            route.ID,
			Slug:          route.Slug,
			TargetPath:    route.TargetPath,
			TenantID:      route.TenantID,
			RequiredScope: route.RequiredScope,
			Methods:       route.Methods,
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

func (s *Service) handleTenants(writer http.ResponseWriter, request *http.Request) {
	if request.Method == http.MethodPost {
		s.handleCreateTenant(writer, request)
		return
	}
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	tenants, err := s.store.ListTenants(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load tenants"})
		return
	}

	items := make([]tenantSummary, 0, len(tenants))
	for _, tenant := range tenants {
		items = append(items, tenantSummary{
			ID:              tenant.ID,
			Name:            tenant.Name,
			TenantID:        tenant.TenantID,
			Upstream:        tenant.Upstream,
			AuthMode:        tenant.AuthMode,
			HeaderName:      tenant.HeaderName,
			HealthCheckPath: tenant.HealthCheckPath,
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

func (s *Service) handleTokens(writer http.ResponseWriter, request *http.Request) {
	if request.Method == http.MethodPost {
		s.handleCreateToken(writer, request)
		return
	}
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	tokens, err := s.store.ListTokens(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load tokens"})
		return
	}

	items := make([]tokenSummary, 0, len(tokens))
	for _, token := range tokens {
		items = append(items, tokenSummary{
			ID:         token.ID,
			Name:       token.Name,
			TenantID:   token.TenantID,
			Scopes:     token.Scopes,
			ExpiresAt:  token.ExpiresAt.Format(time.RFC3339),
			LastUsedAt: token.LastUsedAt.Format(time.RFC3339),
			Preview:    token.Preview,
			Active:     token.Active,
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

func (s *Service) handleAudit(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	const defaultPageSize = 50
	page := parseQueryInt(request, "page", 1)
	pageSize := parseQueryInt(request, "pageSize", defaultPageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 500 {
		pageSize = defaultPageSize
	}
	offset := (page - 1) * pageSize

	audits, total, err := s.store.ListAuditsPaginated(request.Context(), pageSize, offset)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load audit events"})
		return
	}

	items := make([]auditEvent, 0, len(audits))
	for _, audit := range audits {
		items = append(items, auditEvent{
			ID:        audit.ID,
			Timestamp: audit.Timestamp.Format(time.RFC3339),
			RouteSlug: audit.RouteSlug,
			TenantID:  audit.TenantID,
			TokenID:   audit.TokenID,
			Method:    audit.Method,
			Status:    audit.Status,
			Upstream:  audit.Upstream,
		})
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"items":    items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (s *Service) handleTopology(writer http.ResponseWriter, request *http.Request) {
	topology, err := s.buildTopologyResponse(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusOK, topology)
}

func (s *Service) handleTopologyStream(writer http.ResponseWriter, request *http.Request) {
	tokenValue := extractBearerToken(request.Header.Get("Authorization"))
	if tokenValue == "" {
		tokenValue = strings.TrimSpace(request.URL.Query().Get("access_token"))
	}
	identity, err := validateAdminToken(tokenValue, s.config.AdminJWTSecret)
	if err != nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}
	_ = s.store.UpsertUser(request.Context(), userRecord{
		ID:        identity.Subject,
		Email:     identity.Email,
		Name:      identity.Name,
		Source:    "admin",
		CreatedAt: time.Now().UTC(),
	})

	ctx := context.WithValue(request.Context(), contextKeyAdminID, identity.Subject)
	orgID := strings.TrimSpace(request.URL.Query().Get("org_id"))
	if orgID != "" {
		membership, ok, err := s.store.GetOrgMembership(ctx, orgID, identity.Subject)
		if err != nil || !ok {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "not a member of this organisation"})
			return
		}
		ctx = context.WithValue(ctx, contextKeyOrgID, orgID)
		ctx = context.WithValue(ctx, contextKeyOrgRole, membership.Role)
	}
	request = request.WithContext(ctx)

	connection, err := topologyUpgrader.Upgrade(writer, request, nil)
	if err != nil {
		return
	}
	defer connection.Close()

	_ = connection.SetReadDeadline(time.Now().Add(60 * time.Second))
	connection.SetPongHandler(func(string) error {
		return connection.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	stop := make(chan struct{})
	go func() {
		defer close(stop)
		for {
			if _, _, readErr := connection.ReadMessage(); readErr != nil {
				return
			}
		}
	}()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	sendSnapshot := func() error {
		topology, buildErr := s.buildTopologyResponse(request.Context())
		if buildErr != nil {
			return connection.WriteJSON(map[string]any{"type": "error", "error": buildErr.Error()})
		}
		return connection.WriteJSON(map[string]any{"type": "snapshot", "data": topology})
	}

	if err := sendSnapshot(); err != nil {
		return
	}

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			_ = connection.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(5*time.Second))
			if err := sendSnapshot(); err != nil {
				return
			}
		}
	}
}

func (s *Service) buildTopologyResponse(ctx context.Context) (topologyResponse, error) {
	tokens, err := s.store.ListTokens(ctx)
	if err != nil {
		return topologyResponse{}, fmt.Errorf("failed to load tokens")
	}
	tenants, err := s.store.ListTenants(ctx)
	if err != nil {
		return topologyResponse{}, fmt.Errorf("failed to load tenants")
	}
	routes, err := s.store.ListRoutes(ctx)
	if err != nil {
		return topologyResponse{}, fmt.Errorf("failed to load routes")
	}
	audits, err := s.store.ListAudits(ctx)
	if err != nil {
		return topologyResponse{}, fmt.Errorf("failed to load audit events")
	}

	activeTokens := 0
	audits24h := 0
	cutoff := time.Now().UTC().Add(-24 * time.Hour)
	for _, token := range tokens {
		if token.Active {
			activeTokens++
		}
	}
	for _, audit := range audits {
		if audit.Timestamp.After(cutoff) {
			audits24h++
		}
	}

	tenantItems := make([]tenantSummary, 0, len(tenants))

	// Load upstream health data to enrich tenant summaries
	healthRecords, _ := s.store.ListUpstreamHealth(ctx)
	healthMap := make(map[string]upstreamHealthRecord, len(healthRecords))
	for _, h := range healthRecords {
		healthMap[h.TenantID] = h
	}

	for _, tenant := range tenants {
		ts := tenantSummary{
			ID:              tenant.ID,
			Name:            tenant.Name,
			TenantID:        tenant.TenantID,
			Upstream:        tenant.Upstream,
			AuthMode:        tenant.AuthMode,
			HeaderName:      tenant.HeaderName,
			HealthCheckPath: tenant.HealthCheckPath,
		}
		if h, ok := healthMap[tenant.TenantID]; ok {
			ts.UpstreamStatus = h.Status
			ts.UpstreamLatencyMs = h.LatencyMs
			ts.UpstreamLastChecked = h.LastCheckedAt.Format(time.RFC3339)
			ts.UpstreamError = h.Error
		}
		tenantItems = append(tenantItems, ts)
	}

	routeItems := make([]routeSummary, 0, len(routes))
	for _, route := range routes {
		routeItems = append(routeItems, routeSummary{
			ID:            route.ID,
			Slug:          route.Slug,
			TargetPath:    route.TargetPath,
			TenantID:      route.TenantID,
			RequiredScope: route.RequiredScope,
			Methods:       route.Methods,
		})
	}

	tokenItems := make([]tokenSummary, 0, len(tokens))
	for _, token := range tokens {
		tokenItems = append(tokenItems, tokenSummary{
			ID:         token.ID,
			Name:       token.Name,
			TenantID:   token.TenantID,
			Scopes:     token.Scopes,
			ExpiresAt:  token.ExpiresAt.Format(time.RFC3339),
			LastUsedAt: token.LastUsedAt.Format(time.RFC3339),
			Preview:    token.Preview,
			Active:     token.Active,
		})
	}

	auditItems := make([]auditEvent, 0, len(audits))
	for _, audit := range audits {
		auditItems = append(auditItems, auditEvent{
			ID:        audit.ID,
			Timestamp: audit.Timestamp.Format(time.RFC3339),
			RouteSlug: audit.RouteSlug,
			TenantID:  audit.TenantID,
			TokenID:   audit.TokenID,
			Method:    audit.Method,
			Status:    audit.Status,
			Upstream:  audit.Upstream,
		})
	}

	slices.SortFunc(auditItems, func(left, right auditEvent) int {
		switch {
		case left.Timestamp > right.Timestamp:
			return -1
		case left.Timestamp < right.Timestamp:
			return 1
		default:
			return 0
		}
	})

	return topologyResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Runtime: runtimeState{
			Status:    "online",
			Version:   s.config.Version,
			StoreKind: s.config.StoreKind,
		},
		Stats: stats{
			Tenants:        len(tenantItems),
			Routes:         len(routeItems),
			ActiveTokens:   activeTokens,
			AuditEvents24h: audits24h,
		},
		Tenants:     tenantItems,
		Routes:      routeItems,
		Tokens:      tokenItems,
		AuditEvents: auditItems,
	}, nil
}

func (s *Service) runHealthChecker() {
	client := &http.Client{
		Timeout:   5 * time.Second,
		Transport: s.transport,
	}
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Run immediately on start, then every 30 seconds
	s.checkUpstreamHealth(client)

	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.checkUpstreamHealth(client)
		}
	}
}

func (s *Service) checkUpstreamHealth(client *http.Client) {
	ctx := context.Background()
	tenants, err := s.store.ListTenants(ctx)
	if err != nil {
		s.logger.Warn("health checker: failed to list tenants", "error", err.Error())
		return
	}

	for _, tenant := range tenants {
		checkURL := tenant.Upstream
		if tenant.HealthCheckPath != "" {
			checkURL = strings.TrimRight(tenant.Upstream, "/") + "/" + strings.TrimLeft(tenant.HealthCheckPath, "/")
		}

		start := time.Now()
		req, err := http.NewRequestWithContext(ctx, http.MethodHead, checkURL, nil)
		if err != nil {
			_ = s.store.UpsertUpstreamHealth(ctx, upstreamHealthRecord{
				TenantID:      tenant.TenantID,
				Status:        "down",
				LastCheckedAt: time.Now().UTC(),
				LatencyMs:     0,
				Error:         fmt.Sprintf("invalid URL: %s", err.Error()),
			})
			continue
		}

		resp, err := client.Do(req)
		latency := time.Since(start).Milliseconds()

		if err != nil {
			_ = s.store.UpsertUpstreamHealth(ctx, upstreamHealthRecord{
				TenantID:      tenant.TenantID,
				Status:        "down",
				LastCheckedAt: time.Now().UTC(),
				LatencyMs:     int(latency),
				Error:         err.Error(),
			})
			continue
		}
		resp.Body.Close()

		status := "up"
		errMsg := ""
		if resp.StatusCode >= 500 {
			status = "down"
			errMsg = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}

		_ = s.store.UpsertUpstreamHealth(ctx, upstreamHealthRecord{
			TenantID:      tenant.TenantID,
			Status:        status,
			LastCheckedAt: time.Now().UTC(),
			LatencyMs:     int(latency),
			Error:         errMsg,
		})
	}
}

func normalizeTenantPayload(payload *createTenantRequest, defaultHeaderName string) error {
	payload.Name = strings.TrimSpace(payload.Name)
	payload.TenantID = strings.TrimSpace(payload.TenantID)
	payload.Upstream = strings.TrimSpace(payload.Upstream)
	payload.HeaderName = strings.TrimSpace(payload.HeaderName)
	payload.AuthMode = strings.TrimSpace(payload.AuthMode)
	payload.HealthCheckPath = strings.TrimSpace(payload.HealthCheckPath)

	if payload.Name == "" || payload.TenantID == "" || payload.Upstream == "" {
		return fmt.Errorf("name, tenantID, and upstreamURL are required")
	}
	if payload.HeaderName == "" {
		payload.HeaderName = defaultHeaderName
	}
	if payload.AuthMode == "" {
		payload.AuthMode = "header"
	}
	if _, err := url.ParseRequestURI(payload.Upstream); err != nil {
		return fmt.Errorf("upstreamURL must be a valid URL")
	}

	return nil
}

func (s *Service) handleCreateTenant(writer http.ResponseWriter, request *http.Request) {
	var payload createTenantRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if err := normalizeTenantPayload(&payload, s.config.TenantHeaderName); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	tenant, err := s.store.CreateTenant(request.Context(), payload)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusCreated, tenantSummary{
		ID:              tenant.ID,
		Name:            tenant.Name,
		TenantID:        tenant.TenantID,
		Upstream:        tenant.Upstream,
		AuthMode:        tenant.AuthMode,
		HeaderName:      tenant.HeaderName,
		HealthCheckPath: tenant.HealthCheckPath,
	})
}

func (s *Service) handleTenantByID(writer http.ResponseWriter, request *http.Request) {
	tenantID := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/v1/admin/tenants/"), "/")
	if tenantID == "" || strings.Contains(tenantID, "/") {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "tenant not found"})
		return
	}

	switch request.Method {
	case http.MethodPatch:
		var payload createTenantRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := normalizeTenantPayload(&payload, s.config.TenantHeaderName); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		tenant, err := s.store.UpdateTenant(request.Context(), tenantID, payload)
		if err != nil {
			status := http.StatusBadRequest
			if err.Error() == "tenant not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(writer, http.StatusOK, tenantSummary{
			ID:              tenant.ID,
			Name:            tenant.Name,
			TenantID:        tenant.TenantID,
			Upstream:        tenant.Upstream,
			AuthMode:        tenant.AuthMode,
			HeaderName:      tenant.HeaderName,
			HealthCheckPath: tenant.HealthCheckPath,
		})
	case http.MethodDelete:
		if err := s.store.DeleteTenant(request.Context(), tenantID); err != nil {
			status := http.StatusBadRequest
			if err.Error() == "tenant not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleCreateRoute(writer http.ResponseWriter, request *http.Request) {
	var payload createRouteRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	payload.Slug = strings.TrimSpace(payload.Slug)
	payload.TargetPath = strings.TrimSpace(payload.TargetPath)
	payload.TenantID = strings.TrimSpace(payload.TenantID)
	payload.RequiredScope = strings.TrimSpace(payload.RequiredScope)

	methods, err := normalizeStringList(payload.Methods)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "methods must be a JSON array or comma-separated string"})
		return
	}

	if payload.Slug == "" || payload.TargetPath == "" || payload.TenantID == "" || payload.RequiredScope == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "slug, targetPath, tenantID, and requiredScope are required"})
		return
	}
	if strings.ContainsAny(payload.Slug, "/ \t\n\r") {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "slug must not contain slashes or whitespace"})
		return
	}
	if !strings.HasPrefix(payload.TargetPath, "/") {
		payload.TargetPath = "/" + payload.TargetPath
	}
	if len(methods) == 0 {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "at least one method is required"})
		return
	}
	methods = normalizeMethods(methods)
	if len(methods) == 0 {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "methods must be valid HTTP verbs"})
		return
	}

	route, err := s.store.CreateRoute(request.Context(), payload, methods)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusCreated, routeSummary{
		ID:            route.ID,
		Slug:          route.Slug,
		TargetPath:    route.TargetPath,
		TenantID:      route.TenantID,
		RequiredScope: route.RequiredScope,
		Methods:       route.Methods,
	})
}

func (s *Service) handleCreateToken(writer http.ResponseWriter, request *http.Request) {
	var payload createTokenRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	payload.Name = strings.TrimSpace(payload.Name)
	payload.TenantID = strings.TrimSpace(payload.TenantID)
	payload.ExpiresAt = strings.TrimSpace(payload.ExpiresAt)

	scopes, err := normalizeStringList(payload.Scopes)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "scopes must be a JSON array or comma-separated string"})
		return
	}
	scopes = dedupeNonEmpty(scopes)
	if payload.Name == "" || payload.TenantID == "" || payload.ExpiresAt == "" || len(scopes) == 0 {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "name, tenantID, scopes, and expiresAt are required"})
		return
	}

	expiresAt, err := parseTimestamp(payload.ExpiresAt)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "expiresAt must be RFC3339 or datetime-local"})
		return
	}
	if !expiresAt.After(time.Now().UTC()) {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "expiresAt must be in the future"})
		return
	}

	secret, err := generateTokenSecret(payload.Name)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to generate token secret"})
		return
	}

	token, err := s.store.CreateToken(request.Context(), payload, scopes, expiresAt, secret)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusCreated, issuedTokenResponse{
		Token: tokenSummary{
			ID:         token.ID,
			Name:       token.Name,
			TenantID:   token.TenantID,
			Scopes:     token.Scopes,
			ExpiresAt:  token.ExpiresAt.Format(time.RFC3339),
			LastUsedAt: token.LastUsedAt.Format(time.RFC3339),
			Preview:    token.Preview,
			Active:     token.Active,
		},
		Secret: secret,
	})
}

func (s *Service) handleRouteByID(writer http.ResponseWriter, request *http.Request) {
	routeID := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/v1/admin/routes/"), "/")
	if routeID == "" || strings.Contains(routeID, "/") {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "route not found"})
		return
	}

	switch request.Method {
	case http.MethodPatch:
		var payload createRouteRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		payload.Slug = strings.TrimSpace(payload.Slug)
		payload.TargetPath = strings.TrimSpace(payload.TargetPath)
		payload.TenantID = strings.TrimSpace(payload.TenantID)
		payload.RequiredScope = strings.TrimSpace(payload.RequiredScope)
		methods, err := normalizeStringList(payload.Methods)
		if err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "methods must be a JSON array or comma-separated string"})
			return
		}
		if payload.Slug == "" || payload.TargetPath == "" || payload.TenantID == "" || payload.RequiredScope == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "slug, targetPath, tenantID, and requiredScope are required"})
			return
		}
		if strings.ContainsAny(payload.Slug, "/ \t\n\r") {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "slug must not contain slashes or whitespace"})
			return
		}
		if !strings.HasPrefix(payload.TargetPath, "/") {
			payload.TargetPath = "/" + payload.TargetPath
		}
		methods = normalizeMethods(methods)
		if len(methods) == 0 {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "methods must be valid HTTP verbs"})
			return
		}

		route, err := s.store.UpdateRoute(request.Context(), routeID, payload, methods)
		if err != nil {
			status := http.StatusBadRequest
			if err.Error() == "route not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(writer, http.StatusOK, routeSummary{
			ID:            route.ID,
			Slug:          route.Slug,
			TargetPath:    route.TargetPath,
			TenantID:      route.TenantID,
			RequiredScope: route.RequiredScope,
			Methods:       route.Methods,
		})
	case http.MethodDelete:
		if err := s.store.DeleteRoute(request.Context(), routeID); err != nil {
			status := http.StatusBadRequest
			if err.Error() == "route not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleTokenByID(writer http.ResponseWriter, request *http.Request) {
	tokenID := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/v1/admin/tokens/"), "/")
	if tokenID == "" || strings.Contains(tokenID, "/") {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "token not found"})
		return
	}

	switch request.Method {
	case http.MethodPatch:
		var payload updateTokenRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if payload.Active == nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "active is required"})
			return
		}

		token, err := s.store.SetTokenActive(request.Context(), tokenID, *payload.Active)
		if err != nil {
			status := http.StatusBadRequest
			if err.Error() == "token not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(writer, http.StatusOK, tokenSummary{
			ID:         token.ID,
			Name:       token.Name,
			TenantID:   token.TenantID,
			Scopes:     token.Scopes,
			ExpiresAt:  token.ExpiresAt.Format(time.RFC3339),
			LastUsedAt: token.LastUsedAt.Format(time.RFC3339),
			Preview:    token.Preview,
			Active:     token.Active,
		})
	case http.MethodDelete:
		if err := s.store.DeleteToken(request.Context(), tokenID); err != nil {
			status := http.StatusBadRequest
			if err.Error() == "token not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleProxy(writer http.ResponseWriter, request *http.Request) {
	trimmed := strings.TrimPrefix(request.URL.Path, "/proxy/")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "missing route slug"})
		return
	}

	route, ok, err := s.store.RouteBySlug(request.Context(), parts[0])
	if err != nil {
		s.logger.Error("proxy route lookup failed", "route_slug", parts[0], "error", err)
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to resolve route"})
		return
	}
	if !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "unknown route slug"})
		return
	}

	if !slices.Contains(route.Methods, request.Method) {
		s.recordAudit(request.Context(), parts[0], route.TenantID, "unknown", request.Method, http.StatusMethodNotAllowed, route.UpstreamURL)
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed for route"})
		return
	}

	tokenValue := extractBearerToken(request.Header.Get("Authorization"))
	if tokenValue == "" {
		s.recordAudit(request.Context(), parts[0], route.TenantID, "unknown", request.Method, http.StatusUnauthorized, route.UpstreamURL)
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "missing bearer token"})
		return
	}

	token, ok, err := s.store.ValidateToken(request.Context(), tokenValue)
	if err != nil {
		s.logger.Error("proxy token validation failed", "route_slug", parts[0], "error", err)
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to validate token"})
		return
	}
	if !ok {
		s.recordAudit(request.Context(), parts[0], "unknown", "unknown", request.Method, http.StatusUnauthorized, route.UpstreamURL)
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
		return
	}

	if token.TenantID != route.TenantID {
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, http.StatusForbidden, route.UpstreamURL)
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "token is not valid for this tenant route"})
		return
	}

	if route.RequiredScope != "" && !slices.Contains(token.Scopes, route.RequiredScope) {
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, http.StatusForbidden, route.UpstreamURL)
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "token is missing the required scope"})
		return
	}

	targetURL, err := url.Parse(route.UpstreamURL)
	if err != nil {
		s.logger.Error("proxy upstream configuration is invalid", "route_slug", parts[0], "upstream", route.UpstreamURL, "error", err)
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, http.StatusBadGateway, route.UpstreamURL)
		writeJSON(writer, http.StatusBadGateway, map[string]string{"error": "invalid upstream configuration"})
		return
	}

	remainingPath := ""
	if len(parts) == 2 {
		remainingPath = "/" + parts[1]
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.Transport = s.transport
	originalDirector := proxy.Director
	proxy.Director = func(proxyRequest *http.Request) {
		originalDirector(proxyRequest)
		proxyRequest.URL.Path = joinURLPath(targetURL.Path, route.TargetPath, remainingPath)
		proxyRequest.Host = targetURL.Host
		proxyRequest.Header.Set(s.config.TenantHeaderName, token.TenantID)
		proxyRequest.Header.Set("X-Proxy-Route", route.Slug)
		proxyRequest.Header.Set("X-Proxy-Token", token.ID)
	}
	proxy.ModifyResponse = func(response *http.Response) error {
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, response.StatusCode, response.Request.URL.String())
		return nil
	}
	proxy.ErrorHandler = func(proxyWriter http.ResponseWriter, proxyRequest *http.Request, proxyErr error) {
		s.logger.Error("proxy upstream request failed", "route_slug", parts[0], "tenant_id", token.TenantID, "token_id", token.ID, "upstream", route.UpstreamURL, "error", proxyErr)
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, http.StatusBadGateway, route.UpstreamURL)
		writeJSON(proxyWriter, http.StatusBadGateway, map[string]string{
			"error":   "upstream request failed",
			"details": proxyErr.Error(),
		})
	}

	proxy.ServeHTTP(writer, request)
}

func (s *Service) recordAudit(ctx context.Context, routeSlug, tenantID, tokenID, method string, status int, upstreamURL string) {
	if err := s.store.RecordAudit(ctx, auditRecord{
		Timestamp: time.Now().UTC(),
		RouteSlug: routeSlug,
		TenantID:  tenantID,
		TokenID:   tokenID,
		Method:    method,
		Status:    status,
		Upstream:  upstreamURL,
	}); err != nil {
		s.logger.Error("failed to record audit event", "route_slug", routeSlug, "tenant_id", tenantID, "token_id", tokenID, "method", method, "status", status, "upstream", upstreamURL, "error", err)
	}
}

type statusLoggingResponseWriter struct {
	http.ResponseWriter
	status       int
	bytesWritten int
}

func (writer *statusLoggingResponseWriter) WriteHeader(status int) {
	writer.status = status
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *statusLoggingResponseWriter) Write(body []byte) (int, error) {
	if writer.status == 0 {
		writer.status = http.StatusOK
	}
	n, err := writer.ResponseWriter.Write(body)
	writer.bytesWritten += n
	return n, err
}

func (writer *statusLoggingResponseWriter) Flush() {
	if flusher, ok := writer.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (writer *statusLoggingResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := writer.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("response writer does not support hijacking")
	}
	return hijacker.Hijack()
}

func (writer *statusLoggingResponseWriter) Push(target string, options *http.PushOptions) error {
	pusher, ok := writer.ResponseWriter.(http.Pusher)
	if !ok {
		return http.ErrNotSupported
	}
	return pusher.Push(target, options)
}

func (writer *statusLoggingResponseWriter) statusCode() int {
	if writer.status == 0 {
		return http.StatusOK
	}
	return writer.status
}

func (s *Service) logStartup() {
	s.logger.Info("backend service initialized",
		"version", s.config.Version,
		"store_kind", s.config.StoreKind,
		"database", summarizeDatabaseTarget(s.config.DatabaseURL),
		"tenant_header_name", s.config.TenantHeaderName,
		"started_at", s.start.Format(time.RFC3339),
	)
}

func (s *Service) logRequest(request *http.Request, status, bytesWritten int, duration time.Duration) {
	level := slog.LevelInfo
	if status >= http.StatusInternalServerError {
		level = slog.LevelError
	} else if status >= http.StatusBadRequest {
		level = slog.LevelWarn
	}

	s.logger.Log(request.Context(), level, "request completed",
		"method", request.Method,
		"path", request.URL.Path,
		"status", status,
		"duration", duration.String(),
		"bytes", bytesWritten,
		"remote_addr", clientAddress(request),
	)
}

func clientAddress(request *http.Request) string {
	forwardedFor := strings.TrimSpace(request.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	if host, _, err := net.SplitHostPort(strings.TrimSpace(request.RemoteAddr)); err == nil {
		return host
	}

	return strings.TrimSpace(request.RemoteAddr)
}

func summarizeDatabaseTarget(databaseURL string) string {
	trimmed := strings.TrimSpace(databaseURL)
	if trimmed == "" {
		return "sqlite://justgate.db"
	}

	if strings.HasPrefix(trimmed, "postgres://") || strings.HasPrefix(trimmed, "postgresql://") {
		parsed, err := url.Parse(trimmed)
		if err != nil {
			return "postgres"
		}
		databaseName := strings.TrimPrefix(parsed.Path, "/")
		if databaseName == "" {
			return fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host)
		}
		return fmt.Sprintf("%s://%s/%s", parsed.Scheme, parsed.Host, databaseName)
	}

	if strings.HasPrefix(trimmed, "sqlite://") {
		path := strings.TrimPrefix(trimmed, "sqlite://")
		if path == "" {
			path = "justgate.db"
		}
		return "sqlite://" + path
	}

	return trimmed
}

func hashToken(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func previewSecret(secret string) string {
	if len(secret) <= 14 {
		return secret
	}
	return secret[:10] + "..." + secret[len(secret)-4:]
}

func extractBearerToken(headerValue string) string {
	if headerValue == "" {
		return ""
	}

	const prefix = "Bearer "
	if !strings.HasPrefix(headerValue, prefix) {
		return ""
	}

	return strings.TrimSpace(strings.TrimPrefix(headerValue, prefix))
}

// buildTransport returns an *http.Transport that trusts the system CA pool plus
// any extra PEM-encoded certificates found in extraCAFile. When extraCAFile is
// empty the returned transport is a clone of http.DefaultTransport.
func buildTransport(extraCAFile string) (*http.Transport, error) {
	base := http.DefaultTransport.(*http.Transport).Clone()
	if extraCAFile == "" {
		return base, nil
	}

	pem, err := os.ReadFile(extraCAFile)
	if err != nil {
		return nil, err
	}

	pool, err := x509.SystemCertPool()
	if err != nil {
		pool = x509.NewCertPool()
	}
	pool.AppendCertsFromPEM(pem)

	if base.TLSClientConfig == nil {
		base.TLSClientConfig = &tls.Config{}
	}
	base.TLSClientConfig = base.TLSClientConfig.Clone()
	base.TLSClientConfig.RootCAs = pool

	return base, nil
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	if err := json.NewEncoder(writer).Encode(payload); err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
	}
}

func joinURLPath(parts ...string) string {
	trimmed := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" || part == "/" {
			continue
		}
		trimmed = append(trimmed, strings.Trim(part, "/"))
	}

	if len(trimmed) == 0 {
		return "/"
	}

	return "/" + strings.Join(trimmed, "/")
}

func getenvOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func readBodyOrEmpty(reader io.Reader) string {
	if reader == nil {
		return ""
	}
	bytes, err := io.ReadAll(reader)
	if err != nil {
		return ""
	}
	return string(bytes)
}

func decodeJSON(request *http.Request, target any) error {
	defer request.Body.Close()
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid request body")
	}
	return nil
}

func normalizeStringList(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	var list []string
	if err := json.Unmarshal(raw, &list); err == nil {
		return dedupeNonEmpty(list), nil
	}

	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return nil, err
	}

	parts := strings.Split(text, ",")
	return dedupeNonEmpty(parts), nil
}

func dedupeNonEmpty(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	clean := make([]string, 0, len(items))
	for _, item := range items {
		normalized := strings.TrimSpace(item)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		clean = append(clean, normalized)
	}
	return clean
}

func normalizeMethods(methods []string) []string {
	allowed := map[string]struct{}{
		http.MethodGet:     {},
		http.MethodPost:    {},
		http.MethodPut:     {},
		http.MethodPatch:   {},
		http.MethodDelete:  {},
		http.MethodHead:    {},
		http.MethodOptions: {},
	}

	normalized := make([]string, 0, len(methods))
	for _, method := range methods {
		upper := strings.ToUpper(strings.TrimSpace(method))
		if _, ok := allowed[upper]; ok {
			normalized = append(normalized, upper)
		}
	}
	return dedupeNonEmpty(normalized)
}

func parseTimestamp(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid timestamp")
}

func parseQueryInt(r *http.Request, key string, def int) int {
	v := strings.TrimSpace(r.URL.Query().Get(key))
	if v == "" {
		return def
	}
	n := 0
	for _, c := range v {
		if c < '0' || c > '9' {
			return def
		}
		n = n*10 + int(c-'0')
	}
	return n
}

func generateTokenSecret(name string) (string, error) {
	bytes := make([]byte, 18)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	prefix := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(name), " ", "-"))
	prefix = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return -1
	}, prefix)
	if prefix == "" {
		prefix = "token"
	}
	return fmt.Sprintf("jpg_%s_%s", prefix, base64.RawURLEncoding.EncodeToString(bytes)), nil
}
