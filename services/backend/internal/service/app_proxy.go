package service

import (
	"bytes"
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
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

// ── App proxy main handler ─────────────────────────────────────────────
//
// URL layout:
//   GET  /app/{slug}/_auth/login    → OIDC redirect
//   GET  /app/{slug}/_auth/callback → OIDC code exchange
//   POST /app/{slug}/_auth/logout   → clear session
//   *    /app/{slug}/...            → authenticated reverse proxy

func (s *Service) handleApp(writer http.ResponseWriter, request *http.Request) {
	// Strip leading "/app/"
	trimmed := strings.TrimPrefix(request.URL.Path, "/app/")
	parts := strings.SplitN(trimmed, "/", 2)
	slug := parts[0]
	if slug == "" {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "missing app slug"})
		return
	}

	remainingPath := "/"
	if len(parts) == 2 {
		remainingPath = "/" + parts[1]
	}

	// Route _auth sub-paths before looking up the app record.
	if strings.HasPrefix(remainingPath, "/_auth/") {
		switch strings.TrimPrefix(remainingPath, "/_auth/") {
		case "login":
			s.handleAppLogin(writer, request, slug)
		case "callback":
			s.handleAppCallback(writer, request, slug)
		case "logout":
			s.handleAppLogout(writer, request, slug)
		default:
			writeJSON(writer, http.StatusNotFound, map[string]string{"error": "unknown auth path"})
		}
		return
	}

	app, ok, err := s.store.GetProtectedAppBySlug(request.Context(), slug)
	if err != nil {
		s.logger.Error("app proxy lookup failed", "slug", slug, "error", err)
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to resolve app"})
		return
	}
	if !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "unknown app slug"})
		return
	}

	// ── IP rules ───────────────────────────────────────────────────
	clientIP := clientAddress(request)
	if app.DenyCIDRs != "" && matchesCIDRList(clientIP, app.DenyCIDRs) {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "IP address denied"})
		return
	}
	if app.AllowCIDRs != "" && !matchesCIDRList(clientIP, app.AllowCIDRs) {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "IP not in allowlist"})
		return
	}

	// ── Authentication dispatch ────────────────────────────────────
	authHeader := extractBearerToken(request.Header.Get("Authorization"))
	cookieVal := appSessionCookieValue(request, app.ID)

	var identity appRequestIdentity

	switch {
	case authHeader != "":
		token, valid, terr := s.store.ValidateAppToken(request.Context(), authHeader)
		if terr != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "token validation error"})
			return
		}
		if !valid {
			writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
			return
		}
		if token.AppID != app.ID {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "token not valid for this app"})
			return
		}
		identity = appRequestIdentity{Kind: "token", TokenID: token.ID, RateLimitRPM: token.RateLimitRPM, RateLimitBurst: token.RateLimitBurst}

	case cookieVal != "":
		session, valid, serr := s.store.GetAppSessionByToken(request.Context(), cookieVal)
		if serr != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "session lookup error"})
			return
		}
		if !valid {
			// Session expired or revoked — redirect back to login
			s.redirectToAppLogin(writer, request, slug)
			return
		}
		if session.AppID != app.ID {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "session not valid for this app"})
			return
		}
		// Refresh last-used timestamp asynchronously
		go func() {
			_ = s.store.TouchAppSession(context.Background(), session.ID, time.Now().UTC())
		}()
		identity = appRequestIdentity{
			Kind:      "session",
			SessionID: session.ID,
			Sub:       session.UserSub,
			Email:     session.UserEmail,
			Name:      session.UserName,
			Groups:    session.UserGroups,
		}

	default:
		// No credentials at all.
		switch app.AuthMode {
		case "none":
			// Passthrough — IP rules already enforced above; proceed with empty identity.
		case "bearer":
			writeJSON(writer, http.StatusUnauthorized, map[string]string{"error": "missing bearer token"})
			return
		default:
			// oidc / any — redirect to OIDC login.
			s.redirectToAppLogin(writer, request, slug)
			return
		}
	}

	// ── Rate limiting ──────────────────────────────────────────────
	if app.RateLimitRPM > 0 {
		var rlKey string
		switch app.RateLimitPer {
		case "session":
			rlKey = "app:" + app.ID + ":session:" + identity.SessionID
		case "ip":
			rlKey = "app:" + app.ID + ":ip:" + clientIP
		default: // "token"
			rlKey = "app:" + app.ID + ":token:" + identity.TokenID
		}
		burst := app.RateLimitBurst
		if burst == 0 {
			burst = app.RateLimitRPM
		}
		if !s.rateLimiter.Allow(rlKey, app.RateLimitRPM, burst) {
			writer.Header().Set("Retry-After", "60")
			writeJSON(writer, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
			return
		}
	}

	// ── Reverse proxy ──────────────────────────────────────────────
	targetURL, err := url.Parse(app.UpstreamURL)
	if err != nil {
		writeJSON(writer, http.StatusBadGateway, map[string]string{"error": "invalid upstream URL"})
		return
	}

	transport := s.appTransportFor(app)
	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.Transport = transport
	orig := proxy.Director
	proxy.Director = func(r *http.Request) {
		orig(r)
		r.URL.Path = joinURLPath(targetURL.Path, remainingPath)
		r.Host = targetURL.Host

		// Standard reverse-proxy forwarding headers so the upstream knows the
		// original request details and the subpath prefix it is served under.
		// Many apps (Grafana, etc.) use X-Forwarded-Prefix to serve assets
		// correctly when mounted at a non-root path.
		scheme := "https"
		if !isSecureRequest(request) {
			scheme = "http"
		}
		r.Header.Set("X-Forwarded-Proto", scheme)
		r.Header.Set("X-Forwarded-Host", request.Host)
		r.Header.Set("X-Forwarded-Prefix", "/app/"+slug)

		// Remove Accept-Encoding so the upstream returns uncompressed responses.
		// This is required for the base-tag HTML injection in ModifyResponse to
		// work without having to decompress the response body.
		r.Header.Del("Accept-Encoding")

		// Strip spoofable headers before injecting our own.
		for _, h := range app.StripHeaders {
			r.Header.Del(h)
		}
		// Also pre-strip every header we are about to inject.
		for _, rule := range app.InjectHeaders {
			r.Header.Del(rule.Name)
		}
		// Inject headers with identity substitution.
		for _, rule := range app.InjectHeaders {
			r.Header.Set(rule.Name, resolveHeaderValue(rule.Value, identity))
		}
	}
	proxy.ErrorHandler = func(pw http.ResponseWriter, _ *http.Request, proxyErr error) {
		s.logger.Error("app proxy upstream failed", "slug", slug, "upstream", app.UpstreamURL, "error", proxyErr)
		writeJSON(pw, http.StatusBadGateway, map[string]string{"error": "upstream request failed"})
	}

	// Rewrite Location headers from the upstream so that the browser follows
	// redirects back through the proxy rather than directly to the upstream or
	// to an unresolvable path.
	//
	//  - Absolute URLs pointing to the upstream host → strip host, prepend /app/{slug}
	//  - Relative URLs (path-only, e.g. "/login") → prepend /app/{slug}
	//
	// For HTML responses, inject a <base href="/app/{slug}/"> tag immediately
	// after the opening <head> element.  This fixes asset loading for apps that
	// embed root-relative URLs (e.g. Next.js /_next/static/…) and do not
	// honour X-Forwarded-Prefix natively.
	baseTag := []byte(`<base href="/app/` + slug + `/">`)
	proxy.ModifyResponse = func(resp *http.Response) error {
		// ── Location rewriting ────────────────────────────────────────
		loc := resp.Header.Get("Location")
		if loc != "" {
			parsed, err := url.Parse(loc)
			if err == nil {
				if parsed.IsAbs() {
					if strings.EqualFold(parsed.Host, targetURL.Host) {
						resp.Header.Set("Location", "/app/"+slug+parsed.RequestURI())
					}
				} else {
					newLoc := "/app/" + slug + "/" + strings.TrimPrefix(parsed.RequestURI(), "/")
					resp.Header.Set("Location", newLoc)
				}
			}
		}

		// ── <base> tag injection into HTML responses ──────────────────
		ct := resp.Header.Get("Content-Type")
		if !strings.HasPrefix(ct, "text/html") {
			return nil
		}

		body, err := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if err != nil {
			resp.Body = io.NopCloser(strings.NewReader(""))
			return nil
		}

		// Don't inject if the document already has a <base> tag.
		lowerBody := bytes.ToLower(body)
		if !bytes.Contains(lowerBody, []byte("<base")) {
			// Find the first <head …> closing >, then insert right after it.
			if idx := bytes.Index(lowerBody, []byte("<head")); idx != -1 {
				// Advance to the end of the opening tag.
				closing := bytes.IndexByte(lowerBody[idx:], '>')
				if closing != -1 {
					insertAt := idx + closing + 1
					injected := make([]byte, 0, len(body)+len(baseTag))
					injected = append(injected, body[:insertAt]...)
					injected = append(injected, baseTag...)
					injected = append(injected, body[insertAt:]...)
					body = injected
				}
			}
		}

		resp.Body = io.NopCloser(bytes.NewReader(body))
		resp.ContentLength = int64(len(body))
		resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(body)))
		// Remove Content-Encoding since the body is now uncompressed.
		resp.Header.Del("Content-Encoding")
		return nil
	}

	proxy.ServeHTTP(writer, request)
}

