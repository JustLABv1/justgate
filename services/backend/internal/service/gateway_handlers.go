package service

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// ── Traffic analytics & overview ───────────────────────────────────────

func (s *Service) handleTrafficStats(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	hoursBack := parseQueryInt(request, "hours", 24)
	orgID := orgIDFromContext(request.Context())

	to := time.Now().UTC()
	from := to.Add(-time.Duration(hoursBack) * time.Hour)

	stats, err := s.store.ListTrafficStats(request.Context(), from, to, orgID)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load traffic stats"})
		return
	}

	writeJSON(writer, http.StatusOK, stats)
}

func (s *Service) handleTrafficOverview(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	orgID := orgIDFromContext(request.Context())
	overview, err := s.store.GetTrafficOverview(request.Context(), orgID)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load traffic overview"})
		return
	}

	writeJSON(writer, http.StatusOK, overview)
}

// ── Admin activity audit ───────────────────────────────────────────────

func (s *Service) handleAdminAudit(writer http.ResponseWriter, request *http.Request) {
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

	audits, total, err := s.store.ListAdminAuditsPaginated(request.Context(), pageSize, offset)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load admin audit"})
		return
	}

	type adminAuditEvent struct {
		ID           string `json:"id"`
		Timestamp    string `json:"timestamp"`
		UserID       string `json:"userID"`
		UserEmail    string `json:"userEmail"`
		Action       string `json:"action"`
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceID"`
		Details      string `json:"details"`
		OrgID        string `json:"orgID"`
	}

	items := make([]adminAuditEvent, 0, len(audits))
	for _, a := range audits {
		items = append(items, adminAuditEvent{
			ID:           a.ID,
			Timestamp:    a.Timestamp.Format(time.RFC3339),
			UserID:       a.UserID,
			UserEmail:    a.UserEmail,
			Action:       a.Action,
			ResourceType: a.ResourceType,
			ResourceID:   a.ResourceID,
			Details:      a.Details,
			OrgID:        a.OrgID,
		})
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"items":    items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// recordAdminAction is a helper called from admin handlers to log admin activity.
func (s *Service) recordAdminAction(ctx context.Context, action, resourceType, resourceID, details string) {
	identity := adminIdentityFromContext(ctx)
	if identity == nil {
		return
	}
	audit := adminAuditRecord{
		Timestamp:    time.Now().UTC(),
		UserID:       identity.Subject,
		UserEmail:    identity.Email,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      details,
		OrgID:        orgIDFromContext(ctx),
	}
	go func() {
		if err := s.store.RecordAdminAudit(context.Background(), audit); err != nil {
			s.logger.Error("failed to record admin audit", "error", err)
		}
	}()
}

// ── Upstream health history ────────────────────────────────────────────

func (s *Service) handleHealthHistory(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	tenantID := request.URL.Query().Get("tenantID")
	if tenantID == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "tenantID is required"})
		return
	}

	limit := parseQueryInt(request, "limit", 100)
	if limit > 1000 {
		limit = 1000
	}

	history, err := s.store.ListHealthHistory(request.Context(), tenantID, limit)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load health history"})
		return
	}

	type historyEvent struct {
		ID        string `json:"id"`
		TenantID  string `json:"tenantID"`
		Status    string `json:"status"`
		LatencyMs int    `json:"latencyMs"`
		Error     string `json:"error"`
		CheckedAt string `json:"checkedAt"`
	}

	items := make([]historyEvent, 0, len(history))
	for _, h := range history {
		items = append(items, historyEvent{
			ID:        h.ID,
			TenantID:  h.TenantID,
			Status:    h.Status,
			LatencyMs: h.LatencyMs,
			Error:     h.Error,
			CheckedAt: h.CheckedAt.Format(time.RFC3339),
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

// ── Tenant upstreams (load balancing) ──────────────────────────────────

func (s *Service) handleTenantUpstreams(writer http.ResponseWriter, request *http.Request) {
	// Extract tenantID from path: /api/v1/admin/tenant-upstreams/{tenantInternalID}
	tenantInternalID := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/tenant-upstreams/")
	tenantInternalID = strings.Trim(tenantInternalID, "/")
	if tenantInternalID == "" || strings.Contains(tenantInternalID, "/") {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "tenant not found"})
		return
	}

	// We need to look up the tenant_id (external) from the internal ID
	tenants, err := s.store.ListTenants(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to look up tenant"})
		return
	}
	var tenantID string
	for _, t := range tenants {
		if t.ID == tenantInternalID {
			tenantID = t.TenantID
			break
		}
	}
	if tenantID == "" {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "tenant not found"})
		return
	}

	switch request.Method {
	case http.MethodGet:
		upstreams, err := s.store.ListTenantUpstreams(request.Context(), tenantID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load upstreams"})
			return
		}
		items := make([]tenantSummaryUpstream, 0, len(upstreams))
		for _, u := range upstreams {
			items = append(items, tenantSummaryUpstream{
				ID:          u.ID,
				UpstreamURL: u.UpstreamURL,
				Weight:      u.Weight,
				IsPrimary:   u.IsPrimary,
			})
		}
		writeJSON(writer, http.StatusOK, items)

	case http.MethodPost:
		var payload struct {
			UpstreamURL string `json:"upstreamURL"`
			Weight      int    `json:"weight"`
			IsPrimary   bool   `json:"isPrimary"`
		}
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if payload.UpstreamURL == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "upstreamURL is required"})
			return
		}
		if payload.Weight <= 0 {
			payload.Weight = 1
		}
		upstream := tenantUpstreamRecord{
			TenantID:    tenantID,
			UpstreamURL: payload.UpstreamURL,
			Weight:      payload.Weight,
			IsPrimary:   payload.IsPrimary,
		}
		if err := s.store.CreateTenantUpstream(request.Context(), upstream); err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to create upstream"})
			return
		}
		s.recordAdminAction(request.Context(), "create_upstream", "tenant_upstream", tenantID, payload.UpstreamURL)
		writer.WriteHeader(http.StatusCreated)

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleTenantUpstreamByID(writer http.ResponseWriter, request *http.Request) {
	// Path: /api/v1/admin/tenant-upstream/{upstreamID}
	upstreamID := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/tenant-upstream/")
	upstreamID = strings.Trim(upstreamID, "/")
	if upstreamID == "" || strings.Contains(upstreamID, "/") {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	switch request.Method {
	case http.MethodPatch:
		var payload struct {
			UpstreamURL string `json:"upstreamURL"`
			Weight      int    `json:"weight"`
			IsPrimary   bool   `json:"isPrimary"`
		}
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if payload.UpstreamURL == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "upstreamURL is required"})
			return
		}
		if payload.Weight <= 0 {
			payload.Weight = 1
		}
		if err := s.store.UpdateTenantUpstream(request.Context(), upstreamID, payload.UpstreamURL, payload.Weight, payload.IsPrimary); err != nil {
			status := http.StatusInternalServerError
			if err.Error() == "upstream not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		s.recordAdminAction(request.Context(), "update_upstream", "tenant_upstream", upstreamID, payload.UpstreamURL)
		writer.WriteHeader(http.StatusNoContent)

	case http.MethodDelete:
		if err := s.store.DeleteTenantUpstream(request.Context(), upstreamID); err != nil {
			status := http.StatusInternalServerError
			if err.Error() == "upstream not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		s.recordAdminAction(request.Context(), "delete_upstream", "tenant_upstream", upstreamID, "")
		writer.WriteHeader(http.StatusNoContent)

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// ── Session management ─────────────────────────────────────────────────

func (s *Service) handleSessions(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	identity := adminIdentityFromContext(request.Context())
	if identity == nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	sessions, err := s.store.ListAdminSessions(request.Context(), identity.Subject)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load sessions"})
		return
	}

	type sessionEvent struct {
		ID         string `json:"id"`
		IPAddress  string `json:"ipAddress"`
		UserAgent  string `json:"userAgent"`
		CreatedAt  string `json:"createdAt"`
		LastSeenAt string `json:"lastSeenAt"`
		Revoked    bool   `json:"revoked"`
	}

	items := make([]sessionEvent, 0, len(sessions))
	for _, s := range sessions {
		items = append(items, sessionEvent{
			ID:         s.ID,
			IPAddress:  s.IPAddress,
			UserAgent:  s.UserAgent,
			CreatedAt:  s.CreatedAt.Format(time.RFC3339),
			LastSeenAt: s.LastSeenAt.Format(time.RFC3339),
			Revoked:    s.Revoked,
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

func (s *Service) handleSessionRevoke(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	sessionID := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/sessions/")
	sessionID = strings.TrimSuffix(sessionID, "/revoke")
	if sessionID == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "session ID required"})
		return
	}

	if err := s.store.RevokeAdminSession(request.Context(), sessionID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "session not found" {
			status = http.StatusNotFound
		}
		writeJSON(writer, status, map[string]string{"error": err.Error()})
		return
	}

	writer.WriteHeader(http.StatusNoContent)
}

// ── Multi-region / Replica status ──────────────────────────────────────

func (s *Service) handleReplicas(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	heartbeats, err := s.store.ListInstanceHeartbeats(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load replicas"})
		return
	}

	type replicaInfo struct {
		InstanceID      string `json:"instanceID"`
		Region          string `json:"region"`
		Hostname        string `json:"hostname"`
		Version         string `json:"version"`
		StartedAt       string `json:"startedAt"`
		LastHeartbeatAt string `json:"lastHeartbeatAt"`
		Status          string `json:"status"`
	}

	now := time.Now().UTC()
	items := make([]replicaInfo, 0, len(heartbeats))
	for _, h := range heartbeats {
		status := "online"
		if now.Sub(h.LastHeartbeatAt) > 2*time.Minute {
			status = "offline"
		} else if now.Sub(h.LastHeartbeatAt) > 30*time.Second {
			status = "degraded"
		}
		items = append(items, replicaInfo{
			InstanceID:      h.InstanceID,
			Region:          h.Region,
			Hostname:        h.Hostname,
			Version:         h.Version,
			StartedAt:       h.StartedAt.Format(time.RFC3339),
			LastHeartbeatAt: h.LastHeartbeatAt.Format(time.RFC3339),
			Status:          status,
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

// runHeartbeat periodically updates this instance's heartbeat record.
func (s *Service) runHeartbeat() {
	instanceID := s.config.InstanceID
	if instanceID == "" {
		instanceID = newResourceID("inst")
	}
	region := s.config.Region
	if region == "" {
		region = "default"
	}
	hostname, _ := os.Hostname()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	send := func() {
		if err := s.store.UpsertInstanceHeartbeat(context.Background(), instanceHeartbeatRecord{
			InstanceID:      instanceID,
			Region:          region,
			Hostname:        hostname,
			Version:         s.config.Version,
			StartedAt:       s.start,
			LastHeartbeatAt: time.Now().UTC(),
		}); err != nil {
			s.logger.Error("failed to send heartbeat", "error", err)
		}
	}

	send()
	for {
		select {
		case <-ticker.C:
			send()
		case <-s.stop:
			return
		}
	}
}

// ── Circuit breaker status API ─────────────────────────────────────────

func (s *Service) handleCircuitBreakers(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	routes, err := s.store.ListRoutes(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load routes"})
		return
	}

	type cbStatus struct {
		RouteID  string `json:"routeID"`
		Slug     string `json:"slug"`
		TenantID string `json:"tenantID"`
		State    string `json:"state"`
	}

	items := make([]cbStatus, 0, len(routes))
	for _, r := range routes {
		items = append(items, cbStatus{
			RouteID:  r.ID,
			Slug:     r.Slug,
			TenantID: r.TenantID,
			State:    s.circuitBreakers.GetState(r.ID),
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

// ── Token expiry / lifecycle ───────────────────────────────────────────

func (s *Service) handleExpiringTokens(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	daysAhead := parseQueryInt(request, "days", 7)
	before := time.Now().UTC().Add(time.Duration(daysAhead) * 24 * time.Hour)

	tokens, err := s.store.ListExpiringTokens(request.Context(), before)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load expiring tokens"})
		return
	}

	items := make([]tokenSummary, 0, len(tokens))
	for _, t := range tokens {
		items = append(items, tokenSummary{
			ID:             t.ID,
			Name:           t.Name,
			TenantID:       t.TenantID,
			Scopes:         t.Scopes,
			ExpiresAt:      t.ExpiresAt.Format(time.RFC3339),
			LastUsedAt:     t.LastUsedAt.Format(time.RFC3339),
			Preview:        t.Preview,
			Active:         t.Active,
			RateLimitRPM:   t.RateLimitRPM,
			RateLimitBurst: t.RateLimitBurst,
		})
	}

	writeJSON(writer, http.StatusOK, items)
}

// ── Route tester ───────────────────────────────────────────────────────

func (s *Service) handleRouteTest(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var payload routeTestRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if payload.Path == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "path is required"})
		return
	}
	if payload.Method == "" {
		payload.Method = http.MethodGet
	}

	// Build the proxy URL targeting our own proxy endpoint
	proxyPath := "/proxy/" + strings.TrimPrefix(payload.Path, "/")
	targetURL := "http://localhost:9090" + proxyPath
	parsed, err := url.Parse(targetURL)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid path"})
		return
	}

	var body io.Reader
	if payload.Body != "" {
		body = strings.NewReader(payload.Body)
	}
	testReq, err := http.NewRequestWithContext(request.Context(), payload.Method, parsed.String(), body)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "failed to construct test request"})
		return
	}

	// Forward token
	if payload.TokenSecret != "" {
		testReq.Header.Set("Authorization", "Bearer "+payload.TokenSecret)
	}
	for k, v := range payload.Headers {
		testReq.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := s.transport.RoundTrip(testReq)
	latency := int(time.Since(start).Milliseconds())
	if err != nil {
		writeJSON(writer, http.StatusBadGateway, routeTestResponse{
			Status:    0,
			LatencyMs: latency,
			Body:      err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	respHeaders := make(map[string]string)
	for k := range resp.Header {
		respHeaders[k] = resp.Header.Get(k)
	}

	writeJSON(writer, http.StatusOK, routeTestResponse{
		Status:    resp.StatusCode,
		Headers:   respHeaders,
		Body:      string(respBody),
		LatencyMs: latency,
	})
}

// ── Live audit stream (WebSocket) ──────────────────────────────────────

var auditStreamUpgrader = websocket.Upgrader{
	CheckOrigin: func(_ *http.Request) bool { return true },
}

func (s *Service) handleAuditStream(writer http.ResponseWriter, request *http.Request) {
	tokenValue := extractBearerToken(request.Header.Get("Authorization"))
	if tokenValue == "" {
		tokenValue = strings.TrimSpace(request.URL.Query().Get("access_token"))
	}
	if _, err := validateAdminToken(tokenValue, s.config.AdminJWTSecret); err != nil {
		writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	conn, err := auditStreamUpgrader.Upgrade(writer, request, nil)
	if err != nil {
		s.logger.Error("audit stream websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	ch := s.auditSubscribers.Subscribe()
	defer s.auditSubscribers.Unsubscribe(ch)

	// Read pump: just drain client messages
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	for data := range ch {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			return
		}
	}
}

// ── Filtered audit endpoint ────────────────────────────────────────────

func (s *Service) handleAuditFiltered(writer http.ResponseWriter, request *http.Request) {
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

	filters := auditFilters{
		TenantID:  request.URL.Query().Get("tenantID"),
		RouteSlug: request.URL.Query().Get("routeSlug"),
		TokenID:   request.URL.Query().Get("tokenID"),
		Status:    request.URL.Query().Get("status"),
	}
	if fromStr := request.URL.Query().Get("from"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			filters.From = t
		}
	}
	if toStr := request.URL.Query().Get("to"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			filters.To = t
		}
	}

	audits, total, err := s.store.ListAuditsPaginatedFiltered(request.Context(), pageSize, offset, filters)
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
			LatencyMs: audit.LatencyMs,
		})
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"items":    items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// ── Global search endpoint ─────────────────────────────────────────────

func (s *Service) handleSearch(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	q := strings.TrimSpace(request.URL.Query().Get("q"))
	if q == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "q parameter is required"})
		return
	}

	ctx := request.Context()
	lower := strings.ToLower(q)

	type searchResults struct {
		Routes  []routeSummary  `json:"routes"`
		Tenants []tenantSummary `json:"tenants"`
		Tokens  []tokenSummary  `json:"tokens"`
	}

	out := searchResults{
		Routes:  []routeSummary{},
		Tenants: []tenantSummary{},
		Tokens:  []tokenSummary{},
	}

	// Search routes
	routes, _ := s.store.ListRoutes(ctx)
	for _, r := range routes {
		if strings.Contains(strings.ToLower(r.Slug), lower) || strings.Contains(strings.ToLower(r.TargetPath), lower) {
			out.Routes = append(out.Routes, routeSummary{
				ID:             r.ID,
				Slug:           r.Slug,
				TargetPath:     r.TargetPath,
				TenantID:       r.TenantID,
				RequiredScope:  r.RequiredScope,
				Methods:        r.Methods,
				RateLimitRPM:   r.RateLimitRPM,
				RateLimitBurst: r.RateLimitBurst,
				AllowCIDRs:     r.AllowCIDRs,
				DenyCIDRs:      r.DenyCIDRs,
			})
		}
	}

	// Search tenants
	tenants, _ := s.store.ListTenants(ctx)
	for _, t := range tenants {
		if strings.Contains(strings.ToLower(t.Name), lower) || strings.Contains(strings.ToLower(t.TenantID), lower) {
			out.Tenants = append(out.Tenants, tenantSummary{
				ID:              t.ID,
				Name:            t.Name,
				TenantID:        t.TenantID,
				Upstream:        t.Upstream,
				AuthMode:        t.AuthMode,
				HeaderName:      t.HeaderName,
				HealthCheckPath: t.HealthCheckPath,
			})
		}
	}

	// Search tokens
	tokens, _ := s.store.ListTokens(ctx)
	for _, t := range tokens {
		if strings.Contains(strings.ToLower(t.Name), lower) || strings.Contains(strings.ToLower(t.ID), lower) {
			out.Tokens = append(out.Tokens, tokenSummary{
				ID:             t.ID,
				Name:           t.Name,
				TenantID:       t.TenantID,
				Scopes:         t.Scopes,
				ExpiresAt:      t.ExpiresAt.Format(time.RFC3339),
				LastUsedAt:     t.LastUsedAt.Format(time.RFC3339),
				Preview:        t.Preview,
				Active:         t.Active,
				RateLimitRPM:   t.RateLimitRPM,
				RateLimitBurst: t.RateLimitBurst,
			})
		}
	}

	writeJSON(writer, http.StatusOK, out)
}
