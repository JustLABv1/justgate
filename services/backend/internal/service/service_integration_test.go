package service

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestAdminAuthRequiresSignedJWT(t *testing.T) {
	svc := newTestService(t, "http://localhost:9009")
	server := httptest.NewServer(svc.Handler())
	t.Cleanup(server.Close)

	response, err := http.Get(server.URL + "/api/v1/admin/overview")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.StatusCode)
	}

	request, err := http.NewRequest(http.MethodGet, server.URL+"/api/v1/admin/overview", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+newAdminJWT(t, "wrong-secret"))

	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid JWT, got %d", response.StatusCode)
	}

	request, err = http.NewRequest(http.MethodGet, server.URL+"/api/v1/admin/overview", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+newAdminJWT(t, testAdminJWTSecret))

	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 200, got %d: %s", response.StatusCode, string(body))
	}
}

func TestLocalAccountRegisterAndVerify(t *testing.T) {
	svc := newTestService(t, "http://localhost:9009")
	server := httptest.NewServer(svc.Handler())
	t.Cleanup(server.Close)

	registerPayload := map[string]string{
		"email":    "admin@example.com",
		"name":     "Admin User",
		"password": "supersafepass",
	}
	body, _ := json.Marshal(registerPayload)
	response, err := http.Post(server.URL+"/api/v1/auth/local/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusCreated {
		payload, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 201, got %d: %s", response.StatusCode, string(payload))
	}

	verifyBody, _ := json.Marshal(map[string]string{
		"email":    "admin@example.com",
		"password": "supersafepass",
	})
	response, err = http.Post(server.URL+"/api/v1/auth/local/verify", "application/json", bytes.NewReader(verifyBody))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 200, got %d: %s", response.StatusCode, string(payload))
	}
}

