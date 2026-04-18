package service

// extra_handlers.go — implements the new endpoints added in v3:
//
//   GET  /api/v1/admin/orgs/{orgID}/invites               list pending invites (owner)
//   GET  /api/v1/invite-preview?code=…                   public invite preview
//   PATCH /api/v1/admin/orgs/{orgID}/members/{userID}     change member role (owner)
//   POST /api/v1/admin/tokens/{tokenID}/extend            extend token expiry
//   POST /api/v1/admin/routes/{routeID}/duplicate         duplicate route
//   GET  /api/v1/admin/export                             export org config
//   POST /api/v1/admin/import                             import org config

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ── Invite list ────────────────────────────────────────────────────────

// handleListOrgInvites: GET /api/v1/admin/orgs/{orgID}/invites
// Called from handleOrgByID when subPath == "invites" and method == GET.
func (s *Service) handleListOrgInvites(writer http.ResponseWriter, request *http.Request, orgID, callerRole string) {
	if request.Method != http.MethodGet {
		// POST is handled by existing handleOrgInvites, so just list here.
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if callerRole != "owner" {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "only owners can list invites"})
		return
	}
	invites, err := s.store.ListOrgInvites(request.Context(), orgID)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list invites"})
		return
	}
	type inviteSummary struct {
		ID        string `json:"id"`
		Code      string `json:"code"`
		ExpiresAt string `json:"expiresAt"`
		MaxUses   int    `json:"maxUses"`
		UseCount  int    `json:"useCount"`
		CreatedBy string `json:"createdBy"`
		CreatedAt string `json:"createdAt"`
	}
	items := make([]inviteSummary, 0, len(invites))
	for _, inv := range invites {
		items = append(items, inviteSummary{
			ID:        inv.ID,
			Code:      inv.Code,
			ExpiresAt: inv.ExpiresAt.UTC().Format(time.RFC3339),
			MaxUses:   inv.MaxUses,
			UseCount:  inv.UseCount,
			CreatedBy: inv.CreatedBy,
			CreatedAt: inv.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	writeJSON(writer, http.StatusOK, items)
}

// handleDeleteOrgInvite: DELETE /api/v1/admin/orgs/{orgID}/invites/{inviteID}
func (s *Service) handleDeleteOrgInvite(writer http.ResponseWriter, request *http.Request, orgID, inviteID, callerRole string) {
	if request.Method != http.MethodDelete {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if callerRole != "owner" {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "only owners can revoke invites"})
		return
	}
	if err := s.store.DeleteOrgInvite(request.Context(), orgID, inviteID); err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to revoke invite"})
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

// ── Public invite preview ──────────────────────────────────────────────

// handleInvitePreview: GET /api/v1/invite-preview?code=…
// No auth required — used by /join page to show org name before accepting.
func (s *Service) handleInvitePreview(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	code := strings.TrimSpace(request.URL.Query().Get("code"))
	if code == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "code is required"})
		return
	}
	invite, ok, err := s.store.GetOrgInviteByCode(request.Context(), code)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "lookup failed"})
		return
	}
	if !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "invite not found"})
		return
	}
	if invite.ExpiresAt.Before(time.Now().UTC()) {
		writeJSON(writer, http.StatusGone, map[string]string{"error": "invite has expired"})
		return
	}
	// Fetch the org name.
	org, orgOk, orgErr := s.store.GetOrgByID(request.Context(), invite.OrgID)
	orgName := invite.OrgID
	if orgErr == nil && orgOk {
		orgName = org.Name
	}
	writeJSON(writer, http.StatusOK, map[string]any{
		"orgID":     invite.OrgID,
		"orgName":   orgName,
		"expiresAt": invite.ExpiresAt.UTC().Format(time.RFC3339),
		"maxUses":   invite.MaxUses,
		"useCount":  invite.UseCount,
	})
}

// ── Member role change ─────────────────────────────────────────────────

type changeMemberRoleRequest struct {
	Role string `json:"role"`
}

// handleChangeMemberRole: PATCH /api/v1/admin/orgs/{orgID}/members/{userID}
func (s *Service) handleChangeMemberRole(writer http.ResponseWriter, request *http.Request, orgID, memberID, callerRole string) {
	if request.Method != http.MethodPatch {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if callerRole != "owner" {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "only owners can change member roles"})
		return
	}
	var payload changeMemberRoleRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	role := strings.TrimSpace(payload.Role)
	if role != "owner" && role != "member" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "role must be 'owner' or 'member'"})
		return
	}
	if err := s.store.UpdateOrgMemberRole(request.Context(), orgID, memberID, role); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "member not found" {
			status = http.StatusNotFound
		}
		writeJSON(writer, status, map[string]string{"error": err.Error()})
		return
	}
	s.recordAdminAction(request.Context(), "change_member_role", "org_member", memberID, fmt.Sprintf("role=%s org=%s", role, orgID))
	writeJSON(writer, http.StatusOK, map[string]string{"role": role})
}

