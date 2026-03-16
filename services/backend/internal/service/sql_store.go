package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
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

func newSQLStore(databaseURL string) (string, *sqlStore, error) {
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
	if err := store.runMigrations(context.Background()); err != nil {
		return "", nil, err
	}

	return storeKind, store, nil
}

func databaseConfig(databaseURL string) (string, string, string) {
	trimmed := strings.TrimSpace(databaseURL)
	if trimmed == "" {
		return "sqlite", "file:justgate.db?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", "sqlite"
	}

	if strings.HasPrefix(trimmed, "postgres://") || strings.HasPrefix(trimmed, "postgresql://") {
		return "pgx", trimmed, "postgres"
	}

	if strings.HasPrefix(trimmed, "sqlite://") {
		path := strings.TrimPrefix(trimmed, "sqlite://")
		if path == "" {
			path = "justgate.db"
		}
		return "sqlite", fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", path), "sqlite"
	}

	return "sqlite", trimmed, "sqlite"
}

func (store *sqlStore) seedReferenceData(_ context.Context, _ string) error {
	return nil
}

func (store *sqlStore) CreateLocalAdmin(ctx context.Context, account localAdminRecord) (localAdminRecord, error) {
	_, err := store.execContext(ctx, `INSERT INTO local_admin_users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`, account.ID, account.Email, account.Name, account.PasswordHash, account.CreatedAt)
	if err != nil {
		return localAdminRecord{}, translateDBError(err, "email already exists")
	}
	return account, nil
}

func (store *sqlStore) GetLocalAdminByEmail(ctx context.Context, email string) (localAdminRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, email, name, password_hash, created_at FROM local_admin_users WHERE email = ? LIMIT 1`, email)
	var account localAdminRecord
	if err := row.Scan(&account.ID, &account.Email, &account.Name, &account.PasswordHash, &account.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return localAdminRecord{}, false, nil
		}
		return localAdminRecord{}, false, err
	}
	return account, true, nil
}

func (store *sqlStore) ListTenants(ctx context.Context) ([]tenantRecord, error) {
	var rows *sql.Rows
	var err error
	if orgID := orgIDFromContext(ctx); orgID != "" {
		rows, err = store.queryContext(ctx, `SELECT id, name, tenant_id, upstream_url, auth_mode, header_name, org_id, health_check_path FROM tenants WHERE org_id = ? ORDER BY created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, name, tenant_id, upstream_url, auth_mode, header_name, org_id, health_check_path FROM tenants ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]tenantRecord, 0)
	for rows.Next() {
		var tenant tenantRecord
		if err := rows.Scan(&tenant.ID, &tenant.Name, &tenant.TenantID, &tenant.Upstream, &tenant.AuthMode, &tenant.HeaderName, &tenant.OrgID, &tenant.HealthCheckPath); err != nil {
			return nil, err
		}
		items = append(items, tenant)
	}
	return items, rows.Err()
}

func (store *sqlStore) ListRoutes(ctx context.Context) ([]routeRecord, error) {
	var rows *sql.Rows
	var err error
	if orgID := orgIDFromContext(ctx); orgID != "" {
		rows, err = store.queryContext(ctx, `SELECT r.id, r.slug, r.target_path, r.tenant_id, r.required_scope, r.methods_json, r.upstream_url, r.rate_limit_rpm, r.rate_limit_burst, r.allow_cidrs, r.deny_cidrs FROM routes r INNER JOIN tenants tn ON r.tenant_id = tn.tenant_id WHERE tn.org_id = ? ORDER BY r.created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url, rate_limit_rpm, rate_limit_burst, allow_cidrs, deny_cidrs FROM routes ORDER BY created_at DESC`)
	}
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
	var rows *sql.Rows
	var err error
	if orgID := orgIDFromContext(ctx); orgID != "" {
		rows, err = store.queryContext(ctx, `SELECT tok.id, tok.name, tok.tenant_id, tok.scopes_json, tok.expires_at, tok.last_used_at, tok.preview, tok.active, tok.token_hash, tok.rate_limit_rpm, tok.rate_limit_burst, tok.created_at FROM tokens tok INNER JOIN tenants tn ON tok.tenant_id = tn.tenant_id WHERE tn.org_id = ? ORDER BY tok.created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, rate_limit_rpm, rate_limit_burst, created_at FROM tokens ORDER BY created_at DESC`)
	}
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
	var rows *sql.Rows
	var err error
	if orgID := orgIDFromContext(ctx); orgID != "" {
		rows, err = store.queryContext(ctx, `SELECT a.id, a.timestamp, a.route_slug, a.tenant_id, a.token_id, a.method, a.status, a.upstream_url, COALESCE(a.latency_ms, 0), COALESCE(a.request_path, '') FROM audits a INNER JOIN tenants tn ON a.tenant_id = tn.tenant_id WHERE tn.org_id = ? ORDER BY a.timestamp DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, timestamp, route_slug, tenant_id, token_id, method, status, upstream_url, COALESCE(latency_ms, 0), COALESCE(request_path, '') FROM audits ORDER BY timestamp DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]auditRecord, 0)
	for rows.Next() {
		var audit auditRecord
		if err := rows.Scan(&audit.ID, &audit.Timestamp, &audit.RouteSlug, &audit.TenantID, &audit.TokenID, &audit.Method, &audit.Status, &audit.Upstream, &audit.LatencyMs, &audit.RequestPath); err != nil {
			return nil, err
		}
		items = append(items, audit)
	}
	return items, rows.Err()
}

func (store *sqlStore) CreateTenant(ctx context.Context, payload createTenantRequest) (tenantRecord, error) {
	orgID := orgIDFromContext(ctx)
	tenant := tenantRecord{
		ID:              newResourceID("tenant"),
		Name:            payload.Name,
		TenantID:        payload.TenantID,
		Upstream:        payload.Upstream,
		AuthMode:        payload.AuthMode,
		HeaderName:      payload.HeaderName,
		OrgID:           orgID,
		HealthCheckPath: payload.HealthCheckPath,
	}

	_, err := store.execContext(ctx, `INSERT INTO tenants (id, name, tenant_id, upstream_url, auth_mode, header_name, org_id, health_check_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, tenant.ID, tenant.Name, tenant.TenantID, tenant.Upstream, tenant.AuthMode, tenant.HeaderName, orgID, tenant.HealthCheckPath, store.now())
	if err != nil {
		return tenantRecord{}, translateDBError(err, "tenantID already exists")
	}

	return tenant, nil
}

func (store *sqlStore) UpdateTenant(ctx context.Context, tenantID string, payload createTenantRequest) (tenantRecord, error) {
	var currentTenantID string
	if err := store.queryRowContext(ctx, `SELECT tenant_id FROM tenants WHERE id = ? LIMIT 1`, tenantID).Scan(&currentTenantID); err != nil {
		if err == sql.ErrNoRows {
			return tenantRecord{}, fmt.Errorf("tenant not found")
		}
		return tenantRecord{}, err
	}

	result, err := store.execContext(ctx, `UPDATE tenants SET name = ?, tenant_id = ?, upstream_url = ?, auth_mode = ?, header_name = ?, health_check_path = ? WHERE id = ?`, payload.Name, payload.TenantID, payload.Upstream, payload.AuthMode, payload.HeaderName, payload.HealthCheckPath, tenantID)
	if err != nil {
		return tenantRecord{}, translateDBError(err, "tenantID already exists")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return tenantRecord{}, err
	}
	if rowsAffected == 0 {
		return tenantRecord{}, fmt.Errorf("tenant not found")
	}

	if _, err := store.execContext(ctx, `UPDATE routes SET tenant_id = ?, upstream_url = ? WHERE tenant_id = ?`, payload.TenantID, payload.Upstream, currentTenantID); err != nil {
		return tenantRecord{}, err
	}
	if _, err := store.execContext(ctx, `UPDATE tokens SET tenant_id = ? WHERE tenant_id = ?`, payload.TenantID, currentTenantID); err != nil {
		return tenantRecord{}, err
	}

	return tenantRecord{
		ID:              tenantID,
		Name:            payload.Name,
		TenantID:        payload.TenantID,
		Upstream:        payload.Upstream,
		AuthMode:        payload.AuthMode,
		HeaderName:      payload.HeaderName,
		HealthCheckPath: payload.HealthCheckPath,
	}, nil
}

func (store *sqlStore) DeleteTenant(ctx context.Context, tenantID string) error {
	var currentTenantID string
	if err := store.queryRowContext(ctx, `SELECT tenant_id FROM tenants WHERE id = ? LIMIT 1`, tenantID).Scan(&currentTenantID); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("tenant not found")
		}
		return err
	}

	var routeCount int
	if err := store.queryRowContext(ctx, `SELECT COUNT(*) FROM routes WHERE tenant_id = ?`, currentTenantID).Scan(&routeCount); err != nil {
		return err
	}
	if routeCount > 0 {
		return fmt.Errorf("tenant has routes; delete routes first")
	}

	var tokenCount int
	if err := store.queryRowContext(ctx, `SELECT COUNT(*) FROM tokens WHERE tenant_id = ?`, currentTenantID).Scan(&tokenCount); err != nil {
		return err
	}
	if tokenCount > 0 {
		return fmt.Errorf("tenant has tokens; delete or revoke tokens first")
	}

	result, err := store.execContext(ctx, `DELETE FROM tenants WHERE id = ?`, tenantID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("tenant not found")
	}

	return nil
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
		ID:             newResourceID("route"),
		Slug:           payload.Slug,
		TargetPath:     payload.TargetPath,
		TenantID:       payload.TenantID,
		RequiredScope:  payload.RequiredScope,
		Methods:        methods,
		UpstreamURL:    upstreamURL,
		RateLimitRPM:   payload.RateLimitRPM,
		RateLimitBurst: payload.RateLimitBurst,
		AllowCIDRs:     payload.AllowCIDRs,
		DenyCIDRs:      payload.DenyCIDRs,
	}

	_, err = store.execContext(ctx, `INSERT INTO routes (id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url, rate_limit_rpm, rate_limit_burst, allow_cidrs, deny_cidrs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, route.ID, route.Slug, route.TargetPath, route.TenantID, route.RequiredScope, string(methodsJSON), route.UpstreamURL, route.RateLimitRPM, route.RateLimitBurst, route.AllowCIDRs, route.DenyCIDRs, store.now())
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

	result, err := store.execContext(ctx, `UPDATE routes SET slug = ?, target_path = ?, tenant_id = ?, required_scope = ?, methods_json = ?, upstream_url = ?, rate_limit_rpm = ?, rate_limit_burst = ?, allow_cidrs = ?, deny_cidrs = ? WHERE id = ?`, payload.Slug, payload.TargetPath, payload.TenantID, payload.RequiredScope, string(methodsJSON), upstreamURL, payload.RateLimitRPM, payload.RateLimitBurst, payload.AllowCIDRs, payload.DenyCIDRs, routeID)
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
		ID:             routeID,
		Slug:           payload.Slug,
		TargetPath:     payload.TargetPath,
		TenantID:       payload.TenantID,
		RequiredScope:  payload.RequiredScope,
		Methods:        methods,
		UpstreamURL:    upstreamURL,
		RateLimitRPM:   payload.RateLimitRPM,
		RateLimitBurst: payload.RateLimitBurst,
		AllowCIDRs:     payload.AllowCIDRs,
		DenyCIDRs:      payload.DenyCIDRs,
	}, nil
}

func (store *sqlStore) DeleteRoute(ctx context.Context, routeID string) error {
	result, err := store.execContext(ctx, `DELETE FROM routes WHERE id = ?`, routeID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("route not found")
	}

	return nil
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
		ID:             newResourceID("tok"),
		Name:           payload.Name,
		TenantID:       payload.TenantID,
		Scopes:         scopes,
		ExpiresAt:      expiresAt,
		LastUsedAt:     store.now(),
		Preview:        previewSecret(secret),
		Active:         true,
		Hash:           hashToken(secret),
		RateLimitRPM:   payload.RateLimitRPM,
		RateLimitBurst: payload.RateLimitBurst,
	}

	_, err = store.execContext(ctx, `INSERT INTO tokens (id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, rate_limit_rpm, rate_limit_burst, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, token.ID, token.Name, token.TenantID, string(scopesJSON), token.ExpiresAt, token.LastUsedAt, token.Preview, token.Active, token.Hash, token.RateLimitRPM, token.RateLimitBurst, store.now())
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

	row := store.queryRowContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, rate_limit_rpm, rate_limit_burst, created_at FROM tokens WHERE id = ?`, tokenID)
	return scanToken(row)
}

func (store *sqlStore) DeleteToken(ctx context.Context, tokenID string) error {
	result, err := store.execContext(ctx, `DELETE FROM tokens WHERE id = ?`, tokenID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("token not found")
	}

	return nil
}

func (store *sqlStore) RouteBySlug(ctx context.Context, slug string) (routeRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url, rate_limit_rpm, rate_limit_burst, allow_cidrs, deny_cidrs FROM routes WHERE slug = ? LIMIT 1`, slug)
	route, err := scanRoute(row)
	if err == sql.ErrNoRows {
		return routeRecord{}, false, nil
	}
	if err != nil {
		return routeRecord{}, false, err
	}
	return route, true, nil
}

