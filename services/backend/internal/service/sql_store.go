package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
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
	if err := store.runMigrations(context.Background()); err != nil {
		return "", nil, err
	}

	return storeKind, store, nil
}

func databaseConfig(databaseURL string) (string, string, string) {
	trimmed := strings.TrimSpace(databaseURL)
	if trimmed == "" {
		return "sqlite", "file:just-gate.db?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", "sqlite"
	}

	if strings.HasPrefix(trimmed, "postgres://") || strings.HasPrefix(trimmed, "postgresql://") {
		return "pgx", trimmed, "postgres"
	}

	if strings.HasPrefix(trimmed, "sqlite://") {
		path := strings.TrimPrefix(trimmed, "sqlite://")
		if path == "" {
			path = "just-gate.db"
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
		rows, err = store.queryContext(ctx, `SELECT id, name, tenant_id, upstream_url, auth_mode, header_name, org_id FROM tenants WHERE org_id = ? ORDER BY created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, name, tenant_id, upstream_url, auth_mode, header_name, org_id FROM tenants ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]tenantRecord, 0)
	for rows.Next() {
		var tenant tenantRecord
		if err := rows.Scan(&tenant.ID, &tenant.Name, &tenant.TenantID, &tenant.Upstream, &tenant.AuthMode, &tenant.HeaderName, &tenant.OrgID); err != nil {
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
		rows, err = store.queryContext(ctx, `SELECT r.id, r.slug, r.target_path, r.tenant_id, r.required_scope, r.methods_json, r.upstream_url FROM routes r INNER JOIN tenants tn ON r.tenant_id = tn.tenant_id WHERE tn.org_id = ? ORDER BY r.created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, slug, target_path, tenant_id, required_scope, methods_json, upstream_url FROM routes ORDER BY created_at DESC`)
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
		rows, err = store.queryContext(ctx, `SELECT tok.id, tok.name, tok.tenant_id, tok.scopes_json, tok.expires_at, tok.last_used_at, tok.preview, tok.active, tok.token_hash FROM tokens tok INNER JOIN tenants tn ON tok.tenant_id = tn.tenant_id WHERE tn.org_id = ? ORDER BY tok.created_at DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, name, tenant_id, scopes_json, expires_at, last_used_at, preview, active, token_hash FROM tokens ORDER BY created_at DESC`)
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
		rows, err = store.queryContext(ctx, `SELECT a.id, a.timestamp, a.route_slug, a.tenant_id, a.token_id, a.method, a.status, a.upstream_url FROM audits a INNER JOIN tenants tn ON a.tenant_id = tn.tenant_id WHERE tn.org_id = ? ORDER BY a.timestamp DESC`, orgID)
	} else {
		rows, err = store.queryContext(ctx, `SELECT id, timestamp, route_slug, tenant_id, token_id, method, status, upstream_url FROM audits ORDER BY timestamp DESC`)
	}
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
	orgID := orgIDFromContext(ctx)
	tenant := tenantRecord{
		ID:         newResourceID("tenant"),
		Name:       payload.Name,
		TenantID:   payload.TenantID,
		Upstream:   payload.Upstream,
		AuthMode:   payload.AuthMode,
		HeaderName: payload.HeaderName,
		OrgID:      orgID,
	}

	_, err := store.execContext(ctx, `INSERT INTO tenants (id, name, tenant_id, upstream_url, auth_mode, header_name, org_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, tenant.ID, tenant.Name, tenant.TenantID, tenant.Upstream, tenant.AuthMode, tenant.HeaderName, orgID, store.now())
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

	result, err := store.execContext(ctx, `UPDATE tenants SET name = ?, tenant_id = ?, upstream_url = ?, auth_mode = ?, header_name = ? WHERE id = ?`, payload.Name, payload.TenantID, payload.Upstream, payload.AuthMode, payload.HeaderName, tenantID)
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
		ID:         tenantID,
		Name:       payload.Name,
		TenantID:   payload.TenantID,
		Upstream:   payload.Upstream,
		AuthMode:   payload.AuthMode,
		HeaderName: payload.HeaderName,
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
	path := os.Getenv("JUST_GATE_DB_PATH")
	if path == "" {
		path = "just-gate.db"
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
	row := store.queryRowContext(ctx, `SELECT id, email, name, source, created_at FROM users WHERE email = ? LIMIT 1`, email)
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