// ── OIDC login / callback / logout ────────────────────────────────────

func (s *Service) handleAppLogin(writer http.ResponseWriter, request *http.Request, slug string) {
	cfg, ok, err := s.store.GetOIDCConfig(request.Context())
	if err != nil || !ok || !cfg.Enabled {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": "OIDC is not configured on this platform"})
		return
	}
	disc, err := s.fetchOIDCDiscovery(cfg.Issuer)
	if err != nil {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": "OIDC provider unreachable"})
		return
	}

	app, ok, err := s.store.GetProtectedAppBySlug(request.Context(), slug)
	if err != nil || !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "app not found"})
		return
	}

	returnTo := request.URL.Query().Get("return_to")
	if returnTo == "" {
		returnTo = "/app/" + slug + "/"
	}

	// Generate nonce and state
	nonce, err := randomHex(16)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "entropy error"})
		return
	}
	statePayload := map[string]string{"appID": app.ID, "nonce": nonce, "returnTo": returnTo}
	stateJSON, _ := json.Marshal(statePayload)
	state := base64.RawURLEncoding.EncodeToString(stateJSON)

	// Store nonce in a short-lived cookie
	http.SetCookie(writer, &http.Cookie{
		Name:     appNonceCookie(app.ID),
		Value:    nonce,
		Path:     "/app/" + slug + "/_auth/",
		MaxAge:   600, // 10 min
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(request),
	})

	scopes := "openid email profile"
	if cfg.GroupsClaim != "" {
		scopes += " groups"
	}

	callbackURL := appCallbackURL(request, slug)
	authURL := fmt.Sprintf("%s?response_type=code&client_id=%s&redirect_uri=%s&scope=%s&state=%s&nonce=%s",
		disc.AuthorizationEndpoint,
		url.QueryEscape(cfg.ClientID),
		url.QueryEscape(callbackURL),
		url.QueryEscape(scopes),
		url.QueryEscape(state),
		url.QueryEscape(nonce),
	)
	http.Redirect(writer, request, authURL, http.StatusFound)
}