// ── Token expiry extension ─────────────────────────────────────────────

type extendTokenRequest struct {
	NewExpiresAt string `json:"newExpiresAt"`
}

// handleExtendToken: POST /api/v1/admin/tokens/{tokenID}/extend
func (s *Service) handleExtendToken(writer http.ResponseWriter, request *http.Request, tokenID string) {
	var payload extendTokenRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	payload.NewExpiresAt = strings.TrimSpace(payload.NewExpiresAt)
	if payload.NewExpiresAt == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "newExpiresAt is required"})
		return
	}
	newExpiry, err := parseTimestamp(payload.NewExpiresAt)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "newExpiresAt must be RFC3339 or datetime-local"})
		return
	}
	if !newExpiry.After(time.Now().UTC()) {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "newExpiresAt must be in the future"})
		return
	}
	token, ok, err := s.store.GetTokenByID(request.Context(), tokenID)
	if err != nil || !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "token not found"})
		return
	}
	if err := s.store.ExtendTokenExpiry(request.Context(), tokenID, newExpiry); err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to extend token"})
		return
	}
	s.recordAdminAction(request.Context(), "extend_token", "token", tokenID, fmt.Sprintf("until=%s", newExpiry.Format(time.RFC3339)))
	writeJSON(writer, http.StatusOK, tokenSummary{
		ID:             token.ID,
		Name:           token.Name,
		TenantID:       token.TenantID,
		Scopes:         token.Scopes,
		ExpiresAt:      newExpiry.Format(time.RFC3339),
		LastUsedAt:     token.LastUsedAt.Format(time.RFC3339),
		CreatedAt:      token.CreatedAt.Format(time.RFC3339),
		Preview:        token.Preview,
		Active:         token.Active,
		RateLimitRPM:   token.RateLimitRPM,
		RateLimitBurst: token.RateLimitBurst,
	})
}

// ── Route duplication ──────────────────────────────────────────────────

// handleDuplicateRoute: POST /api/v1/admin/routes/{routeID}/duplicate
func (s *Service) handleDuplicateRoute(writer http.ResponseWriter, request *http.Request, routeID string) {
	route, ok, err := s.store.GetRouteByID(request.Context(), routeID)
	if err != nil || !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "route not found"})
		return
	}
	// Build a unique slug for the copy.
	copySlug := route.Slug + "-copy"
	existing, _, _ := s.store.RouteBySlug(request.Context(), copySlug)
	if existing.ID != "" {
		copySlug = fmt.Sprintf("%s-copy-%d", route.Slug, time.Now().Unix()%10000)
	}

	payload := createRouteRequest{
		Slug:            copySlug,
		TargetPath:      route.TargetPath,
		TenantID:        route.TenantID,
		UpstreamURL:     route.UpstreamURL,
		HealthCheckPath: route.HealthCheckPath,
		RequiredScope:   route.RequiredScope,
		RateLimitRPM:    route.RateLimitRPM,
		RateLimitBurst:  route.RateLimitBurst,
		AllowCIDRs:      route.AllowCIDRs,
		DenyCIDRs:       route.DenyCIDRs,
	}
	methods := route.Methods
	if len(methods) == 0 {
		methods = []string{"GET"}
	}
	newRoute, err := s.store.CreateRoute(request.Context(), payload, methods)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	s.recordAdminAction(request.Context(), "duplicate_route", "route", newRoute.ID, fmt.Sprintf("from=%s", routeID))
	writeJSON(writer, http.StatusCreated, routeSummary{
		ID:              newRoute.ID,
		Slug:            newRoute.Slug,
		TargetPath:      newRoute.TargetPath,
		TenantID:        newRoute.TenantID,
		UpstreamURL:     newRoute.UpstreamURL,
		HealthCheckPath: newRoute.HealthCheckPath,
		RequiredScope:   newRoute.RequiredScope,
		Methods:         newRoute.Methods,
		RateLimitRPM:    newRoute.RateLimitRPM,
		RateLimitBurst:  newRoute.RateLimitBurst,
		AllowCIDRs:      newRoute.AllowCIDRs,
		DenyCIDRs:       newRoute.DenyCIDRs,
	})
}

