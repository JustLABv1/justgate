package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

type sqlStore struct {
	db      *sql.DB
	dialect string
	now     func() time.Time
}

func newSQLStore(databaseURL, headerName string) (string, *sqlStore, error) {
	driverName, dsn, storeKind := databaseConfig(databaseURL)
	database, err := sql.Open(driverName, dsn)
	if err != nil {
		return "", nil, err
	}

	store := &sqlStore{
		db:      database,
		dialect: storeKind,
		now: func() time.Time {
			return time.Now().UTC()
		},
	}

	if err := store.db.Ping(); err != nil {
		return "", nil, err
	}
	if err := store.ensureSchema(context.Background()); err != nil {
		return "", nil, err
	}
	if err := store.seed(context.Background(), headerName); err != nil {
		return "", nil, err
	}

	return storeKind, store, nil
}

func databaseConfig(databaseURL string) (string, string, string) {
	trimmed := strings.TrimSpace(databaseURL)
	if trimmed == "" {
		return "sqlite", "file:just-proxy-guard.db?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", "sqlite"
	}

	if strings.HasPrefix(trimmed, "postgres://") || strings.HasPrefix(trimmed, "postgresql://") {
		return "pgx", trimmed, "postgres"
	}

	if strings.HasPrefix(trimmed, "sqlite://") {
		path := strings.TrimPrefix(trimmed, "sqlite://")
		if path == "" {
			path = "just-proxy-guard.db"
		}
		return "sqlite", fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", path), "sqlite"
	}

	return "sqlite", trimmed, "sqlite"
}

