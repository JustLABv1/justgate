package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type Config struct {
	Version         string
	StoreKind       string
	AdminJWTSecret  string
	DatabaseURL     string
	MimirHeaderName string
}

type dataStore interface {
	ListTenants(ctx context.Context) ([]tenantRecord, error)
	ListRoutes(ctx context.Context) ([]routeRecord, error)
	ListTokens(ctx context.Context) ([]tokenRecord, error)
	ListAudits(ctx context.Context) ([]auditRecord, error)
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
}

type Service struct {
	config Config
	store  dataStore
	start  time.Time
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
	ID         string `json:"id"`
	Name       string `json:"name"`
	TenantID   string `json:"tenantID"`
	Upstream   string `json:"upstreamURL"`
	AuthMode   string `json:"authMode"`
	HeaderName string `json:"headerName"`
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
	GeneratedAt string        `json:"generatedAt"`
	Runtime     runtimeState  `json:"runtime"`
	Stats       stats         `json:"stats"`
	Tenants     []tenantSummary `json:"tenants"`
	Routes      []routeSummary  `json:"routes"`
	Tokens      []tokenSummary  `json:"tokens"`
	AuditEvents []auditEvent    `json:"auditEvents"`
}

type createTenantRequest struct {
	Name       string `json:"name"`
	TenantID   string `json:"tenantID"`
	Upstream   string `json:"upstreamURL"`
	AuthMode   string `json:"authMode"`
	HeaderName string `json:"headerName"`
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
	ID         string
	Name       string
	TenantID   string
	Upstream   string
	AuthMode   string
	HeaderName string
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

func New(config Config) (*Service, error) {
	if config.Version == "" {
		config.Version = "dev"
	}
	if config.AdminJWTSecret == "" {
		config.AdminJWTSecret = "just-proxy-guard-local-backend-jwt-secret"
	}
	if config.DatabaseURL == "" {
		config.DatabaseURL = defaultDatabaseURL()
	}
	if config.MimirHeaderName == "" {
		config.MimirHeaderName = "X-Scope-OrgID"
	}
	storeKind, store, err := newSQLStore(config.DatabaseURL, config.MimirHeaderName)
	if err != nil {
		return nil, err
	}
	config.StoreKind = storeKind

	return &Service{
		config: config,
		store:  store,
		start:  time.Now().UTC(),
	}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/api/v1/auth/local/register", s.handleRegisterLocalAdmin)
	mux.HandleFunc("/api/v1/auth/local/verify", s.handleVerifyLocalAdmin)
	mux.HandleFunc("/api/v1/admin/overview", s.withAdminAuth(s.handleOverview))
	mux.HandleFunc("/api/v1/admin/routes", s.withAdminAuth(s.handleRoutes))
	mux.HandleFunc("/api/v1/admin/routes/", s.withAdminAuth(s.handleRouteByID))
	mux.HandleFunc("/api/v1/admin/tenants", s.withAdminAuth(s.handleTenants))
	mux.HandleFunc("/api/v1/admin/tenants/", s.withAdminAuth(s.handleTenantByID))
	mux.HandleFunc("/api/v1/admin/tokens", s.withAdminAuth(s.handleTokens))
	mux.HandleFunc("/api/v1/admin/tokens/", s.withAdminAuth(s.handleTokenByID))
	mux.HandleFunc("/api/v1/admin/audit", s.withAdminAuth(s.handleAudit))
	mux.HandleFunc("/api/v1/admin/topology", s.withAdminAuth(s.handleTopology))
	mux.HandleFunc("/api/v1/admin/topology/stream", s.handleTopologyStream)
	mux.HandleFunc("/proxy/", s.handleProxy)

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}

		mux.ServeHTTP(writer, request)
	})
}

var topologyUpgrader = websocket.Upgrader{
	CheckOrigin: func(_ *http.Request) bool { return true },
}

func (s *Service) withAdminAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		tokenValue := extractBearerToken(request.Header.Get("Authorization"))
		if _, err := validateAdminToken(tokenValue, s.config.AdminJWTSecret); err != nil {
			writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": err.Error()})
			return
		}
		next(writer, request)
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
	if !ok || verifyLocalAccountPassword(account.PasswordHash, payload.Password) != nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	writeJSON(writer, http.StatusOK, map[string]string{
		"id":    account.ID,
		"email": account.Email,
		"name":  account.Name,
	})
}

