package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ── Protected Apps admin CRUD ──────────────────────────────────────────

func appSummaryFromRecord(app protectedAppRecord) appSummary {
	return appSummary{
		ID:              app.ID,
		Name:            app.Name,
		Slug:            app.Slug,
		UpstreamURL:     app.UpstreamURL,
		AuthMode:        app.AuthMode,
		InjectHeaders:   app.InjectHeaders,
		StripHeaders:    app.StripHeaders,
		ExtraCAPEM:      app.ExtraCAPEM,
		RateLimitRPM:    app.RateLimitRPM,
		RateLimitBurst:  app.RateLimitBurst,
		RateLimitPer:    app.RateLimitPer,
		AllowCIDRs:      app.AllowCIDRs,
		DenyCIDRs:       app.DenyCIDRs,
		HealthCheckPath: app.HealthCheckPath,
		CreatedAt:       app.CreatedAt.Format(time.RFC3339),
	}
}

func validateCreateAppRequest(payload createAppRequest) error {
	if strings.TrimSpace(payload.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if strings.TrimSpace(payload.Slug) == "" {
		return fmt.Errorf("slug is required")
	}
	if payload.Slug == "_auth" || strings.HasPrefix(payload.Slug, "_auth/") {
		return fmt.Errorf("slug '_auth' is reserved")
	}
	if strings.TrimSpace(payload.UpstreamURL) == "" {
		return fmt.Errorf("upstreamURL is required")
	}
	mode := payload.AuthMode
	if mode != "" && mode != "oidc" && mode != "bearer" && mode != "any" && mode != "none" {
		return fmt.Errorf("authMode must be one of: oidc, bearer, any, none")
	}
	per := payload.RateLimitPer
	if per != "" && per != "session" && per != "ip" && per != "token" {
		return fmt.Errorf("rateLimitPer must be one of: session, ip, token")
	}
	return nil
}

func (s *Service) handleApps(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		orgID := orgIDFromContext(request.Context())
		apps, err := s.store.ListProtectedApps(request.Context(), orgID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list protected apps"})
			return
		}
		summaries := make([]appSummary, 0, len(apps))
		for _, a := range apps {
			summaries = append(summaries, appSummaryFromRecord(a))
		}
		writeJSON(writer, http.StatusOK, summaries)

	case http.MethodPost:
		var payload createAppRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if err := validateCreateAppRequest(payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if payload.InjectHeaders == nil {
			payload.InjectHeaders = []headerInjectionRule{}
		}
		if payload.StripHeaders == nil {
			payload.StripHeaders = []string{}
		}
		if payload.AuthMode == "" {
			payload.AuthMode = "oidc"
		}
		if payload.RateLimitPer == "" {
			payload.RateLimitPer = "session"
		}
		orgID := orgIDFromContext(request.Context())
		adminID := adminIDFromContext(request.Context())
		app, err := s.store.CreateProtectedApp(request.Context(), payload, orgID, adminID)
		if err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusCreated, appSummaryFromRecord(app))

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleAppByID(writer http.ResponseWriter, request *http.Request) {
	// Path: /api/v1/admin/apps/{appID}
	// Sub-resources:  /api/v1/admin/apps/{appID}/tokens[/{tokenID}]
	//                 /api/v1/admin/apps/{appID}/sessions[/{sessionID}]
	trimmed := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/apps/")
	parts := strings.SplitN(trimmed, "/", 3)
	appID := parts[0]
	if appID == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "missing app ID"})
		return
	}

	if len(parts) >= 2 {
		switch parts[1] {
		case "tokens":
			tokenID := ""
			if len(parts) == 3 {
				tokenID = parts[2]
			}
			s.handleAppTokens(writer, request, appID, tokenID)
			return
		case "sessions":
			sessionID := ""
			if len(parts) == 3 {
				sessionID = parts[2]
			}
			s.handleAppSessions(writer, request, appID, sessionID)
			return
		}
	}

	switch request.Method {
	case http.MethodGet:
		app, ok, err := s.store.GetProtectedApp(request.Context(), appID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to get app"})
			return
		}
		if !ok {
			writeJSON(writer, http.StatusNotFound, map[string]string{"error": "app not found"})
			return
		}
		writeJSON(writer, http.StatusOK, appSummaryFromRecord(app))

	case http.MethodPut:
		var payload createAppRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if err := validateCreateAppRequest(payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if payload.InjectHeaders == nil {
			payload.InjectHeaders = []headerInjectionRule{}
		}
		if payload.StripHeaders == nil {
			payload.StripHeaders = []string{}
		}
		if payload.AuthMode == "" {
			payload.AuthMode = "oidc"
		}
		if payload.RateLimitPer == "" {
			payload.RateLimitPer = "session"
		}
		app, err := s.store.UpdateProtectedApp(request.Context(), appID, payload)
		if err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		// Evict cached transport if CA PEM changed
		s.appTransports.Delete(appID)
		writeJSON(writer, http.StatusOK, appSummaryFromRecord(app))

	case http.MethodDelete:
		if err := s.store.DeleteProtectedApp(request.Context(), appID); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		s.appTransports.Delete(appID)
		writeJSON(writer, http.StatusNoContent, nil)

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// ── App tokens sub-resource ────────────────────────────────────────────

func (s *Service) handleAppTokens(writer http.ResponseWriter, request *http.Request, appID, tokenID string) {
	if tokenID != "" {
		// DELETE /api/v1/admin/apps/{appID}/tokens/{tokenID}
		if request.Method != http.MethodDelete {
			writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if err := s.store.DeleteAppToken(request.Context(), tokenID); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusNoContent, nil)
		return
	}

	switch request.Method {
	case http.MethodGet:
		tokens, err := s.store.ListAppTokens(request.Context(), appID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list tokens"})
			return
		}
		summaries := make([]appTokenSummary, 0, len(tokens))
		for _, t := range tokens {
			summaries = append(summaries, appTokenSummaryFromRecord(t))
		}
		writeJSON(writer, http.StatusOK, summaries)

	case http.MethodPost:
		var payload createAppTokenRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			return
		}
		if strings.TrimSpace(payload.Name) == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		secret, err := generateTokenSecret(payload.Name)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
			return
		}
		expiresAt, err := parseAppExpiry(payload.ExpiresAt)
		if err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid expiresAt: " + err.Error()})
			return
		}
		token, err := s.store.CreateAppToken(request.Context(), appID, payload.Name, secret, payload.RateLimitRPM, payload.RateLimitBurst, expiresAt)
		if err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusCreated, issuedAppTokenResponse{
			Token:  appTokenSummaryFromRecord(token),
			Secret: secret,
		})

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// ── App sessions sub-resource ──────────────────────────────────────────