func (store *sqlStore) ensureSchema(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			tenant_id TEXT NOT NULL UNIQUE,
			upstream_url TEXT NOT NULL,
			auth_mode TEXT NOT NULL,
			header_name TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS routes (
			id TEXT PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			target_path TEXT NOT NULL,
			tenant_id TEXT NOT NULL,
			required_scope TEXT NOT NULL,
			methods_json TEXT NOT NULL,
			upstream_url TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS tokens (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			tenant_id TEXT NOT NULL,
			scopes_json TEXT NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			last_used_at TIMESTAMP NOT NULL,
			preview TEXT NOT NULL,
			active BOOLEAN NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			created_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS audits (
			id TEXT PRIMARY KEY,
			timestamp TIMESTAMP NOT NULL,
			route_slug TEXT NOT NULL,
			tenant_id TEXT NOT NULL,
			token_id TEXT NOT NULL,
			method TEXT NOT NULL,
			status INTEGER NOT NULL,
			upstream_url TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_routes_slug ON routes (slug)`,
		`CREATE INDEX IF NOT EXISTS idx_tokens_hash ON tokens (token_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits (timestamp DESC)`,
	}

	for _, statement := range statements {
		if _, err := store.execContext(ctx, statement); err != nil {
			return err
		}
	}

	return nil
}

func (store *sqlStore) seed(ctx context.Context, headerName string) error {
	var tenantCount int
	if err := store.queryRowContext(ctx, `SELECT COUNT(*) FROM tenants`).Scan(&tenantCount); err != nil {
		return err
	}
	if tenantCount > 0 {
		return nil
	}

	primaryUpstream := getenvOrDefault("MIMIR_PRIMARY_UPSTREAM", "http://localhost:9009")
	secondaryUpstream := getenvOrDefault("MIMIR_SECONDARY_UPSTREAM", "http://localhost:9010")
	now := store.now()

	tenants := []tenantRecord{
		{
			ID:         "tenant-acme",
			Name:       "Acme Observability",
			TenantID:   "acme-prod",
			Upstream:   primaryUpstream,
			AuthMode:   "header",
			HeaderName: headerName,
		},
		{
			ID:         "tenant-northstar",
			Name:       "Northstar Platform",
			TenantID:   "northstar-int",
			Upstream:   secondaryUpstream,
			AuthMode:   "header",
			HeaderName: headerName,
		},
	}

	routes := []routeRecord{
		{
			ID:            "route-mimir",
			Slug:          "mimir",
			TargetPath:    "/api/v1",
			TenantID:      "acme-prod",
			RequiredScope: "metrics:read",
			Methods:       []string{http.MethodGet},
			UpstreamURL:   primaryUpstream,
		},
		{
			ID:            "route-rules",
			Slug:          "rules",
			TargetPath:    "/prometheus/config/v1/rules",
			TenantID:      "acme-prod",
			RequiredScope: "rules:read",
			Methods:       []string{http.MethodGet},
			UpstreamURL:   primaryUpstream,
		},
		{
			ID:            "route-team-a",
			Slug:          "team-a-metrics",
			TargetPath:    "/api/v1/push",
			TenantID:      "northstar-int",
			RequiredScope: "metrics:write",
			Methods:       []string{http.MethodPost},
			UpstreamURL:   secondaryUpstream,
		},
	}

	tokens := []struct {
		record    tokenRecord
		createdAt time.Time
	}{
		{
			record: tokenRecord{
				ID:         "tok_ops_reader",
				Name:       "ops-reader",
				TenantID:   "acme-prod",
				Scopes:     []string{"metrics:read", "rules:read"},
				ExpiresAt:  now.Add(120 * 24 * time.Hour),
				LastUsedAt: now.Add(-64 * time.Minute),
				Preview:    "jpg_ops_reader_...d3f",
				Active:     true,
				Hash:       hashToken("jpg_ops_reader_secret_local"),
			},
			createdAt: now.Add(-30 * time.Minute),
		},
		{
			record: tokenRecord{
				ID:         "tok_agent_push",
				Name:       "agent-push",
				TenantID:   "northstar-int",
				Scopes:     []string{"metrics:write"},
				ExpiresAt:  now.Add(90 * 24 * time.Hour),
				LastUsedAt: now.Add(-3 * time.Hour),
				Preview:    "jpg_agent_push_...7ab",
				Active:     true,
				Hash:       hashToken("jpg_agent_push_secret_local"),
			},
			createdAt: now.Add(-20 * time.Minute),
		},
	}

	audits := []auditRecord{
		{
			ID:        "audit-001",
			Timestamp: now.Add(-64 * time.Minute),
			RouteSlug: "mimir",
			TenantID:  "acme-prod",
			TokenID:   "tok_ops_reader",
			Method:    http.MethodGet,
			Status:    http.StatusOK,
			Upstream:  primaryUpstream + "/api/v1/query",
		},
		{
			ID:        "audit-002",
			Timestamp: now.Add(-3 * time.Hour),
			RouteSlug: "team-a-metrics",
			TenantID:  "northstar-int",
			TokenID:   "tok_agent_push",
			Method:    http.MethodPost,
			Status:    http.StatusAccepted,
			Upstream:  secondaryUpstream + "/api/v1/push",
		},
		{
			ID:        "audit-003",
			Timestamp: now.Add(-4 * time.Hour),
			RouteSlug: "rules",
			TenantID:  "acme-prod",
			TokenID:   "tok_ops_reader",
			Method:    http.MethodGet,
			Status:    http.StatusUnauthorized,
			Upstream:  primaryUpstream + "/prometheus/config/v1/rules",
		},
	}

	for index, tenant := range tenants {
		createdAt := now.Add(time.Duration(index) * time.Minute)
		if _, err := store.execContext(ctx, `INSERT INTO tenants (id, name, tenant_id, upstream_url, auth_mode, header_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, tenant.ID, tenant.Name, tenant.TenantID, tenant.Upstream, tenant.AuthMode, tenant.HeaderName, createdAt); err != nil {
			return err
		}
	}

	for index, route := range routes {
		methodsJSON, err := json.Marshal(route.Methods)
		if err != nil {
			return err
		}
		createdAt := now.Add(time.Duration(index) * time.Minute)
		if _, err := store.execContext(ctx, `INSERT INTO routes (id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, route.ID, route.Slug, route.TargetPath, route.TenantID, route.RequiredScope, string(methodsJSON), route.UpstreamURL, createdAt); err != nil {
			return err
		}
	}

	for _, token := range tokens {
		scopesJSON, err := json.Marshal(token.record.Scopes)
		if err != nil {
			return err
		}
		if _, err := store.execContext(ctx, `INSERT INTO tokens (id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, token.record.ID, token.record.Name, token.record.TenantID, string(scopesJSON), token.record.ExpiresAt, token.record.LastUsedAt, token.record.Preview, token.record.Active, token.record.Hash, token.createdAt); err != nil {
			return err
		}
	}

	for _, audit := range audits {
		if err := store.RecordAudit(ctx, audit); err != nil {
			return err
		}
	}

	return nil
}

func (store *sqlStore) ListTenants(ctx context.Context) ([]tenantRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT id, name, tenant_id, upstream_url, auth_mode, header_name FROM tenants ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]tenantRecord, 0)
	for rows.Next() {
		var tenant tenantRecord
		if err := rows.Scan(&tenant.ID, &tenant.Name, &tenant.TenantID, &tenant.Upstream, &tenant.AuthMode, &tenant.HeaderName); err != nil {
			return nil, err
		}
		items = append(items, tenant)
	}
	return items, rows.Err()
}

func (store *sqlStore) ListRoutes(ctx context.Context) ([]routeRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url FROM routes ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]routeRecord, 0)
	for rows.Next() {
		route, err := scanRoute(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, route)
	}
	return items, rows.Err()
}