func (s *Service) handleOverview(writer http.ResponseWriter, request *http.Request) {
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
			ID:         tenant.ID,
			Name:       tenant.Name,
			TenantID:   tenant.TenantID,
			Upstream:   tenant.Upstream,
			AuthMode:   tenant.AuthMode,
			HeaderName: tenant.HeaderName,
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

	audits, err := s.store.ListAudits(request.Context())
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

	slices.SortFunc(items, func(left, right auditEvent) int {
		switch {
		case left.Timestamp > right.Timestamp:
			return -1
		case left.Timestamp < right.Timestamp:
			return 1
		default:
			return 0
		}
	})

	writeJSON(writer, http.StatusOK, items)
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
	if _, err := validateAdminToken(tokenValue, s.config.AdminJWTSecret); err != nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

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
	for _, tenant := range tenants {
		tenantItems = append(tenantItems, tenantSummary{
			ID:         tenant.ID,
			Name:       tenant.Name,
			TenantID:   tenant.TenantID,
			Upstream:   tenant.Upstream,
			AuthMode:   tenant.AuthMode,
			HeaderName: tenant.HeaderName,
		})
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

func normalizeTenantPayload(payload *createTenantRequest, defaultHeaderName string) error {
	payload.Name = strings.TrimSpace(payload.Name)
	payload.TenantID = strings.TrimSpace(payload.TenantID)
	payload.Upstream = strings.TrimSpace(payload.Upstream)
	payload.HeaderName = strings.TrimSpace(payload.HeaderName)
	payload.AuthMode = strings.TrimSpace(payload.AuthMode)

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

	if err := normalizeTenantPayload(&payload, s.config.MimirHeaderName); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	tenant, err := s.store.CreateTenant(request.Context(), payload)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(writer, http.StatusCreated, tenantSummary{
		ID:         tenant.ID,
		Name:       tenant.Name,
		TenantID:   tenant.TenantID,
		Upstream:   tenant.Upstream,
		AuthMode:   tenant.AuthMode,
		HeaderName: tenant.HeaderName,
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
		if err := normalizeTenantPayload(&payload, s.config.MimirHeaderName); err != nil {
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
			ID:         tenant.ID,
			Name:       tenant.Name,
			TenantID:   tenant.TenantID,
			Upstream:   tenant.Upstream,
			AuthMode:   tenant.AuthMode,
			HeaderName: tenant.HeaderName,
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
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to resolve route"})
		return
	}
	if !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "unknown route slug"})
		return
	}

	if !slices.Contains(route.Methods, request.Method) {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed for route"})
		return
	}

	tokenValue := extractBearerToken(request.Header.Get("Authorization"))
	if tokenValue == "" {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "missing bearer token"})
		return
	}

	token, ok, err := s.store.ValidateToken(request.Context(), tokenValue)
	if err != nil {
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
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, http.StatusBadGateway, route.UpstreamURL)
		writeJSON(writer, http.StatusBadGateway, map[string]string{"error": "invalid upstream configuration"})
		return
	}

	remainingPath := ""
	if len(parts) == 2 {
		remainingPath = "/" + parts[1]
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	originalDirector := proxy.Director
	proxy.Director = func(proxyRequest *http.Request) {
		originalDirector(proxyRequest)
		proxyRequest.URL.Path = joinURLPath(targetURL.Path, route.TargetPath, remainingPath)
		proxyRequest.Host = targetURL.Host
		proxyRequest.Header.Set(s.config.MimirHeaderName, token.TenantID)
		proxyRequest.Header.Set("X-Proxy-Route", route.Slug)
		proxyRequest.Header.Set("X-Proxy-Token", token.ID)
	}
	proxy.ModifyResponse = func(response *http.Response) error {
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, response.StatusCode, response.Request.URL.String())
		return nil
	}
	proxy.ErrorHandler = func(proxyWriter http.ResponseWriter, proxyRequest *http.Request, proxyErr error) {
		s.recordAudit(request.Context(), parts[0], token.TenantID, token.ID, request.Method, http.StatusBadGateway, route.UpstreamURL)
		writeJSON(proxyWriter, http.StatusBadGateway, map[string]string{
			"error":   "upstream request failed",
			"details": proxyErr.Error(),
		})
	}

	proxy.ServeHTTP(writer, request)
}

func (s *Service) recordAudit(ctx context.Context, routeSlug, tenantID, tokenID, method string, status int, upstreamURL string) {
	_ = s.store.RecordAudit(ctx, auditRecord{
		Timestamp: time.Now().UTC(),
		RouteSlug: routeSlug,
		TenantID:  tenantID,
		TokenID:   tokenID,
		Method:    method,
		Status:    status,
		Upstream:  upstreamURL,
	})
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