func (store *sqlStore) GetTenantByTenantID(ctx context.Context, tenantID string) (tenantRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, name, tenant_id, upstream_url, auth_mode, header_name, org_id, health_check_path FROM tenants WHERE tenant_id = ? LIMIT 1`, tenantID)
	var t tenantRecord
	if err := row.Scan(&t.ID, &t.Name, &t.TenantID, &t.Upstream, &t.AuthMode, &t.HeaderName, &t.OrgID, &t.HealthCheckPath); err != nil {
		if err == sql.ErrNoRows {
			return tenantRecord{}, false, nil
		}
		return tenantRecord{}, false, err
	}
	return t, true, nil
}

func (store *sqlStore) ValidateToken(ctx context.Context, secret string) (tokenRecord, bool, error) {
	hashedSecret := hashToken(secret)
	now := store.now()

	row := store.queryRowContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, rate_limit_rpm, rate_limit_burst, created_at FROM tokens WHERE token_hash = ? AND active = ? AND expires_at > ? LIMIT 1`, hashedSecret, true, now)
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

	if _, err := store.execContext(ctx, `INSERT INTO audits (id, timestamp, route_slug, tenant_id, token_id, method, status, upstream_url, latency_ms, request_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, audit.ID, audit.Timestamp, audit.RouteSlug, audit.TenantID, audit.TokenID, audit.Method, audit.Status, audit.Upstream, audit.LatencyMs, audit.RequestPath); err != nil {
		return err
	}

	retentionLimit := 2000
	_, err := store.execContext(ctx, `DELETE FROM audits WHERE id NOT IN (SELECT id FROM audits ORDER BY timestamp DESC LIMIT ?)`, retentionLimit)
	return err
}

func (store *sqlStore) lookupTenantUpstream(ctx context.Context, tenantID string) (string, error) {
	var upstreamURL string
	var err error
	if orgID := orgIDFromContext(ctx); orgID != "" {
		err = store.queryRowContext(ctx, `SELECT upstream_url FROM tenants WHERE tenant_id = ? AND org_id = ? LIMIT 1`, tenantID, orgID).Scan(&upstreamURL)
	} else {
		err = store.queryRowContext(ctx, `SELECT upstream_url FROM tenants WHERE tenant_id = ? LIMIT 1`, tenantID).Scan(&upstreamURL)
	}
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
	if err := scanner.Scan(&route.ID, &route.Slug, &route.TargetPath, &route.TenantID, &route.RequiredScope, &methodsJSON, &route.UpstreamURL, &route.RateLimitRPM, &route.RateLimitBurst, &route.AllowCIDRs, &route.DenyCIDRs); err != nil {
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
	if err := scanner.Scan(&token.ID, &token.Name, &token.TenantID, &scopesJSON, &token.ExpiresAt, &token.LastUsedAt, &token.Preview, &token.Active, &token.Hash, &token.RateLimitRPM, &token.RateLimitBurst, &token.CreatedAt); err != nil {
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
	path := os.Getenv("JUST_GATE_DB_PATH")
	if path == "" {
		path = "justgate.db"
	}
	return fmt.Sprintf("sqlite://%s", path)
}

func (store *sqlStore) UpsertUser(ctx context.Context, user userRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO users (id, email, name, source, created_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name`,
		user.ID, user.Email, user.Name, user.Source, user.CreatedAt)
	return err
}

func (store *sqlStore) GetUserByEmail(ctx context.Context, email string) (userRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, email, name, source, created_at FROM users WHERE lower(email) = lower(?) LIMIT 1`, email)
	var u userRecord
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Source, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return userRecord{}, false, nil
		}
		return userRecord{}, false, err
	}
	return u, true, nil
}

func (store *sqlStore) GetUserByID(ctx context.Context, userID string) (userRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, email, name, source, created_at FROM users WHERE id = ? LIMIT 1`, userID)
	var u userRecord
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Source, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return userRecord{}, false, nil
		}
		return userRecord{}, false, err
	}
	return u, true, nil
}

func (store *sqlStore) CreateOrg(ctx context.Context, name, createdBy string) (orgRecord, error) {
	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return orgRecord{}, err
	}
	org := orgRecord{
		ID:        newResourceID("org"),
		Name:      name,
		CreatedBy: createdBy,
		CreatedAt: store.now(),
	}
	if _, err := tx.ExecContext(ctx, store.rebind(`INSERT INTO organizations (id, name, created_by, created_at) VALUES (?, ?, ?, ?)`), org.ID, org.Name, org.CreatedBy, org.CreatedAt); err != nil {
		_ = tx.Rollback()
		return orgRecord{}, err
	}
	if _, err := tx.ExecContext(ctx, store.rebind(`INSERT INTO org_memberships (org_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`), org.ID, createdBy, "owner", store.now()); err != nil {
		_ = tx.Rollback()
		return orgRecord{}, err
	}
	if err := tx.Commit(); err != nil {
		return orgRecord{}, err
	}
	org.Role = "owner"
	return org, nil
}

func (store *sqlStore) ListOrgs(ctx context.Context, userID string) ([]orgRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT o.id, o.name, o.created_by, m.role, o.created_at
		 FROM organizations o
		 INNER JOIN org_memberships m ON o.id = m.org_id
		 WHERE m.user_id = ?
		 ORDER BY o.created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]orgRecord, 0)
	for rows.Next() {
		var org orgRecord
		if err := rows.Scan(&org.ID, &org.Name, &org.CreatedBy, &org.Role, &org.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, org)
	}
	return items, rows.Err()
}

func (store *sqlStore) GetOrgMembership(ctx context.Context, orgID, userID string) (orgMemberRecord, bool, error) {
	row := store.queryRowContext(ctx,
		`SELECT m.org_id, m.user_id, m.role, m.joined_at, COALESCE(u.name,''), COALESCE(u.email,'')
		 FROM org_memberships m
		 LEFT JOIN users u ON m.user_id = u.id
		 WHERE m.org_id = ? AND m.user_id = ? LIMIT 1`, orgID, userID)
	var m orgMemberRecord
	if err := row.Scan(&m.OrgID, &m.UserID, &m.Role, &m.JoinedAt, &m.UserName, &m.UserEmail); err != nil {
		if err == sql.ErrNoRows {
			return orgMemberRecord{}, false, nil
		}
		return orgMemberRecord{}, false, err
	}
	return m, true, nil
}

