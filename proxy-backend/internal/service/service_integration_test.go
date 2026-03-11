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

	response, err := http.Post(server.URL+"/proxy/team-a-metrics/ingest", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing token, got %d", response.StatusCode)
	}

	request, err := http.NewRequest(http.MethodPost, server.URL+"/proxy/team-a-metrics/ingest", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer jpg_ops_reader_secret_local")

	response, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusForbidden {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("expected 403 for tenant mismatch, got %d: %s", response.StatusCode, string(body))
	}

	request, err = http.NewRequest(http.MethodPost, server.URL+"/proxy/team-a-metrics/ingest", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer jpg_agent_push_secret_local")

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