func (store *sqlStore) ListTokens(ctx context.Context) ([]tokenRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash FROM tokens ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]tokenRecord, 0)
	for rows.Next() {
		token, err := scanToken(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, token)
	}
	return items, rows.Err()
}

func (store *sqlStore) ListAudits(ctx context.Context) ([]auditRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT id, timestamp, route_slug, tenant_id, token_id, method, status, upstream_url FROM audits ORDER BY timestamp DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]auditRecord, 0)
	for rows.Next() {
		var audit auditRecord
		if err := rows.Scan(&audit.ID, &audit.Timestamp, &audit.RouteSlug, &audit.TenantID, &audit.TokenID, &audit.Method, &audit.Status, &audit.Upstream); err != nil {
			return nil, err
		}
		items = append(items, audit)
	}
	return items, rows.Err()
}

func (store *sqlStore) CreateTenant(ctx context.Context, payload createTenantRequest) (tenantRecord, error) {
	tenant := tenantRecord{
		ID:         newResourceID("tenant"),
		Name:       payload.Name,
		TenantID:   payload.TenantID,
		Upstream:   payload.Upstream,
		AuthMode:   payload.AuthMode,
		HeaderName: payload.HeaderName,
	}

	_, err := store.execContext(ctx, `INSERT INTO tenants (id, name, tenant_id, upstream_url, auth_mode, header_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, tenant.ID, tenant.Name, tenant.TenantID, tenant.Upstream, tenant.AuthMode, tenant.HeaderName, store.now())
	if err != nil {
		return tenantRecord{}, translateDBError(err, "tenantID already exists")
	}

	return tenant, nil
}

func (store *sqlStore) CreateRoute(ctx context.Context, payload createRouteRequest, methods []string) (routeRecord, error) {
	upstreamURL, err := store.lookupTenantUpstream(ctx, payload.TenantID)
	if err != nil {
		return routeRecord{}, err
	}

	methodsJSON, err := json.Marshal(methods)
	if err != nil {
		return routeRecord{}, err
	}

	route := routeRecord{
		ID:            newResourceID("route"),
		Slug:          payload.Slug,
		TargetPath:    payload.TargetPath,
		TenantID:      payload.TenantID,
		RequiredScope: payload.RequiredScope,
		Methods:       methods,
		UpstreamURL:   upstreamURL,
	}

	_, err = store.execContext(ctx, `INSERT INTO routes (id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, route.ID, route.Slug, route.TargetPath, route.TenantID, route.RequiredScope, string(methodsJSON), route.UpstreamURL, store.now())
	if err != nil {
		return routeRecord{}, translateDBError(err, "slug already exists")
	}

	return route, nil
}

func (store *sqlStore) UpdateRoute(ctx context.Context, routeID string, payload createRouteRequest, methods []string) (routeRecord, error) {
	upstreamURL, err := store.lookupTenantUpstream(ctx, payload.TenantID)
	if err != nil {
		return routeRecord{}, err
	}

	methodsJSON, err := json.Marshal(methods)
	if err != nil {
		return routeRecord{}, err
	}

	result, err := store.execContext(ctx, `UPDATE routes SET slug = ?, target_path = ?, tenant_id = ?, required_scope = ?, methods_json = ?, upstream_url = ? WHERE id = ?`, payload.Slug, payload.TargetPath, payload.TenantID, payload.RequiredScope, string(methodsJSON), upstreamURL, routeID)
	if err != nil {
		return routeRecord{}, translateDBError(err, "slug already exists")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return routeRecord{}, err
	}
	if rowsAffected == 0 {
		return routeRecord{}, fmt.Errorf("route not found")
	}

	return routeRecord{
		ID:            routeID,
		Slug:          payload.Slug,
		TargetPath:    payload.TargetPath,
		TenantID:      payload.TenantID,
		RequiredScope: payload.RequiredScope,
		Methods:       methods,
		UpstreamURL:   upstreamURL,
	}, nil
}

func (store *sqlStore) CreateToken(ctx context.Context, payload createTokenRequest, scopes []string, expiresAt time.Time, secret string) (tokenRecord, error) {
	if _, err := store.lookupTenantUpstream(ctx, payload.TenantID); err != nil {
		return tokenRecord{}, err
	}

	scopesJSON, err := json.Marshal(scopes)
	if err != nil {
		return tokenRecord{}, err
	}

	token := tokenRecord{
		ID:         newResourceID("tok"),
		Name:       payload.Name,
		TenantID:   payload.TenantID,
		Scopes:     scopes,
		ExpiresAt:  expiresAt,
		LastUsedAt: store.now(),
		Preview:    previewSecret(secret),
		Active:     true,
		Hash:       hashToken(secret),
	}

	_, err = store.execContext(ctx, `INSERT INTO tokens (id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, token.ID, token.Name, token.TenantID, string(scopesJSON), token.ExpiresAt, token.LastUsedAt, token.Preview, token.Active, token.Hash, store.now())
	if err != nil {
		return tokenRecord{}, translateDBError(err, "token creation failed")
	}

	return token, nil
}

func (store *sqlStore) SetTokenActive(ctx context.Context, tokenID string, active bool) (tokenRecord, error) {
	result, err := store.execContext(ctx, `UPDATE tokens SET active = ? WHERE id = ?`, active, tokenID)
	if err != nil {
		return tokenRecord{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return tokenRecord{}, err
	}
	if rowsAffected == 0 {
		return tokenRecord{}, fmt.Errorf("token not found")
	}

	row := store.queryRowContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash FROM tokens WHERE id = ?`, tokenID)
	return scanToken(row)
}

func (store *sqlStore) RouteBySlug(ctx context.Context, slug string) (routeRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url FROM routes WHERE slug = ? LIMIT 1`, slug)
	route, err := scanRoute(row)
	if err == sql.ErrNoRows {
		return routeRecord{}, false, nil
	}
	if err != nil {
		return routeRecord{}, false, err
	}
	return route, true, nil
}

func (store *sqlStore) ValidateToken(ctx context.Context, secret string) (tokenRecord, bool, error) {
	hashedSecret := hashToken(secret)
	now := store.now()

	row := store.queryRowContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash FROM tokens WHERE token_hash = ? AND active = ? AND expires_at > ? LIMIT 1`, hashedSecret, true, now)
	token, err := scanToken(row)
	if err == sql.ErrNoRows {
		return tokenRecord{}, false, nil
	}
	if err != nil {
		return tokenRecord{}, false, err
	}

	token.LastUsedAt = now
	if _, err := store.execContext(ctx, `UPDATE tokens SET last_used_at = ? WHERE id = ?`, now, token.ID); err != nil {
		return tokenRecord{}, false, err
	}

	return token, true, nil
}