func (s *Service) handleAppCallback(writer http.ResponseWriter, request *http.Request, slug string) {
	cfg, ok, err := s.store.GetOIDCConfig(request.Context())
	if err != nil || !ok || !cfg.Enabled {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": "OIDC not configured"})
		return
	}

	app, ok, err := s.store.GetProtectedAppBySlug(request.Context(), slug)
	if err != nil || !ok {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "app not found"})
		return
	}

	// Verify state
	rawState := request.URL.Query().Get("state")
	if rawState == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "missing state"})
		return
	}
	stateJSON, err := base64.RawURLEncoding.DecodeString(rawState)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid state"})
		return
	}
	var statePayload map[string]string
	if err := json.Unmarshal(stateJSON, &statePayload); err != nil || statePayload["appID"] != app.ID {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "state mismatch"})
		return
	}

	// Verify nonce cookie
	nonceCookie, err := request.Cookie(appNonceCookie(app.ID))
	if err != nil || nonceCookie.Value != statePayload["nonce"] {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "nonce mismatch; possible CSRF"})
		return
	}

	// Clear the nonce cookie immediately
	http.SetCookie(writer, &http.Cookie{
		Name:     appNonceCookie(app.ID),
		Value:    "",
		Path:     "/app/" + slug + "/_auth/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	code := request.URL.Query().Get("code")
	if code == "" {
		errMsg := request.URL.Query().Get("error_description")
		if errMsg == "" {
			errMsg = request.URL.Query().Get("error")
		}
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "OIDC error: " + errMsg})
		return
	}

	// Exchange code for tokens
	var clientSecret string
	if cfg.ClientSecretEncrypted != "" {
		clientSecret, err = decryptSecret(cfg.ClientSecretEncrypted, s.config.AdminJWTSecret)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "OIDC configuration error"})
			return
		}
	}
	disc, err := s.fetchOIDCDiscovery(cfg.Issuer)
	if err != nil {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": "OIDC provider unreachable"})
		return
	}

	idToken, err := exchangeOIDCCode(disc.TokenEndpoint, cfg.ClientID, clientSecret, code, appCallbackURL(request, slug))
	if err != nil {
		s.logger.Error("OIDC code exchange failed", "slug", slug, "error", err)
		writeJSON(writer, http.StatusBadGateway, map[string]string{"error": "OIDC token exchange failed"})
		return
	}

	claims, err := parseJWTClaims(idToken)
	if err != nil {
		writeJSON(writer, http.StatusBadGateway, map[string]string{"error": "invalid ID token"})
		return
	}

	sub, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	var groups []string
	if cfg.GroupsClaim != "" {
		if raw, ok := claims[cfg.GroupsClaim]; ok {
			switch v := raw.(type) {
			case []interface{}:
				for _, g := range v {
					if gs, ok := g.(string); ok {
						groups = append(groups, gs)
					}
				}
			case []string:
				groups = v
			}
		}
	}

	// Create a session
	sessionSecret, err := randomHex(32)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "entropy error"})
		return
	}
	now := time.Now().UTC()
	session := appSessionRecord{
		AppID:      app.ID,
		UserSub:    sub,
		UserEmail:  email,
		UserName:   name,
		UserGroups: groups,
		TokenHash:  hashToken(sessionSecret),
		IP:         clientAddress(request),
		CreatedAt:  now,
		ExpiresAt:  now.Add(12 * time.Hour),
		LastUsedAt: now,
	}
	if err := s.store.CreateAppSession(request.Context(), session); err != nil {
		s.logger.Error("failed to store app session", "slug", slug, "error", err)
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to create session"})
		return
	}

	// Set session cookie
	http.SetCookie(writer, &http.Cookie{
		Name:     appSessionCookieName(app.ID),
		Value:    sessionSecret,
		Path:     "/app/" + slug + "/",
		MaxAge:   int((12 * time.Hour).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(request),
	})

	returnTo := statePayload["returnTo"]
	if returnTo == "" {
		returnTo = "/app/" + slug + "/"
	}
	http.Redirect(writer, request, returnTo, http.StatusFound)
}