func (store *sqlStore) AddOrgMember(ctx context.Context, orgID, userID, role string) error {
	_, err := store.execContext(ctx,
		`INSERT INTO org_memberships (org_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role`,
		orgID, userID, role, store.now())
	return err
}

func (store *sqlStore) RemoveOrgMember(ctx context.Context, orgID, userID string) error {
	result, err := store.execContext(ctx, `DELETE FROM org_memberships WHERE org_id = ? AND user_id = ?`, orgID, userID)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("member not found")
	}
	return nil
}

func (store *sqlStore) ListOrgMembers(ctx context.Context, orgID string) ([]orgMemberRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT m.org_id, m.user_id, m.role, m.joined_at, COALESCE(u.name,''), COALESCE(u.email,'')
		 FROM org_memberships m
		 LEFT JOIN users u ON m.user_id = u.id
		 WHERE m.org_id = ?
		 ORDER BY m.joined_at ASC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]orgMemberRecord, 0)
	for rows.Next() {
		var m orgMemberRecord
		if err := rows.Scan(&m.OrgID, &m.UserID, &m.Role, &m.JoinedAt, &m.UserName, &m.UserEmail); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (store *sqlStore) CreateOrgInvite(ctx context.Context, orgID, createdBy string, expiresAt time.Time, maxUses int) (orgInviteRecord, error) {
	code, err := generateInviteCode()
	if err != nil {
		return orgInviteRecord{}, err
	}
	invite := orgInviteRecord{
		ID:        newResourceID("inv"),
		OrgID:     orgID,
		Code:      code,
		CreatedBy: createdBy,
		ExpiresAt: expiresAt,
		MaxUses:   maxUses,
		UseCount:  0,
		CreatedAt: store.now(),
	}
	_, err = store.execContext(ctx,
		`INSERT INTO org_invites (id, org_id, code, created_by, expires_at, max_uses, use_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		invite.ID, invite.OrgID, invite.Code, invite.CreatedBy, invite.ExpiresAt, invite.MaxUses, invite.UseCount, invite.CreatedAt)
	if err != nil {
		return orgInviteRecord{}, err
	}
	return invite, nil
}

func (store *sqlStore) GetOrgInviteByCode(ctx context.Context, code string) (orgInviteRecord, bool, error) {
	row := store.queryRowContext(ctx,
		`SELECT id, org_id, code, created_by, expires_at, max_uses, use_count, created_at FROM org_invites WHERE code = ? LIMIT 1`, code)
	var inv orgInviteRecord
	if err := row.Scan(&inv.ID, &inv.OrgID, &inv.Code, &inv.CreatedBy, &inv.ExpiresAt, &inv.MaxUses, &inv.UseCount, &inv.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return orgInviteRecord{}, false, nil
		}
		return orgInviteRecord{}, false, err
	}
	return inv, true, nil
}

func (store *sqlStore) ConsumeOrgInvite(ctx context.Context, code, userID string) (string, error) {
	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}

	var inv orgInviteRecord
	row := tx.QueryRowContext(ctx, store.rebind(`SELECT id, org_id, expires_at, max_uses, use_count FROM org_invites WHERE code = ? LIMIT 1`), code)
	if err := row.Scan(&inv.ID, &inv.OrgID, &inv.ExpiresAt, &inv.MaxUses, &inv.UseCount); err != nil {
		_ = tx.Rollback()
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("invite not found")
		}
		return "", err
	}

	if store.now().After(inv.ExpiresAt) {
		_ = tx.Rollback()
		return "", fmt.Errorf("invite has expired")
	}
	if inv.MaxUses > 0 && inv.UseCount >= inv.MaxUses {
		_ = tx.Rollback()
		return "", fmt.Errorf("invite has reached its usage limit")
	}

	if _, err := tx.ExecContext(ctx, store.rebind(`UPDATE org_invites SET use_count = use_count + 1 WHERE id = ?`), inv.ID); err != nil {
		_ = tx.Rollback()
		return "", err
	}
	if _, err := tx.ExecContext(ctx, store.rebind(
		`INSERT INTO org_memberships (org_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(org_id, user_id) DO NOTHING`),
		inv.OrgID, userID, "member", store.now()); err != nil {
		_ = tx.Rollback()
		return "", err
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return inv.OrgID, nil
}

func generateInviteCode() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// ── OIDC config store methods ──────────────────────────────────────────

func (store *sqlStore) GetOIDCConfig(ctx context.Context) (oidcConfigRecord, bool, error) {
	var cfg oidcConfigRecord
	err := store.queryRowContext(ctx, `SELECT id, issuer, client_id, client_secret_encrypted, display_name, groups_claim, enabled, updated_at FROM oidc_config WHERE id = 'global' LIMIT 1`).Scan(
		&cfg.ID, &cfg.Issuer, &cfg.ClientID, &cfg.ClientSecretEncrypted, &cfg.DisplayName, &cfg.GroupsClaim, &cfg.Enabled, &cfg.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return oidcConfigRecord{}, false, nil
		}
		return oidcConfigRecord{}, false, err
	}
	return cfg, true, nil
}

func (store *sqlStore) UpsertOIDCConfig(ctx context.Context, cfg oidcConfigRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO oidc_config (id, issuer, client_id, client_secret_encrypted, display_name, groups_claim, enabled, updated_at)
		 VALUES ('global', ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET issuer=?, client_id=?, client_secret_encrypted=?, display_name=?, groups_claim=?, enabled=?, updated_at=?`,
		cfg.Issuer, cfg.ClientID, cfg.ClientSecretEncrypted, cfg.DisplayName, cfg.GroupsClaim, cfg.Enabled, cfg.UpdatedAt,
		cfg.Issuer, cfg.ClientID, cfg.ClientSecretEncrypted, cfg.DisplayName, cfg.GroupsClaim, cfg.Enabled, cfg.UpdatedAt,
	)
	return err
}

func (store *sqlStore) ListOIDCOrgMappings(ctx context.Context) ([]oidcOrgMappingRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT m.id, m.oidc_group, m.org_id, m.created_at FROM oidc_org_mappings m ORDER BY m.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]oidcOrgMappingRecord, 0)
	for rows.Next() {
		var m oidcOrgMappingRecord
		if err := rows.Scan(&m.ID, &m.OIDCGroup, &m.OrgID, &m.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (store *sqlStore) CreateOIDCOrgMapping(ctx context.Context, mapping oidcOrgMappingRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO oidc_org_mappings (id, oidc_group, org_id, created_at) VALUES (?, ?, ?, ?)`,
		mapping.ID, mapping.OIDCGroup, mapping.OrgID, mapping.CreatedAt,
	)
	return translateDBError(err, "mapping for this group already exists")
}

func (store *sqlStore) DeleteOIDCOrgMapping(ctx context.Context, id string) error {
	result, err := store.execContext(ctx, `DELETE FROM oidc_org_mappings WHERE id = ?`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("mapping not found")
	}
	return nil
}

// ── Upstream health store methods ──────────────────────────────────────

// ── Platform admin store methods ───────────────────────────────────────

type platformAdminRecord struct {
	UserID    string
	GrantedBy string
	GrantedAt time.Time
	UserName  string
	UserEmail string
}

func (store *sqlStore) IsPlatformAdmin(ctx context.Context, userID string) (bool, error) {
	var count int
	err := store.queryRowContext(ctx, `SELECT COUNT(*) FROM platform_admins WHERE user_id = ?`, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (store *sqlStore) ListPlatformAdmins(ctx context.Context) ([]platformAdminRecord, error) {
	rows, err := store.queryContext(ctx, `
		SELECT pa.user_id, pa.granted_by, pa.granted_at, COALESCE(u.name, ''), COALESCE(u.email, '')
		FROM platform_admins pa
		LEFT JOIN users u ON pa.user_id = u.id
		ORDER BY pa.granted_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]platformAdminRecord, 0)
	for rows.Next() {
		var r platformAdminRecord
		if err := rows.Scan(&r.UserID, &r.GrantedBy, &r.GrantedAt, &r.UserName, &r.UserEmail); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (store *sqlStore) CountPlatformAdmins(ctx context.Context) (int, error) {
	var count int
	return count, store.queryRowContext(ctx, `SELECT COUNT(*) FROM platform_admins`).Scan(&count)
}

func (store *sqlStore) GrantPlatformAdmin(ctx context.Context, userID, grantedBy string) error {
	_, err := store.execContext(ctx,
		`INSERT INTO platform_admins (user_id, granted_by, granted_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO NOTHING`,
		userID, grantedBy, store.now())
	return err
}

func (store *sqlStore) RevokePlatformAdmin(ctx context.Context, userID string) error {
	result, err := store.execContext(ctx, `DELETE FROM platform_admins WHERE user_id = ?`, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("platform admin not found")
	}
	return nil
}

func (store *sqlStore) ListAllUsers(ctx context.Context) ([]userRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT id, email, name, source, created_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]userRecord, 0)
	for rows.Next() {
		var u userRecord
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Source, &u.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, u)
	}
	return items, rows.Err()
}

func (store *sqlStore) DeleteUser(ctx context.Context, userID string) error {
	// Remove from all org memberships first
	if _, err := store.execContext(ctx, `DELETE FROM org_memberships WHERE user_id = ?`, userID); err != nil {
		return err
	}
	result, err := store.execContext(ctx, `DELETE FROM users WHERE id = ?`, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("user not found")
	}
	// Also clean up from platform_admins if present
	_, _ = store.execContext(ctx, `DELETE FROM platform_admins WHERE user_id = ?`, userID)
	return nil
}