func (store *sqlStore) RecordAudit(ctx context.Context, audit auditRecord) error {
	if audit.ID == "" {
		audit.ID = newResourceID("audit")
	}
	if audit.Timestamp.IsZero() {
		audit.Timestamp = store.now()
	}

	if _, err := store.execContext(ctx, `INSERT INTO audits (id, timestamp, route_slug, tenant_id, token_id, method, status, upstream_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, audit.ID, audit.Timestamp, audit.RouteSlug, audit.TenantID, audit.TokenID, audit.Method, audit.Status, audit.Upstream); err != nil {
		return err
	}

	_, err := store.execContext(ctx, `DELETE FROM audits WHERE id NOT IN (SELECT id FROM audits ORDER BY timestamp DESC LIMIT 200)`)
	return err
}

func (store *sqlStore) lookupTenantUpstream(ctx context.Context, tenantID string) (string, error) {
	var upstreamURL string
	err := store.queryRowContext(ctx, `SELECT upstream_url FROM tenants WHERE tenant_id = ? LIMIT 1`, tenantID).Scan(&upstreamURL)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("tenantID does not exist")
	}
	if err != nil {
		return "", err
	}
	return upstreamURL, nil
}

func (store *sqlStore) execContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return store.db.ExecContext(ctx, store.rebind(query), args...)
}

func (store *sqlStore) queryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return store.db.QueryContext(ctx, store.rebind(query), args...)
}

func (store *sqlStore) queryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return store.db.QueryRowContext(ctx, store.rebind(query), args...)
}

func (store *sqlStore) rebind(query string) string {
	if store.dialect != "postgres" {
		return query
	}

	var builder strings.Builder
	placeholderIndex := 1
	for _, character := range query {
		if character == '?' {
			builder.WriteString(fmt.Sprintf("$%d", placeholderIndex))
			placeholderIndex++
			continue
		}
		builder.WriteRune(character)
	}

	return builder.String()
}

func scanRoute(scanner interface{ Scan(dest ...any) error }) (routeRecord, error) {
	var route routeRecord
	var methodsJSON string
	if err := scanner.Scan(&route.ID, &route.Slug, &route.TargetPath, &route.TenantID, &route.RequiredScope, &methodsJSON, &route.UpstreamURL); err != nil {
		return routeRecord{}, err
	}
	if err := json.Unmarshal([]byte(methodsJSON), &route.Methods); err != nil {
		return routeRecord{}, err
	}
	return route, nil
}

func scanToken(scanner interface{ Scan(dest ...any) error }) (tokenRecord, error) {
	var token tokenRecord
	var scopesJSON string
	if err := scanner.Scan(&token.ID, &token.Name, &token.TenantID, &scopesJSON, &token.ExpiresAt, &token.LastUsedAt, &token.Preview, &token.Active, &token.Hash); err != nil {
		return tokenRecord{}, err
	}
	if err := json.Unmarshal([]byte(scopesJSON), &token.Scopes); err != nil {
		return tokenRecord{}, err
	}
	return token, nil
}

func translateDBError(err error, fallback string) error {
	message := strings.ToLower(err.Error())
	if strings.Contains(message, "unique") || strings.Contains(message, "duplicate") {
		return fmt.Errorf("%s", fallback)
	}
	return err
}

func newResourceID(prefix string) string {
	return fmt.Sprintf("%s-%s", prefix, strings.Split(uuid.NewString(), "-")[0])
}

func defaultDatabaseURL() string {
	path := os.Getenv("JUST_PROXY_GUARD_DB_PATH")
	if path == "" {
		path = "just-proxy-guard.db"
	}
	return fmt.Sprintf("sqlite://%s", path)
}