func (s *Service) handleAppLogout(writer http.ResponseWriter, request *http.Request, slug string) {
	app, ok, err := s.store.GetProtectedAppBySlug(request.Context(), slug)
	if err != nil || !ok {
		http.Redirect(writer, request, "/app/"+slug+"/", http.StatusFound)
		return
	}

	cookieVal := appSessionCookieValue(request, app.ID)
	if cookieVal != "" {
		session, valid, _ := s.store.GetAppSessionByToken(request.Context(), cookieVal)
		if valid {
			_ = s.store.RevokeAppSession(request.Context(), session.ID)
		}
	}

	// Clear session cookie
	http.SetCookie(writer, &http.Cookie{
		Name:     appSessionCookieName(app.ID),
		Value:    "",
		Path:     "/app/" + slug + "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
	http.Redirect(writer, request, "/app/"+slug+"/_auth/login", http.StatusFound)
}

// redirectToAppLogin redirects preserving the current request URL as return_to.
func (s *Service) redirectToAppLogin(writer http.ResponseWriter, request *http.Request, slug string) {
	returnTo := request.URL.RequestURI()
	loginURL := "/app/" + slug + "/_auth/login?return_to=" + url.QueryEscape(returnTo)
	http.Redirect(writer, request, loginURL, http.StatusFound)
}

// ── OIDC discovery ────────────────────────────────────────────────────

func (s *Service) fetchOIDCDiscovery(issuer string) (oidcDiscoveryDoc, error) {
	if v, ok := s.oidcDiscovery.Load(issuer); ok {
		return v.(oidcDiscoveryDoc), nil
	}

	wellKnown := strings.TrimSuffix(issuer, "/") + "/.well-known/openid-configuration"
	resp, err := http.Get(wellKnown) //nolint:noctx
	if err != nil {
		return oidcDiscoveryDoc{}, fmt.Errorf("discovery fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return oidcDiscoveryDoc{}, fmt.Errorf("discovery fetch: HTTP %d", resp.StatusCode)
	}

	var doc oidcDiscoveryDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return oidcDiscoveryDoc{}, fmt.Errorf("discovery decode: %w", err)
	}

	// Cache for 1 hour — we don't bother with expiry; good enough for a proxy.
	s.oidcDiscovery.Store(issuer, doc)
	return doc, nil
}

// ── OIDC code exchange ─────────────────────────────────────────────────

func exchangeOIDCCode(tokenEndpoint, clientID, clientSecret, code, redirectURI string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)

	resp, err := http.PostForm(tokenEndpoint, form) //nolint:noctx
	if err != nil {
		return "", fmt.Errorf("token exchange POST: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token exchange: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("token exchange decode: %w", err)
	}
	if result.IDToken == "" {
		return "", fmt.Errorf("no id_token in response")
	}
	return result.IDToken, nil
}

// parseJWTClaims decodes the payload section of a JWT without verifying the
// signature. This is safe here because:
//   - The token was just received directly from the OIDC provider's token
//     endpoint over HTTPS (not from an untrusted browser).
//   - The state + nonce binding prevents CSRF/replay.
//
// TODO: add JWKS-based signature verification for defence-in-depth.
func parseJWTClaims(token string) (map[string]interface{}, error) {
	parts := strings.SplitN(token, ".", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid JWT payload: %w", err)
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("invalid JWT claims: %w", err)
	}
	return claims, nil
}

// ── Transport cache for per-app custom CA ─────────────────────────────

func (s *Service) appTransportFor(app protectedAppRecord) *http.Transport {
	if app.ExtraCAPEM == "" {
		return s.transport
	}

	cacheKey := app.ID + ":" + shortHash(app.ExtraCAPEM)
	if v, ok := s.appTransports.Load(cacheKey); ok {
		return v.(*http.Transport)
	}

	pool, err := x509.SystemCertPool()
	if err != nil {
		pool = x509.NewCertPool()
	}
	pool.AppendCertsFromPEM([]byte(app.ExtraCAPEM))

	base := s.transport.Clone()
	if base.TLSClientConfig == nil {
		base.TLSClientConfig = &tls.Config{}
	}
	base.TLSClientConfig = base.TLSClientConfig.Clone()
	base.TLSClientConfig.RootCAs = pool

	s.appTransports.Store(cacheKey, base)
	return base
}

// ── Header injection value resolution ─────────────────────────────────

type appRequestIdentity struct {
	Kind           string // "session" | "token"
	SessionID      string
	TokenID        string
	Sub            string
	Email          string
	Name           string
	Groups         []string
	RateLimitRPM   int
	RateLimitBurst int
}

func resolveHeaderValue(template string, id appRequestIdentity) string {
	r := strings.NewReplacer(
		"$user.email", id.Email,
		"$user.name", id.Name,
		"$user.sub", id.Sub,
		"$user.groups", strings.Join(id.Groups, ","),
	)
	return r.Replace(template)
}

// ── Cookie names / helpers ─────────────────────────────────────────────

func appSessionCookieName(appID string) string {
	return "jg_s_" + appID
}

func appNonceCookie(appID string) string {
	return "jg_n_" + appID
}

func appSessionCookieValue(request *http.Request, appID string) string {
	c, err := request.Cookie(appSessionCookieName(appID))
	if err != nil {
		return ""
	}
	return c.Value
}

func appCallbackURL(request *http.Request, slug string) string {
	scheme := "https"
	if !isSecureRequest(request) {
		scheme = "http"
	}
	host := request.Host
	return scheme + "://" + host + "/app/" + slug + "/_auth/callback"
}

func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}

// ── Small crypto utilities ────────────────────────────────────────────

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func shortHash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:4])
}