func (s *Service) handleAppSessions(writer http.ResponseWriter, request *http.Request, appID, sessionID string) {
	if sessionID != "" {
		// DELETE /api/v1/admin/apps/{appID}/sessions/{sessionID}
		if request.Method != http.MethodDelete {
			writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if err := s.store.RevokeAppSession(request.Context(), sessionID); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusNoContent, nil)
		return
	}

	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	sessions, err := s.store.ListAppSessions(request.Context(), appID)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list sessions"})
		return
	}
	summaries := make([]appSessionSummary, 0, len(sessions))
	for _, s := range sessions {
		summaries = append(summaries, appSessionSummary{
			ID:         s.ID,
			UserSub:    s.UserSub,
			UserEmail:  s.UserEmail,
			UserName:   s.UserName,
			IP:         s.IP,
			CreatedAt:  s.CreatedAt.Format(time.RFC3339),
			ExpiresAt:  s.ExpiresAt.Format(time.RFC3339),
			LastUsedAt: s.LastUsedAt.Format(time.RFC3339),
		})
	}
	writeJSON(writer, http.StatusOK, summaries)
}

// ── Helper types / functions ───────────────────────────────────────────

func appTokenSummaryFromRecord(t appTokenRecord) appTokenSummary {
	return appTokenSummary{
		ID:             t.ID,
		Name:           t.Name,
		AppID:          t.AppID,
		Preview:        t.Preview,
		Active:         t.Active,
		RateLimitRPM:   t.RateLimitRPM,
		RateLimitBurst: t.RateLimitBurst,
		ExpiresAt:      t.ExpiresAt.Format(time.RFC3339),
		LastUsedAt:     t.LastUsedAt.Format(time.RFC3339),
		CreatedAt:      t.CreatedAt.Format(time.RFC3339),
	}
}

func parseAppExpiry(s string) (time.Time, error) {
	if s == "" || s == "never" {
		return time.Now().UTC().Add(100 * 365 * 24 * time.Hour), nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}