// ── Org config export / import ─────────────────────────────────────────

type exportedOrgConfig struct {
	ExportedAt string          `json:"exportedAt"`
	Version    string          `json:"version"`
	Tenants    []tenantSummary `json:"tenants"`
	Routes     []routeSummary  `json:"routes"`
}

// handleExportOrgConfig: GET /api/v1/admin/export
func (s *Service) handleExportOrgConfig(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	tenants, err := s.store.ListTenants(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load tenants"})
		return
	}
	routes, err := s.store.ListRoutes(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load routes"})
		return
	}

	tSummaries := make([]tenantSummary, 0, len(tenants))
	for _, t := range tenants {
		tSummaries = append(tSummaries, tenantSummary{
			ID:         t.ID,
			Name:       t.Name,
			TenantID:   t.TenantID,
			AuthMode:   t.AuthMode,
			HeaderName: t.HeaderName,
			OrgID:      t.OrgID,
		})
	}
	rSummaries := make([]routeSummary, 0, len(routes))
	for _, r := range routes {
		rSummaries = append(rSummaries, routeSummary{
			ID:              r.ID,
			Slug:            r.Slug,
			TargetPath:      r.TargetPath,
			TenantID:        r.TenantID,
			UpstreamURL:     r.UpstreamURL,
			HealthCheckPath: r.HealthCheckPath,
			RequiredScope:   r.RequiredScope,
			Methods:         r.Methods,
			RateLimitRPM:    r.RateLimitRPM,
			RateLimitBurst:  r.RateLimitBurst,
			AllowCIDRs:      r.AllowCIDRs,
			DenyCIDRs:       r.DenyCIDRs,
		})
	}

	cfg := exportedOrgConfig{
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Version:    "1",
		Tenants:    tSummaries,
		Routes:     rSummaries,
	}
	b, _ := json.MarshalIndent(cfg, "", "  ")
	writer.Header().Set("Content-Type", "application/json")
	writer.Header().Set("Content-Disposition", `attachment; filename="justgate-config.json"`)
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(b)
}

type importOrgConfig struct {
	Tenants []createTenantRequest `json:"tenants"`
	Routes  []json.RawMessage     `json:"routes"`
}

type importResult struct {
	TenantsCreated int      `json:"tenantsCreated"`
	RoutesCreated  int      `json:"routesCreated"`
	Errors         []string `json:"errors"`
}

// handleImportOrgConfig: POST /api/v1/admin/import
func (s *Service) handleImportOrgConfig(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var body struct {
		Tenants []createTenantRequest `json:"tenants"`
		Routes  []createRouteRequest  `json:"routes"`
	}
	if err := decodeJSON(request, &body); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	result := importResult{}
	for i := range body.Tenants {
		payload := body.Tenants[i]
		if err := normalizeTenantPayload(&payload, s.config.TenantHeaderName); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("tenant[%d]: %s", i, err.Error()))
			continue
		}
		if _, err := s.store.CreateTenant(request.Context(), payload); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("tenant %q: %s", payload.TenantID, err.Error()))
			continue
		}
		result.TenantsCreated++
	}
	for i, rp := range body.Routes {
		rp.Slug = strings.TrimSpace(rp.Slug)
		rp.TargetPath = strings.TrimSpace(rp.TargetPath)
		rp.TenantID = strings.TrimSpace(rp.TenantID)
		rp.UpstreamURL = strings.TrimSpace(rp.UpstreamURL)
		if rp.Slug == "" || rp.TargetPath == "" || rp.TenantID == "" || rp.UpstreamURL == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("route[%d]: missing required fields", i))
			continue
		}
		methods, err := normalizeStringList(rp.Methods)
		if err != nil || len(methods) == 0 {
			methods = []string{"GET"}
		}
		methods = normalizeMethods(methods)
		if !strings.HasPrefix(rp.TargetPath, "/") {
			rp.TargetPath = "/" + rp.TargetPath
		}
		if _, err := s.store.CreateRoute(request.Context(), rp, methods); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("route %q: %s", rp.Slug, err.Error()))
			continue
		}
		result.RoutesCreated++
	}
	s.recordAdminAction(request.Context(), "import_config", "org", orgIDFromContext(request.Context()),
		fmt.Sprintf("tenants=%d routes=%d errors=%d", result.TenantsCreated, result.RoutesCreated, len(result.Errors)))
	writeJSON(writer, http.StatusOK, result)
}