func (store *sqlStore) ListAllOrgs(ctx context.Context) ([]orgRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT id, name, created_by, created_at FROM organizations ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]orgRecord, 0)
	for rows.Next() {
		var o orgRecord
		if err := rows.Scan(&o.ID, &o.Name, &o.CreatedBy, &o.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	return items, rows.Err()
}

func (store *sqlStore) DeleteOrg(ctx context.Context, orgID string) error {
	// Delete cascade: memberships, invites, tenants (and their routes/tokens/audits)
	tenantRows, err := store.queryContext(ctx, `SELECT tenant_id FROM tenants WHERE org_id = ?`, orgID)
	if err != nil {
		return err
	}
	var tenantIDs []string
	for tenantRows.Next() {
		var tid string
		if scanErr := tenantRows.Scan(&tid); scanErr != nil {
			_ = tenantRows.Close()
			return scanErr
		}
		tenantIDs = append(tenantIDs, tid)
	}
	_ = tenantRows.Close()
	if err := tenantRows.Err(); err != nil {
		return err
	}

	for _, tid := range tenantIDs {
		if _, err := store.execContext(ctx, `DELETE FROM audits WHERE tenant_id = ?`, tid); err != nil {
			return err
		}
		if _, err := store.execContext(ctx, `DELETE FROM tokens WHERE tenant_id = ?`, tid); err != nil {
			return err
		}
		if _, err := store.execContext(ctx, `DELETE FROM routes WHERE tenant_id = ?`, tid); err != nil {
			return err
		}
	}
	if _, err := store.execContext(ctx, `DELETE FROM tenants WHERE org_id = ?`, orgID); err != nil {
		return err
	}
	if _, err := store.execContext(ctx, `DELETE FROM org_invites WHERE org_id = ?`, orgID); err != nil {
		return err
	}
	if _, err := store.execContext(ctx, `DELETE FROM org_memberships WHERE org_id = ?`, orgID); err != nil {
		return err
	}
	result, err := store.execContext(ctx, `DELETE FROM organizations WHERE id = ?`, orgID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("org not found")
	}
	return nil
}

func (store *sqlStore) GetOrgWithMemberCount(ctx context.Context, orgID string) (orgRecord, int, error) {
	var o orgRecord
	err := store.queryRowContext(ctx, `SELECT id, name, created_by, created_at FROM organizations WHERE id = ? LIMIT 1`, orgID).Scan(&o.ID, &o.Name, &o.CreatedBy, &o.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return orgRecord{}, 0, fmt.Errorf("org not found")
		}
		return orgRecord{}, 0, err
	}
	var count int
	if err := store.queryRowContext(ctx, `SELECT COUNT(*) FROM org_memberships WHERE org_id = ?`, orgID).Scan(&count); err != nil {
		return orgRecord{}, 0, err
	}
	return o, count, nil
}

// ── Paginated audit methods ────────────────────────────────────────────

func (store *sqlStore) ListAuditsPaginated(ctx context.Context, limit, offset int) ([]auditRecord, int, error) {
	orgID := orgIDFromContext(ctx)

	var total int
	var countErr error
	if orgID != "" {
		countErr = store.queryRowContext(ctx,
			`SELECT COUNT(*) FROM audits a INNER JOIN tenants tn ON a.tenant_id = tn.tenant_id WHERE tn.org_id = ?`, orgID).Scan(&total)
	} else {
		countErr = store.queryRowContext(ctx, `SELECT COUNT(*) FROM audits`).Scan(&total)
	}
	if countErr != nil {
		return nil, 0, countErr
	}

	var rows *sql.Rows
	var err error
	if orgID != "" {
		rows, err = store.queryContext(ctx,
			`SELECT a.id, a.timestamp, a.route_slug, a.tenant_id, a.token_id, a.method, a.status, a.upstream_url, COALESCE(a.latency_ms, 0), COALESCE(a.request_path, '')
			 FROM audits a INNER JOIN tenants tn ON a.tenant_id = tn.tenant_id
			 WHERE tn.org_id = ? ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`,
			orgID, limit, offset)
	} else {
		rows, err = store.queryContext(ctx,
			`SELECT id, timestamp, route_slug, tenant_id, token_id, method, status, upstream_url, COALESCE(latency_ms, 0), COALESCE(request_path, '')
			 FROM audits ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
			limit, offset)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]auditRecord, 0, limit)
	for rows.Next() {
		var audit auditRecord
		if err := rows.Scan(&audit.ID, &audit.Timestamp, &audit.RouteSlug, &audit.TenantID, &audit.TokenID, &audit.Method, &audit.Status, &audit.Upstream, &audit.LatencyMs, &audit.RequestPath); err != nil {
			return nil, 0, err
		}
		items = append(items, audit)
	}
	return items, total, rows.Err()
}

func (store *sqlStore) UpsertUpstreamHealth(ctx context.Context, health upstreamHealthRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO upstream_health (tenant_id, upstream_url, status, last_checked_at, latency_ms, error)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(tenant_id, upstream_url) DO UPDATE SET status=?, last_checked_at=?, latency_ms=?, error=?`,
		health.TenantID, health.UpstreamURL, health.Status, health.LastCheckedAt, health.LatencyMs, health.Error,
		health.Status, health.LastCheckedAt, health.LatencyMs, health.Error,
	)
	return err
}

func (store *sqlStore) ListUpstreamHealth(ctx context.Context) ([]upstreamHealthRecord, error) {
	rows, err := store.queryContext(ctx, `SELECT tenant_id, upstream_url, status, last_checked_at, latency_ms, error FROM upstream_health`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]upstreamHealthRecord, 0)
	for rows.Next() {
		var h upstreamHealthRecord
		if err := rows.Scan(&h.TenantID, &h.UpstreamURL, &h.Status, &h.LastCheckedAt, &h.LatencyMs, &h.Error); err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, rows.Err()
}

// ── Tenant upstreams (load balancing) ──────────────────────────────────

func (store *sqlStore) ListTenantUpstreams(ctx context.Context, tenantID string) ([]tenantUpstreamRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, tenant_id, upstream_url, weight, is_primary, created_at FROM tenant_upstreams WHERE tenant_id = ? ORDER BY is_primary DESC, weight DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]tenantUpstreamRecord, 0)
	for rows.Next() {
		var u tenantUpstreamRecord
		if err := rows.Scan(&u.ID, &u.TenantID, &u.UpstreamURL, &u.Weight, &u.IsPrimary, &u.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, u)
	}
	return items, rows.Err()
}

func (store *sqlStore) CreateTenantUpstream(ctx context.Context, upstream tenantUpstreamRecord) error {
	if upstream.ID == "" {
		upstream.ID = newResourceID("ups")
	}
	if upstream.CreatedAt.IsZero() {
		upstream.CreatedAt = store.now()
	}
	_, err := store.execContext(ctx,
		`INSERT INTO tenant_upstreams (id, tenant_id, upstream_url, weight, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		upstream.ID, upstream.TenantID, upstream.UpstreamURL, upstream.Weight, upstream.IsPrimary, upstream.CreatedAt)
	return err
}

func (store *sqlStore) DeleteTenantUpstream(ctx context.Context, id string) error {
	result, err := store.execContext(ctx, `DELETE FROM tenant_upstreams WHERE id = ?`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("upstream not found")
	}
	return nil
}

func (store *sqlStore) UpdateTenantUpstream(ctx context.Context, id, upstreamURL string, weight int, isPrimary bool) error {
	result, err := store.execContext(ctx,
		`UPDATE tenant_upstreams SET upstream_url = ?, weight = ?, is_primary = ? WHERE id = ?`,
		upstreamURL, weight, isPrimary, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("upstream not found")
	}
	return nil
}

// ── Circuit breaker ────────────────────────────────────────────────────

func (store *sqlStore) GetCircuitBreaker(ctx context.Context, routeID string) (circuitBreakerRecord, bool, error) {
	row := store.queryRowContext(ctx,
		`SELECT route_id, state, failure_count, last_failure_at, last_success_at, opened_at, half_open_at, locked FROM circuit_breakers WHERE route_id = ? LIMIT 1`, routeID)
	var cb circuitBreakerRecord
	var lastFailure, lastSuccess, openedAt, halfOpenAt sql.NullTime
	if err := row.Scan(&cb.RouteID, &cb.State, &cb.FailureCount, &lastFailure, &lastSuccess, &openedAt, &halfOpenAt, &cb.Locked); err != nil {
		if err == sql.ErrNoRows {
			return circuitBreakerRecord{}, false, nil
		}
		return circuitBreakerRecord{}, false, err
	}
	cb.LastFailureAt = lastFailure.Time
	cb.LastSuccessAt = lastSuccess.Time
	cb.OpenedAt = openedAt.Time
	cb.HalfOpenAt = halfOpenAt.Time
	return cb, true, nil
}

func (store *sqlStore) ListCircuitBreakers(ctx context.Context) ([]circuitBreakerRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT route_id, state, failure_count, last_failure_at, last_success_at, opened_at, half_open_at, locked FROM circuit_breakers`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []circuitBreakerRecord
	for rows.Next() {
		var cb circuitBreakerRecord
		var lastFailure, lastSuccess, openedAt, halfOpenAt sql.NullTime
		if err := rows.Scan(&cb.RouteID, &cb.State, &cb.FailureCount, &lastFailure, &lastSuccess, &openedAt, &halfOpenAt, &cb.Locked); err != nil {
			return nil, err
		}
		cb.LastFailureAt = lastFailure.Time
		cb.LastSuccessAt = lastSuccess.Time
		cb.OpenedAt = openedAt.Time
		cb.HalfOpenAt = halfOpenAt.Time
		out = append(out, cb)
	}
	return out, rows.Err()
}

func (store *sqlStore) UpsertCircuitBreaker(ctx context.Context, cb circuitBreakerRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO circuit_breakers (route_id, state, failure_count, last_failure_at, last_success_at, opened_at, half_open_at, locked)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(route_id) DO UPDATE SET state=?, failure_count=?, last_failure_at=?, last_success_at=?, opened_at=?, half_open_at=?, locked=?`,
		cb.RouteID, cb.State, cb.FailureCount, cb.LastFailureAt, cb.LastSuccessAt, cb.OpenedAt, cb.HalfOpenAt, cb.Locked,
		cb.State, cb.FailureCount, cb.LastFailureAt, cb.LastSuccessAt, cb.OpenedAt, cb.HalfOpenAt, cb.Locked)
	return err
}

// ── Upstream health history ────────────────────────────────────────────

func (store *sqlStore) RecordHealthHistory(ctx context.Context, record healthHistoryRecord) error {
	if record.ID == "" {
		record.ID = newResourceID("hh")
	}
	if record.CheckedAt.IsZero() {
		record.CheckedAt = store.now()
	}
	_, err := store.execContext(ctx,
		`INSERT INTO upstream_health_history (id, tenant_id, status, latency_ms, error, checked_at) VALUES (?, ?, ?, ?, ?, ?)`,
		record.ID, record.TenantID, record.Status, record.LatencyMs, record.Error, record.CheckedAt)
	return err
}

func (store *sqlStore) ListHealthHistory(ctx context.Context, tenantID string, limit int) ([]healthHistoryRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, tenant_id, status, latency_ms, error, checked_at FROM upstream_health_history WHERE tenant_id = ? ORDER BY checked_at DESC LIMIT ?`,
		tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]healthHistoryRecord, 0, limit)
	for rows.Next() {
		var h healthHistoryRecord
		if err := rows.Scan(&h.ID, &h.TenantID, &h.Status, &h.LatencyMs, &h.Error, &h.CheckedAt); err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, rows.Err()
}