func TestProxyAuthorizationPath(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("X-Upstream-Tenant", request.Header.Get("X-Scope-OrgID"))
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(upstream.Close)

	svc := newTestService(t, upstream.URL)
	server := httptest.NewServer(svc.Handler())
	t.Cleanup(server.Close)

	adminJWT := newAdminJWT(t, testAdminJWTSecret)

	// Create an org
	orgBody, _ := json.Marshal(map[string]string{"name": "Test Org"})
	orgReq, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/admin/orgs", bytes.NewReader(orgBody))
	orgReq.Header.Set("Authorization", "Bearer "+adminJWT)
	orgReq.Header.Set("Content-Type", "application/json")
	orgResp, err := http.DefaultClient.Do(orgReq)
	if err != nil {
		t.Fatal(err)
	}
	defer orgResp.Body.Close()
	if orgResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(orgResp.Body)
		t.Fatalf("expected 201 for org creation, got %d: %s", orgResp.StatusCode, string(body))
	}
	var orgResult struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(orgResp.Body).Decode(&orgResult); err != nil {
		t.Fatal(err)
	}
	orgID := orgResult.ID

	// Create upstream tenant (acme-prod)
	tenantBody, _ := json.Marshal(map[string]string{
		"name": "Acme", "tenantID": "acme-prod",
		"upstreamURL": upstream.URL, "authMode": "header", "headerName": "X-Scope-OrgID",
	})
	tenantReq, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/admin/tenants", bytes.NewReader(tenantBody))
	tenantReq.Header.Set("Authorization", "Bearer "+adminJWT)
	tenantReq.Header.Set("Content-Type", "application/json")
	tenantReq.Header.Set("X-Org-ID", orgID)
	tenantResp, err := http.DefaultClient.Do(tenantReq)
	if err != nil {
		t.Fatal(err)
	}
	defer tenantResp.Body.Close()
	if tenantResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(tenantResp.Body)
		t.Fatalf("expected 201 for tenant, got %d: %s", tenantResp.StatusCode, string(body))
	}

	// Create second tenant (northstar-int)
	t2Body, _ := json.Marshal(map[string]string{
		"name": "Northstar", "tenantID": "northstar-int",
		"upstreamURL": upstream.URL, "authMode": "header", "headerName": "X-Scope-OrgID",
	})
	t2Req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/admin/tenants", bytes.NewReader(t2Body))
	t2Req.Header.Set("Authorization", "Bearer "+adminJWT)
	t2Req.Header.Set("Content-Type", "application/json")
	t2Req.Header.Set("X-Org-ID", orgID)
	t2Resp, err := http.DefaultClient.Do(t2Req)
	if err != nil {
		t.Fatal(err)
	}
	defer t2Resp.Body.Close()
	if t2Resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(t2Resp.Body)
		t.Fatalf("expected 201 for tenant2, got %d: %s", t2Resp.StatusCode, string(body))
	}

	// Create route for northstar-int
	routeBody, _ := json.Marshal(map[string]interface{}{
		"slug": "team-a-metrics", "targetPath": "/api/v1/push",
		"tenantID": "northstar-int", "requiredScope": "metrics:write",
		"methods": []string{"POST"},
	})
	routeReq, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/admin/routes", bytes.NewReader(routeBody))
	routeReq.Header.Set("Authorization", "Bearer "+adminJWT)
	routeReq.Header.Set("Content-Type", "application/json")
	routeReq.Header.Set("X-Org-ID", orgID)
	routeResp, err := http.DefaultClient.Do(routeReq)
	if err != nil {
		t.Fatal(err)
	}
	defer routeResp.Body.Close()
	if routeResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(routeResp.Body)
		t.Fatalf("expected 201 for route, got %d: %s", routeResp.StatusCode, string(body))
	}

	// Create token for acme-prod (wrong tenant for the route)
	tok1Body, _ := json.Marshal(map[string]interface{}{
		"name": "ops-reader", "tenantID": "acme-prod",
		"scopes": []string{"metrics:read"}, "expiresAt": "2090-01-01T00:00:00Z",
	})
	tok1Req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/admin/tokens", bytes.NewReader(tok1Body))
	tok1Req.Header.Set("Authorization", "Bearer "+adminJWT)
	tok1Req.Header.Set("Content-Type", "application/json")
	tok1Req.Header.Set("X-Org-ID", orgID)
	tok1Resp, err := http.DefaultClient.Do(tok1Req)
	if err != nil {
		t.Fatal(err)
	}
	defer tok1Resp.Body.Close()
	if tok1Resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(tok1Resp.Body)
		t.Fatalf("expected 201 for token1, got %d: %s", tok1Resp.StatusCode, string(body))
	}
	var tok1Result struct {
		Secret string `json:"secret"`
	}
	if err := json.NewDecoder(tok1Resp.Body).Decode(&tok1Result); err != nil {
		t.Fatal(err)
	}

	// Create token for northstar-int (correct tenant)
	tok2Body, _ := json.Marshal(map[string]interface{}{
		"name": "agent-push", "tenantID": "northstar-int",
		"scopes": []string{"metrics:write"}, "expiresAt": "2090-01-01T00:00:00Z",
	})
	tok2Req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/v1/admin/tokens", bytes.NewReader(tok2Body))
	tok2Req.Header.Set("Authorization", "Bearer "+adminJWT)
	tok2Req.Header.Set("Content-Type", "application/json")
	tok2Req.Header.Set("X-Org-ID", orgID)
	tok2Resp, err := http.DefaultClient.Do(tok2Req)
	if err != nil {
		t.Fatal(err)
	}
	defer tok2Resp.Body.Close()
	if tok2Resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(tok2Resp.Body)
		t.Fatalf("expected 201 for token2, got %d: %s", tok2Resp.StatusCode, string(body))
	}
	var tok2Result struct {
		Secret string `json:"secret"`
	}
	if err := json.NewDecoder(tok2Resp.Body).Decode(&tok2Result); err != nil {
		t.Fatal(err)
	}

	// 1. Request without token → 401
	response, err := http.Post(server.URL+"/proxy/team-a-metrics/ingest", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing token, got %d", response.StatusCode)
	}

	// 2. Request with acme-prod token (wrong tenant) → 403
	request, err := http.NewRequest(http.MethodPost, server.URL+"/proxy/team-a-metrics/ingest", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+tok1Result.Secret)
	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusForbidden {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 403 for tenant mismatch, got %d: %s", response.StatusCode, string(body))
	}

	// 3. Request with northstar token (correct tenant) → 202
	request, err = http.NewRequest(http.MethodPost, server.URL+"/proxy/team-a-metrics/ingest", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+tok2Result.Secret)
	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 202, got %d: %s", response.StatusCode, string(body))
	}
	if got := response.Header.Get("X-Upstream-Tenant"); got != "northstar-int" {
		t.Fatalf("expected upstream tenant header northstar-int, got %q", got)
	}
}

const testAdminJWTSecret = "test-admin-jwt-secret"

func newTestService(t *testing.T, primaryUpstream string) *Service {
	t.Helper()
	t.Setenv("MIMIR_PRIMARY_UPSTREAM", primaryUpstream)
	t.Setenv("MIMIR_SECONDARY_UPSTREAM", primaryUpstream)

	databasePath := filepath.Join(t.TempDir(), "integration.db")
	svc, err := New(Config{
		Version:        "test",
		AdminJWTSecret: testAdminJWTSecret,
		DatabaseURL:    "sqlite://" + databasePath,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

func newAdminJWT(t *testing.T, secret string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":   "integration-admin",
		"email": "admin@example.com",
		"name":  "Integration Admin",
		"roles": []string{"admin"},
		"scope": "admin:control",
		"aud":   "just-gate-backend",
		"iss":   "just-gate-admin",
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(5 * time.Minute).Unix(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}