// ── Admin activity audit ───────────────────────────────────────────────

func (store *sqlStore) RecordAdminAudit(ctx context.Context, audit adminAuditRecord) error {
	if audit.ID == "" {
		audit.ID = newResourceID("aa")
	}
	if audit.Timestamp.IsZero() {
		audit.Timestamp = store.now()
	}
	_, err := store.execContext(ctx,
		`INSERT INTO admin_audits (id, timestamp, user_id, user_email, action, resource_type, resource_id, details, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		audit.ID, audit.Timestamp, audit.UserID, audit.UserEmail, audit.Action, audit.ResourceType, audit.ResourceID, audit.Details, audit.OrgID)
	return err
}

func (store *sqlStore) ListAdminAuditsPaginated(ctx context.Context, limit, offset int) ([]adminAuditRecord, int, error) {
	var total int
	if err := store.queryRowContext(ctx, `SELECT COUNT(*) FROM admin_audits`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := store.queryContext(ctx,
		`SELECT id, timestamp, user_id, user_email, action, resource_type, resource_id, details, org_id FROM admin_audits ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
		limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]adminAuditRecord, 0, limit)
	for rows.Next() {
		var a adminAuditRecord
		if err := rows.Scan(&a.ID, &a.Timestamp, &a.UserID, &a.UserEmail, &a.Action, &a.ResourceType, &a.ResourceID, &a.Details, &a.OrgID); err != nil {
			return nil, 0, err
		}
		items = append(items, a)
	}
	return items, total, rows.Err()
}

// ── Traffic stats ──────────────────────────────────────────────────────

func (store *sqlStore) UpsertTrafficStat(ctx context.Context, stat trafficStatRecord) error {
	if stat.ID == "" {
		stat.ID = newResourceID("ts")
	}
	_, err := store.execContext(ctx,
		`INSERT INTO traffic_stats (id, bucket_start, bucket_minutes, route_slug, tenant_id, token_id, org_id, request_count, error_count, avg_latency_ms, status_2xx, status_4xx, status_5xx)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(bucket_start, route_slug, tenant_id, token_id) DO UPDATE SET
		   request_count = traffic_stats.request_count + excluded.request_count,
		   error_count = traffic_stats.error_count + excluded.error_count,
		   avg_latency_ms = (traffic_stats.avg_latency_ms * traffic_stats.request_count + excluded.avg_latency_ms * excluded.request_count) / (traffic_stats.request_count + excluded.request_count),
		   status_2xx = traffic_stats.status_2xx + excluded.status_2xx,
		   status_4xx = traffic_stats.status_4xx + excluded.status_4xx,
		   status_5xx = traffic_stats.status_5xx + excluded.status_5xx`,
		stat.ID, stat.BucketStart, stat.BucketMinutes, stat.RouteSlug, stat.TenantID, stat.TokenID, stat.OrgID,
		stat.RequestCount, stat.ErrorCount, stat.AvgLatencyMs, stat.Status2xx, stat.Status4xx, stat.Status5xx)
	return err
}

func (store *sqlStore) ListTrafficStats(ctx context.Context, from, to time.Time, orgID string) ([]trafficStatRecord, error) {
	var rows *sql.Rows
	var err error
	if orgID != "" {
		// Stats are stored with org_id='' because the proxy has no org context.
		// Join with tenants to filter by the tenant's org instead.
		rows, err = store.queryContext(ctx,
			`SELECT ts.id, ts.bucket_start, ts.bucket_minutes, ts.route_slug, ts.tenant_id, ts.token_id, ts.org_id, ts.request_count, ts.error_count, ts.avg_latency_ms, ts.status_2xx, ts.status_4xx, ts.status_5xx
			 FROM traffic_stats ts
			 JOIN tenants t ON t.tenant_id = ts.tenant_id
			 WHERE ts.bucket_start >= ? AND ts.bucket_start <= ? AND t.org_id = ? ORDER BY ts.bucket_start ASC`,
			from, to, orgID)
	} else {
		rows, err = store.queryContext(ctx,
			`SELECT id, bucket_start, bucket_minutes, route_slug, tenant_id, token_id, org_id, request_count, error_count, avg_latency_ms, status_2xx, status_4xx, status_5xx
			 FROM traffic_stats WHERE bucket_start >= ? AND bucket_start <= ? ORDER BY bucket_start ASC`,
			from, to)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]trafficStatRecord, 0)
	for rows.Next() {
		var s trafficStatRecord
		if err := rows.Scan(&s.ID, &s.BucketStart, &s.BucketMinutes, &s.RouteSlug, &s.TenantID, &s.TokenID, &s.OrgID, &s.RequestCount, &s.ErrorCount, &s.AvgLatencyMs, &s.Status2xx, &s.Status4xx, &s.Status5xx); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}

func (store *sqlStore) GetTrafficOverview(ctx context.Context, orgID string) (trafficOverviewResult, error) {
	now := store.now()
	currentStart := now.Add(-24 * time.Hour)
	priorStart := now.Add(-48 * time.Hour)

	var result trafficOverviewResult

	scanPeriod := func(from, to time.Time) (int, int, int, error) {
		var totalReqs, totalErrors, avgLat int
		var q string
		var args []any
		if orgID != "" {
			q = `SELECT COALESCE(SUM(ts.request_count),0), COALESCE(SUM(ts.error_count),0), CAST(COALESCE(ROUND(AVG(ts.avg_latency_ms)),0) AS INTEGER) FROM traffic_stats ts JOIN tenants t ON t.tenant_id = ts.tenant_id WHERE ts.bucket_start >= ? AND ts.bucket_start <= ? AND t.org_id = ?`
			args = []any{from, to, orgID}
		} else {
			q = `SELECT COALESCE(SUM(request_count),0), COALESCE(SUM(error_count),0), CAST(COALESCE(ROUND(AVG(avg_latency_ms)),0) AS INTEGER) FROM traffic_stats WHERE bucket_start >= ? AND bucket_start <= ?`
			args = []any{from, to}
		}
		if err := store.queryRowContext(ctx, q, args...).Scan(&totalReqs, &totalErrors, &avgLat); err != nil {
			return 0, 0, 0, err
		}
		return totalReqs, totalErrors, avgLat, nil
	}

	reqs, errs, lat, err := scanPeriod(currentStart, now)
	if err != nil {
		return trafficOverviewResult{}, err
	}
	result.TotalRequests = reqs
	result.AvgLatencyMs = lat
	if reqs > 0 {
		result.ErrorRate = float64(errs) / float64(reqs) * 100
	}

	pReqs, pErrs, pLat, err := scanPeriod(priorStart, currentStart)
	if err != nil {
		return trafficOverviewResult{}, err
	}
	result.PriorRequests = pReqs
	result.PriorAvgLatency = pLat
	if pReqs > 0 {
		result.PriorErrorRate = float64(pErrs) / float64(pReqs) * 100
	}

	return result, nil
}

// ── Session management ─────────────────────────────────────────────────

func (store *sqlStore) CreateAdminSession(ctx context.Context, session adminSessionRecord) error {
	if session.CreatedAt.IsZero() {
		session.CreatedAt = store.now()
	}
	if session.LastSeenAt.IsZero() {
		session.LastSeenAt = session.CreatedAt
	}
	_, err := store.execContext(ctx,
		`INSERT INTO admin_sessions (id, user_id, ip_address, user_agent, created_at, last_seen_at, revoked) VALUES (?, ?, ?, ?, ?, ?, false)
		 ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
		session.ID, session.UserID, session.IPAddress, session.UserAgent, session.CreatedAt, session.LastSeenAt)
	return err
}

func (store *sqlStore) ListAdminSessions(ctx context.Context, userID string) ([]adminSessionRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, user_id, ip_address, user_agent, created_at, last_seen_at, revoked FROM admin_sessions WHERE user_id = ? ORDER BY last_seen_at DESC`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]adminSessionRecord, 0)
	for rows.Next() {
		var s adminSessionRecord
		if err := rows.Scan(&s.ID, &s.UserID, &s.IPAddress, &s.UserAgent, &s.CreatedAt, &s.LastSeenAt, &s.Revoked); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}

func (store *sqlStore) UpdateAdminSessionLastSeen(ctx context.Context, sessionID string, lastSeen time.Time) error {
	_, err := store.execContext(ctx, `UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?`, lastSeen, sessionID)
	return err
}

func (store *sqlStore) RevokeAdminSession(ctx context.Context, sessionID string) error {
	result, err := store.execContext(ctx, `UPDATE admin_sessions SET revoked = ? WHERE id = ?`, true, sessionID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}

func (store *sqlStore) IsSessionRevoked(ctx context.Context, sessionID string) (bool, error) {
	var revoked bool
	err := store.queryRowContext(ctx, `SELECT revoked FROM admin_sessions WHERE id = ? LIMIT 1`, sessionID).Scan(&revoked)
	if err != nil {
		if err == sql.ErrNoRows {
			return true, nil // session not found = treat as revoked
		}
		return false, err
	}
	return revoked, nil
}

// ── Multi-region heartbeats ────────────────────────────────────────────

func (store *sqlStore) UpsertInstanceHeartbeat(ctx context.Context, hb instanceHeartbeatRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO instance_heartbeats (instance_id, region, hostname, version, started_at, last_heartbeat_at, metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(instance_id) DO UPDATE SET region=?, hostname=?, version=?, last_heartbeat_at=?, metadata=?`,
		hb.InstanceID, hb.Region, hb.Hostname, hb.Version, hb.StartedAt, hb.LastHeartbeatAt, hb.Metadata,
		hb.Region, hb.Hostname, hb.Version, hb.LastHeartbeatAt, hb.Metadata)
	return err
}

func (store *sqlStore) ListInstanceHeartbeats(ctx context.Context) ([]instanceHeartbeatRecord, error) {
	// Only return instances that have sent a heartbeat in the last 10 minutes.
	// This prevents accumulating ghost rows from dev restarts or crashed replicas.
	cutoff := store.now().UTC().Add(-10 * time.Minute)
	rows, err := store.queryContext(ctx,
		`SELECT instance_id, region, hostname, version, started_at, last_heartbeat_at, metadata FROM instance_heartbeats WHERE last_heartbeat_at >= ? ORDER BY region, instance_id`,
		cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]instanceHeartbeatRecord, 0)
	for rows.Next() {
		var h instanceHeartbeatRecord
		if err := rows.Scan(&h.InstanceID, &h.Region, &h.Hostname, &h.Version, &h.StartedAt, &h.LastHeartbeatAt, &h.Metadata); err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, rows.Err()
}

// ── Token lifecycle ────────────────────────────────────────────────────

func (store *sqlStore) ListExpiringTokens(ctx context.Context, before time.Time) ([]tokenRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, rate_limit_rpm, rate_limit_burst, created_at FROM tokens WHERE active = ? AND expires_at <= ? ORDER BY expires_at ASC`,
		true, before)
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

// ── Filtered audit queries ─────────────────────────────────────────────

// ── Protected Apps ─────────────────────────────────────────────────────

func (store *sqlStore) ListProtectedApps(ctx context.Context, orgID string) ([]protectedAppRecord, error) {
	var rows *sql.Rows
	var err error
	if orgID != "" {
		rows, err = store.queryContext(ctx, `SELECT id, name, slug, upstream_url, org_id, auth_mode, inject_headers_json, strip_headers_json, extra_ca_pem, rate_limit_rpm, rate_limit_burst, rate_limit_per, allow_cidrs, deny_cidrs, health_check_path, created_at, created_by FROM protected_apps WHERE org_id = ? ORDER BY created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, name, slug, upstream_url, org_id, auth_mode, inject_headers_json, strip_headers_json, extra_ca_pem, rate_limit_rpm, rate_limit_burst, rate_limit_per, allow_cidrs, deny_cidrs, health_check_path, created_at, created_by FROM protected_apps ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]protectedAppRecord, 0)
	for rows.Next() {
		app, err := scanProtectedApp(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, app)
	}
	return items, rows.Err()
}

func (store *sqlStore) GetProtectedApp(ctx context.Context, appID string) (protectedAppRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, name, slug, upstream_url, org_id, auth_mode, inject_headers_json, strip_headers_json, extra_ca_pem, rate_limit_rpm, rate_limit_burst, rate_limit_per, allow_cidrs, deny_cidrs, health_check_path, created_at, created_by FROM protected_apps WHERE id = ? LIMIT 1`, appID)
	app, err := scanProtectedApp(row)
	if err == sql.ErrNoRows {
		return protectedAppRecord{}, false, nil
	}
	if err != nil {
		return protectedAppRecord{}, false, err
	}
	return app, true, nil
}

func (store *sqlStore) GetProtectedAppBySlug(ctx context.Context, slug string) (protectedAppRecord, bool, error) {
	row := store.queryRowContext(ctx, `SELECT id, name, slug, upstream_url, org_id, auth_mode, inject_headers_json, strip_headers_json, extra_ca_pem, rate_limit_rpm, rate_limit_burst, rate_limit_per, allow_cidrs, deny_cidrs, health_check_path, created_at, created_by FROM protected_apps WHERE slug = ? LIMIT 1`, slug)
	app, err := scanProtectedApp(row)
	if err == sql.ErrNoRows {
		return protectedAppRecord{}, false, nil
	}
	if err != nil {
		return protectedAppRecord{}, false, err
	}
	return app, true, nil
}

func (store *sqlStore) CreateProtectedApp(ctx context.Context, payload createAppRequest, orgID, createdBy string) (protectedAppRecord, error) {
	injectJSON, err := json.Marshal(payload.InjectHeaders)
	if err != nil {
		return protectedAppRecord{}, err
	}
	stripJSON, err := json.Marshal(payload.StripHeaders)
	if err != nil {
		return protectedAppRecord{}, err
	}
	app := protectedAppRecord{
		ID:              newResourceID("app"),
		Name:            payload.Name,
		Slug:            payload.Slug,
		UpstreamURL:     payload.UpstreamURL,
		OrgID:           orgID,
		AuthMode:        payload.AuthMode,
		InjectHeaders:   payload.InjectHeaders,
		StripHeaders:    payload.StripHeaders,
		ExtraCAPEM:      payload.ExtraCAPEM,
		RateLimitRPM:    payload.RateLimitRPM,
		RateLimitBurst:  payload.RateLimitBurst,
		RateLimitPer:    payload.RateLimitPer,
		AllowCIDRs:      payload.AllowCIDRs,
		DenyCIDRs:       payload.DenyCIDRs,
		HealthCheckPath: payload.HealthCheckPath,
		CreatedAt:       store.now(),
		CreatedBy:       createdBy,
	}
	if app.AuthMode == "" {
		app.AuthMode = "oidc"
	}
	if app.RateLimitPer == "" {
		app.RateLimitPer = "session"
	}
	_, err = store.execContext(ctx,
		`INSERT INTO protected_apps (id, name, slug, upstream_url, org_id, auth_mode, inject_headers_json, strip_headers_json, extra_ca_pem, rate_limit_rpm, rate_limit_burst, rate_limit_per, allow_cidrs, deny_cidrs, health_check_path, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		app.ID, app.Name, app.Slug, app.UpstreamURL, orgID, app.AuthMode, string(injectJSON), string(stripJSON), app.ExtraCAPEM, app.RateLimitRPM, app.RateLimitBurst, app.RateLimitPer, app.AllowCIDRs, app.DenyCIDRs, app.HealthCheckPath, app.CreatedAt, app.CreatedBy)
	if err != nil {
		return protectedAppRecord{}, translateDBError(err, "slug already exists")
	}
	return app, nil
}

func (store *sqlStore) UpdateProtectedApp(ctx context.Context, appID string, payload createAppRequest) (protectedAppRecord, error) {
	injectJSON, err := json.Marshal(payload.InjectHeaders)
	if err != nil {
		return protectedAppRecord{}, err
	}
	stripJSON, err := json.Marshal(payload.StripHeaders)
	if err != nil {
		return protectedAppRecord{}, err
	}
	result, err := store.execContext(ctx,
		`UPDATE protected_apps SET name = ?, slug = ?, upstream_url = ?, auth_mode = ?, inject_headers_json = ?, strip_headers_json = ?, extra_ca_pem = ?, rate_limit_rpm = ?, rate_limit_burst = ?, rate_limit_per = ?, allow_cidrs = ?, deny_cidrs = ?, health_check_path = ? WHERE id = ?`,
		payload.Name, payload.Slug, payload.UpstreamURL, payload.AuthMode, string(injectJSON), string(stripJSON), payload.ExtraCAPEM, payload.RateLimitRPM, payload.RateLimitBurst, payload.RateLimitPer, payload.AllowCIDRs, payload.DenyCIDRs, payload.HealthCheckPath, appID)
	if err != nil {
		return protectedAppRecord{}, translateDBError(err, "slug already exists")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return protectedAppRecord{}, err
	}
	if rowsAffected == 0 {
		return protectedAppRecord{}, fmt.Errorf("app not found")
	}
	app, _, err := store.GetProtectedApp(ctx, appID)
	return app, err
}

func (store *sqlStore) DeleteProtectedApp(ctx context.Context, appID string) error {
	// Cascade: delete sessions and tokens first
	if _, err := store.execContext(ctx, `DELETE FROM app_sessions WHERE app_id = ?`, appID); err != nil {
		return err
	}
	if _, err := store.execContext(ctx, `DELETE FROM app_tokens WHERE app_id = ?`, appID); err != nil {
		return err
	}
	result, err := store.execContext(ctx, `DELETE FROM protected_apps WHERE id = ?`, appID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("app not found")
	}
	return nil
}

// ── App Sessions ────────────────────────────────────────────────────────

func (store *sqlStore) CreateAppSession(ctx context.Context, session appSessionRecord) error {
	groupsJSON, err := json.Marshal(session.UserGroups)
	if err != nil {
		return err
	}
	if session.ID == "" {
		session.ID = newResourceID("aps")
	}
	_, err = store.execContext(ctx,
		`INSERT INTO app_sessions (id, app_id, user_sub, user_email, user_name, user_groups_json, token_hash, ip, created_at, expires_at, last_used_at, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false)`,
		session.ID, session.AppID, session.UserSub, session.UserEmail, session.UserName, string(groupsJSON), session.TokenHash, session.IP, session.CreatedAt, session.ExpiresAt, session.LastUsedAt)
	return err
}

func (store *sqlStore) GetAppSessionByToken(ctx context.Context, secret string) (appSessionRecord, bool, error) {
	tokenHash := hashToken(secret)
	now := store.now()
	row := store.queryRowContext(ctx,
		`SELECT id, app_id, user_sub, user_email, user_name, user_groups_json, token_hash, ip, created_at, expires_at, last_used_at, revoked FROM app_sessions WHERE token_hash = ? AND revoked = false AND expires_at > ? LIMIT 1`,
		tokenHash, now)
	session, err := scanAppSession(row)
	if err == sql.ErrNoRows {
		return appSessionRecord{}, false, nil
	}
	if err != nil {
		return appSessionRecord{}, false, err
	}
	return session, true, nil
}

func (store *sqlStore) ListAppSessions(ctx context.Context, appID string) ([]appSessionRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, app_id, user_sub, user_email, user_name, user_groups_json, token_hash, ip, created_at, expires_at, last_used_at, revoked FROM app_sessions WHERE app_id = ? AND revoked = false ORDER BY created_at DESC`,
		appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]appSessionRecord, 0)
	for rows.Next() {
		s, err := scanAppSession(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}

func (store *sqlStore) RevokeAppSession(ctx context.Context, sessionID string) error {
	result, err := store.execContext(ctx, `UPDATE app_sessions SET revoked = true WHERE id = ?`, sessionID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}

func (store *sqlStore) TouchAppSession(ctx context.Context, sessionID string, now time.Time) error {
	_, err := store.execContext(ctx, `UPDATE app_sessions SET last_used_at = ? WHERE id = ?`, now, sessionID)
	return err
}

// ── App Tokens ──────────────────────────────────────────────────────────

func (store *sqlStore) CreateAppToken(ctx context.Context, appID, name, secret string, rateLimitRPM, rateLimitBurst int, expiresAt time.Time) (appTokenRecord, error) {
	token := appTokenRecord{
		ID:             newResourceID("atk"),
		Name:           name,
		AppID:          appID,
		TokenHash:      hashToken(secret),
		Preview:        previewSecret(secret),
		Active:         true,
		RateLimitRPM:   rateLimitRPM,
		RateLimitBurst: rateLimitBurst,
		ExpiresAt:      expiresAt,
		LastUsedAt:     store.now(),
		CreatedAt:      store.now(),
	}
	_, err := store.execContext(ctx,
		`INSERT INTO app_tokens (id, name, app_id, token_hash, preview, active, rate_limit_rpm, rate_limit_burst, expires_at, last_used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		token.ID, token.Name, token.AppID, token.TokenHash, token.Preview, token.Active, token.RateLimitRPM, token.RateLimitBurst, token.ExpiresAt, token.LastUsedAt, token.CreatedAt)
	if err != nil {
		return appTokenRecord{}, translateDBError(err, "token creation failed")
	}
	return token, nil
}

func (store *sqlStore) ListAppTokens(ctx context.Context, appID string) ([]appTokenRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, name, app_id, token_hash, preview, active, rate_limit_rpm, rate_limit_burst, expires_at, last_used_at, created_at FROM app_tokens WHERE app_id = ? ORDER BY created_at DESC`,
		appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]appTokenRecord, 0)
	for rows.Next() {
		var t appTokenRecord
		if err := rows.Scan(&t.ID, &t.Name, &t.AppID, &t.TokenHash, &t.Preview, &t.Active, &t.RateLimitRPM, &t.RateLimitBurst, &t.ExpiresAt, &t.LastUsedAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

func (store *sqlStore) ValidateAppToken(ctx context.Context, secret string) (appTokenRecord, bool, error) {
	tokenHash := hashToken(secret)
	now := store.now()
	row := store.queryRowContext(ctx,
		`SELECT id, name, app_id, token_hash, preview, active, rate_limit_rpm, rate_limit_burst, expires_at, last_used_at, created_at FROM app_tokens WHERE token_hash = ? AND active = true AND expires_at > ? LIMIT 1`,
		tokenHash, now)
	var t appTokenRecord
	if err := row.Scan(&t.ID, &t.Name, &t.AppID, &t.TokenHash, &t.Preview, &t.Active, &t.RateLimitRPM, &t.RateLimitBurst, &t.ExpiresAt, &t.LastUsedAt, &t.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return appTokenRecord{}, false, nil
		}
		return appTokenRecord{}, false, err
	}
	t.LastUsedAt = now
	_, _ = store.execContext(ctx, `UPDATE app_tokens SET last_used_at = ? WHERE id = ?`, now, t.ID)
	return t, true, nil
}

func (store *sqlStore) DeleteAppToken(ctx context.Context, tokenID string) error {
	result, err := store.execContext(ctx, `DELETE FROM app_tokens WHERE id = ?`, tokenID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("token not found")
	}
	return nil
}

// ── Protected App scan helpers ─────────────────────────────────────────

func scanProtectedApp(scanner interface{ Scan(dest ...any) error }) (protectedAppRecord, error) {
	var app protectedAppRecord
	var injectJSON, stripJSON string
	if err := scanner.Scan(
		&app.ID, &app.Name, &app.Slug, &app.UpstreamURL, &app.OrgID,
		&app.AuthMode, &injectJSON, &stripJSON, &app.ExtraCAPEM,
		&app.RateLimitRPM, &app.RateLimitBurst, &app.RateLimitPer,
		&app.AllowCIDRs, &app.DenyCIDRs, &app.HealthCheckPath,
		&app.CreatedAt, &app.CreatedBy,
	); err != nil {
		return protectedAppRecord{}, err
	}
	_ = json.Unmarshal([]byte(injectJSON), &app.InjectHeaders)
	_ = json.Unmarshal([]byte(stripJSON), &app.StripHeaders)
	if app.InjectHeaders == nil {
		app.InjectHeaders = []headerInjectionRule{}
	}
	if app.StripHeaders == nil {
		app.StripHeaders = []string{}
	}
	return app, nil
}

func scanAppSession(scanner interface{ Scan(dest ...any) error }) (appSessionRecord, error) {
	var s appSessionRecord
	var groupsJSON string
	if err := scanner.Scan(
		&s.ID, &s.AppID, &s.UserSub, &s.UserEmail, &s.UserName,
		&groupsJSON, &s.TokenHash, &s.IP,
		&s.CreatedAt, &s.ExpiresAt, &s.LastUsedAt, &s.Revoked,
	); err != nil {
		return appSessionRecord{}, err
	}
	_ = json.Unmarshal([]byte(groupsJSON), &s.UserGroups)
	if s.UserGroups == nil {
		s.UserGroups = []string{}
	}
	return s, nil
}

func (store *sqlStore) ListAuditsPaginatedFiltered(ctx context.Context, limit, offset int, filters auditFilters) ([]auditRecord, int, error) {
	orgID := orgIDFromContext(ctx)

	var conditions []string
	var args []any

	if orgID != "" {
		conditions = append(conditions, "tn.org_id = ?")
		args = append(args, orgID)
	}
	if filters.TenantID != "" {
		conditions = append(conditions, "LOWER(a.tenant_id) LIKE '%' || LOWER(?) || '%'")
		args = append(args, filters.TenantID)
	}
	if filters.RouteSlug != "" {
		conditions = append(conditions, "LOWER(a.route_slug) LIKE '%' || LOWER(?) || '%'")
		args = append(args, filters.RouteSlug)
	}
	if filters.TokenID != "" {
		conditions = append(conditions, "a.token_id = ?")
		args = append(args, filters.TokenID)
	}
	if filters.Status == "success" {
		conditions = append(conditions, "a.status >= 200 AND a.status < 400")
	} else if filters.Status == "error" {
		conditions = append(conditions, "a.status >= 400")
	}
	if !filters.From.IsZero() {
		conditions = append(conditions, "a.timestamp >= ?")
		args = append(args, filters.From)
	}
	if !filters.To.IsZero() {
		conditions = append(conditions, "a.timestamp <= ?")
		args = append(args, filters.To)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	joinClause := ""
	if orgID != "" {
		joinClause = " INNER JOIN tenants tn ON a.tenant_id = tn.tenant_id"
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM audits a" + joinClause + whereClause
	if err := store.queryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataQuery := "SELECT a.id, a.timestamp, a.route_slug, a.tenant_id, a.token_id, a.method, a.status, a.upstream_url, COALESCE(a.latency_ms, 0), COALESCE(a.request_path, '') FROM audits a" + joinClause + whereClause + " ORDER BY a.timestamp DESC LIMIT ? OFFSET ?"
	dataArgs := append(args, limit, offset)

	rows, err := store.queryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]auditRecord, 0, limit)
	for rows.Next() {
		var audit auditRecord
		if err := rows.Scan(&audit.ID, &audit.Timestamp, &audit.RouteSlug, &audit.TenantID, &audit.TokenID, &audit.Method, &audit.Status, &audit.Upstream, &audit.LatencyMs, &audit.RequestPath); err != nil {
			return nil, 0, err
		}
		items = append(items, audit)
	}
	return items, total, rows.Err()
}

// ── Provisioning Grants ────────────────────────────────────────────────

func (store *sqlStore) CreateProvisioningGrant(ctx context.Context, record provisioningGrantRecord) (provisioningGrantRecord, error) {
	scopesJSON, err := json.Marshal(record.Scopes)
	if err != nil {
		return provisioningGrantRecord{}, err
	}
	_, err = store.execContext(ctx,
		`INSERT INTO provisioning_grants (id, name, tenant_id, scopes_json, token_ttl_hours, max_uses, use_count, active, grant_hash, preview, rate_limit_rpm, rate_limit_burst, org_id, expires_at, created_at, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, 0, TRUE, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record.ID, record.Name, record.TenantID, string(scopesJSON),
		record.TokenTTLHours, record.MaxUses,
		record.Hash, record.Preview,
		record.RateLimitRPM, record.RateLimitBurst,
		record.OrgID, record.ExpiresAt, record.CreatedAt, record.CreatedBy,
	)
	if err != nil {
		return provisioningGrantRecord{}, err
	}
	return record, nil
}

func (store *sqlStore) ListProvisioningGrants(ctx context.Context) ([]provisioningGrantRecord, error) {
	orgID := orgIDFromContext(ctx)
	var rows *sql.Rows
	var err error
	if orgID != "" {
		rows, err = store.queryContext(ctx,
			`SELECT id, name, tenant_id, scopes_json, token_ttl_hours, max_uses, use_count, active, grant_hash, preview, rate_limit_rpm, rate_limit_burst, org_id, expires_at, created_at, created_by
			 FROM provisioning_grants WHERE org_id = ? ORDER BY created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx,
			`SELECT id, name, tenant_id, scopes_json, token_ttl_hours, max_uses, use_count, active, grant_hash, preview, rate_limit_rpm, rate_limit_burst, org_id, expires_at, created_at, created_by
			 FROM provisioning_grants ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]provisioningGrantRecord, 0)
	for rows.Next() {
		g, err := scanGrant(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, g)
	}
	return items, rows.Err()
}

func (store *sqlStore) GetProvisioningGrantByHash(ctx context.Context, hash string) (provisioningGrantRecord, bool, error) {
	row := store.queryRowContext(ctx,
		`SELECT id, name, tenant_id, scopes_json, token_ttl_hours, max_uses, use_count, active, grant_hash, preview, rate_limit_rpm, rate_limit_burst, org_id, expires_at, created_at, created_by
		 FROM provisioning_grants WHERE grant_hash = ? LIMIT 1`, hash)
	g, err := scanGrant(row)
	if err == sql.ErrNoRows {
		return provisioningGrantRecord{}, false, nil
	}
	if err != nil {
		return provisioningGrantRecord{}, false, err
	}
	return g, true, nil
}

func (store *sqlStore) IncrementGrantUseCount(ctx context.Context, id string, maxUses int) (bool, error) {
	result, err := store.execContext(ctx,
		`UPDATE provisioning_grants SET use_count = use_count + 1
		 WHERE id = ? AND use_count < ? AND active = TRUE AND expires_at > ?`,
		id, maxUses, store.now())
	if err != nil {
		return false, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected > 0, nil
}

func (store *sqlStore) DeleteProvisioningGrant(ctx context.Context, id string) error {
	result, err := store.execContext(ctx, `DELETE FROM provisioning_grants WHERE id = ?`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("grant not found")
	}
	return nil
}

// ── Token analytics ────────────────────────────────────────────────────

func (store *sqlStore) GetTokenByID(ctx context.Context, tokenID string) (tokenRecord, bool, error) {
	row := store.queryRowContext(ctx,
		`SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash, rate_limit_rpm, rate_limit_burst, created_at FROM tokens WHERE id = ? LIMIT 1`,
		tokenID)
	token, err := scanToken(row)
	if err == sql.ErrNoRows {
		return tokenRecord{}, false, nil
	}
	if err != nil {
		return tokenRecord{}, false, err
	}
	return token, true, nil
}

func (store *sqlStore) ListTokenTrafficStats(ctx context.Context, tokenID string, from, to time.Time) ([]trafficStatRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, bucket_start, bucket_minutes, route_slug, tenant_id, token_id, org_id,
		        SUM(request_count), SUM(error_count), ROUND(AVG(avg_latency_ms)),
		        SUM(status_2xx), SUM(status_4xx), SUM(status_5xx)
		 FROM traffic_stats
		 WHERE token_id = ? AND bucket_start >= ? AND bucket_start <= ?
		 GROUP BY bucket_start ORDER BY bucket_start ASC`,
		tokenID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]trafficStatRecord, 0)
	for rows.Next() {
		var s trafficStatRecord
		if err := rows.Scan(&s.ID, &s.BucketStart, &s.BucketMinutes, &s.RouteSlug, &s.TenantID, &s.TokenID, &s.OrgID,
			&s.RequestCount, &s.ErrorCount, &s.AvgLatencyMs, &s.Status2xx, &s.Status4xx, &s.Status5xx); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}

// ── Route traffic drilldown ────────────────────────────────────────────

func (store *sqlStore) ListRouteTrafficStats(ctx context.Context, routeSlug string, from, to time.Time, orgID string) ([]trafficStatRecord, error) {
	var rows *sql.Rows
	var err error
	if orgID != "" {
		rows, err = store.queryContext(ctx,
			`SELECT id, bucket_start, bucket_minutes, route_slug, tenant_id, token_id, org_id,
			        request_count, error_count, avg_latency_ms, status_2xx, status_4xx, status_5xx
			 FROM traffic_stats
			 WHERE route_slug = ? AND org_id = ? AND bucket_start >= ? AND bucket_start <= ?
			 ORDER BY bucket_start ASC`,
			routeSlug, orgID, from, to)
	} else {
		rows, err = store.queryContext(ctx,
			`SELECT id, bucket_start, bucket_minutes, route_slug, tenant_id, token_id, org_id,
			        request_count, error_count, avg_latency_ms, status_2xx, status_4xx, status_5xx
			 FROM traffic_stats
			 WHERE route_slug = ? AND bucket_start >= ? AND bucket_start <= ?
			 ORDER BY bucket_start ASC`,
			routeSlug, from, to)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]trafficStatRecord, 0)
	for rows.Next() {
		var s trafficStatRecord
		if err := rows.Scan(&s.ID, &s.BucketStart, &s.BucketMinutes, &s.RouteSlug, &s.TenantID, &s.TokenID, &s.OrgID,
			&s.RequestCount, &s.ErrorCount, &s.AvgLatencyMs, &s.Status2xx, &s.Status4xx, &s.Status5xx); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}

// ── Org IP allowlist ───────────────────────────────────────────────────

func (store *sqlStore) ListOrgIPRules(ctx context.Context, orgID string) ([]orgIPRuleRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, org_id, cidr, description, created_at, created_by FROM org_ip_rules WHERE org_id = ? ORDER BY created_at ASC`,
		orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]orgIPRuleRecord, 0)
	for rows.Next() {
		var r orgIPRuleRecord
		if err := rows.Scan(&r.ID, &r.OrgID, &r.CIDR, &r.Description, &r.CreatedAt, &r.CreatedBy); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

func (store *sqlStore) CreateOrgIPRule(ctx context.Context, rule orgIPRuleRecord) (orgIPRuleRecord, error) {
	_, err := store.execContext(ctx,
		`INSERT INTO org_ip_rules (id, org_id, cidr, description, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
		rule.ID, rule.OrgID, rule.CIDR, rule.Description, rule.CreatedAt, rule.CreatedBy)
	if err != nil {
		return orgIPRuleRecord{}, err
	}
	return rule, nil
}

func (store *sqlStore) DeleteOrgIPRule(ctx context.Context, ruleID string) error {
	result, err := store.execContext(ctx, `DELETE FROM org_ip_rules WHERE id = ?`, ruleID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("rule not found")
	}
	return nil
}

// ── Grant audit trail ──────────────────────────────────────────────────

func (store *sqlStore) RecordGrantIssuance(ctx context.Context, record grantIssuanceRecord) error {
	_, err := store.execContext(ctx,
		`INSERT INTO grant_issuances (id, grant_id, token_id, agent_name, issued_at) VALUES (?, ?, ?, ?, ?)`,
		record.ID, record.GrantID, record.TokenID, record.AgentName, record.IssuedAt)
	return err
}

func (store *sqlStore) ListGrantIssuances(ctx context.Context, grantID string) ([]grantIssuanceRecord, error) {
	rows, err := store.queryContext(ctx,
		`SELECT id, grant_id, token_id, agent_name, issued_at FROM grant_issuances WHERE grant_id = ? ORDER BY issued_at DESC`,
		grantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]grantIssuanceRecord, 0)
	for rows.Next() {
		var r grantIssuanceRecord
		if err := rows.Scan(&r.ID, &r.GrantID, &r.TokenID, &r.AgentName, &r.IssuedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

// ── System settings ────────────────────────────────────────────────────

func (store *sqlStore) GetSystemSetting(ctx context.Context, key string) (string, bool, error) {
	var value string
	err := store.db.QueryRowContext(ctx, `SELECT value FROM system_settings WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return value, true, nil
}

func (store *sqlStore) SetSystemSetting(ctx context.Context, key, value string) error {
	_, err := store.execContext(ctx,
		`INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, time.Now().UTC())
	return err
}

func (store *sqlStore) PurgeTrafficStats(ctx context.Context, olderThan time.Time) (int64, error) {
	result, err := store.execContext(ctx, `DELETE FROM traffic_stats WHERE bucket_start < ?`, olderThan)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func scanGrant(scanner interface{ Scan(dest ...any) error }) (provisioningGrantRecord, error) {
	var g provisioningGrantRecord
	var scopesJSON string
	if err := scanner.Scan(
		&g.ID, &g.Name, &g.TenantID, &scopesJSON,
		&g.TokenTTLHours, &g.MaxUses, &g.UseCount, &g.Active,
		&g.Hash, &g.Preview, &g.RateLimitRPM, &g.RateLimitBurst,
		&g.OrgID, &g.ExpiresAt, &g.CreatedAt, &g.CreatedBy,
	); err != nil {
		return provisioningGrantRecord{}, err
	}
	if err := json.Unmarshal([]byte(scopesJSON), &g.Scopes); err != nil {
		g.Scopes = []string{}
	}
	return g, nil
}
