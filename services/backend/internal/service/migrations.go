package service

import (
	"context"
	"fmt"
	"time"
)

type migration struct {
	version    int
	name       string
	statements []string
}

var schemaMigrations = []migration{
	{
		version: 1,
		name:    "create_core_tables",
		statements: []string{
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
		},
	},
	{
		version: 2,
		name:    "create_local_admin_accounts",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS local_admin_users (
				id TEXT PRIMARY KEY,
				email TEXT NOT NULL UNIQUE,
				name TEXT NOT NULL,
				password_hash TEXT NOT NULL,
				created_at TIMESTAMP NOT NULL
			)`,
		},
	},
	{
		version: 3,
		name:    "create_org_tables",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				email TEXT NOT NULL UNIQUE,
				name TEXT NOT NULL,
				source TEXT NOT NULL DEFAULT 'local',
				created_at TIMESTAMP NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS organizations (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				created_by TEXT NOT NULL,
				created_at TIMESTAMP NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS org_memberships (
				org_id TEXT NOT NULL,
				user_id TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'member',
				joined_at TIMESTAMP NOT NULL,
				PRIMARY KEY (org_id, user_id)
			)`,
			`CREATE TABLE IF NOT EXISTS org_invites (
				id TEXT PRIMARY KEY,
				org_id TEXT NOT NULL,
				code TEXT NOT NULL UNIQUE,
				created_by TEXT NOT NULL,
				expires_at TIMESTAMP NOT NULL,
				max_uses INTEGER NOT NULL DEFAULT 1,
				use_count INTEGER NOT NULL DEFAULT 0,
				created_at TIMESTAMP NOT NULL
			)`,
			`CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships (user_id)`,
			`CREATE INDEX IF NOT EXISTS idx_org_invites_code ON org_invites (code)`,
		},
	},
	{
		version: 4,
		name:    "add_org_id_to_tenants",
		statements: []string{
			`ALTER TABLE tenants ADD COLUMN org_id TEXT NOT NULL DEFAULT ''`,
			`CREATE INDEX IF NOT EXISTS idx_tenants_org ON tenants (org_id)`,
		},
	},
	{
		version: 5,
		name:    "create_oidc_config_and_upstream_health",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS oidc_config (
				id TEXT PRIMARY KEY DEFAULT 'global',
				issuer TEXT NOT NULL DEFAULT '',
				client_id TEXT NOT NULL DEFAULT '',
				client_secret_encrypted TEXT NOT NULL DEFAULT '',
				display_name TEXT NOT NULL DEFAULT 'Single Sign-On',
				groups_claim TEXT NOT NULL DEFAULT '',
				enabled BOOLEAN NOT NULL DEFAULT FALSE,
				updated_at TIMESTAMP NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS oidc_org_mappings (
				id TEXT PRIMARY KEY,
				oidc_group TEXT NOT NULL UNIQUE,
				org_id TEXT NOT NULL,
				created_at TIMESTAMP NOT NULL
			)`,
			`CREATE INDEX IF NOT EXISTS idx_oidc_org_mappings_group ON oidc_org_mappings (oidc_group)`,
			`CREATE TABLE IF NOT EXISTS upstream_health (
				tenant_id TEXT PRIMARY KEY,
				status TEXT NOT NULL DEFAULT 'unknown',
				last_checked_at TIMESTAMP NOT NULL,
				latency_ms INTEGER NOT NULL DEFAULT 0,
				error TEXT NOT NULL DEFAULT ''
			)`,
			`ALTER TABLE tenants ADD COLUMN health_check_path TEXT NOT NULL DEFAULT ''`,
		},
	},
	{
		version: 6,
		name:    "create_platform_admins",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS platform_admins (
				user_id TEXT PRIMARY KEY,
				granted_by TEXT NOT NULL,
				granted_at TIMESTAMP NOT NULL
			)`,
		},
	},
	{
		version: 7,
		name:    "add_gateway_features",
		statements: []string{
			// Rate limiting per route
			`ALTER TABLE routes ADD COLUMN rate_limit_rpm INTEGER NOT NULL DEFAULT 0`,
			`ALTER TABLE routes ADD COLUMN rate_limit_burst INTEGER NOT NULL DEFAULT 0`,
			// IP allowlist/denylist per route
			`ALTER TABLE routes ADD COLUMN allow_cidrs TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE routes ADD COLUMN deny_cidrs TEXT NOT NULL DEFAULT ''`,
			// Rate limiting per token
			`ALTER TABLE tokens ADD COLUMN rate_limit_rpm INTEGER NOT NULL DEFAULT 0`,
			`ALTER TABLE tokens ADD COLUMN rate_limit_burst INTEGER NOT NULL DEFAULT 0`,
			// Latency tracking in audits
			`ALTER TABLE audits ADD COLUMN latency_ms INTEGER NOT NULL DEFAULT 0`,
			// Load balancing: multiple upstreams per tenant
			`CREATE TABLE IF NOT EXISTS tenant_upstreams (
				id TEXT PRIMARY KEY,
				tenant_id TEXT NOT NULL,
				upstream_url TEXT NOT NULL,
				weight INTEGER NOT NULL DEFAULT 1,
				is_primary BOOLEAN NOT NULL DEFAULT FALSE,
				created_at TIMESTAMP NOT NULL
			)`,
			`CREATE INDEX IF NOT EXISTS idx_tenant_upstreams_tenant ON tenant_upstreams (tenant_id)`,
			// Circuit breaker state per route
			`CREATE TABLE IF NOT EXISTS circuit_breakers (
				route_id TEXT PRIMARY KEY,
				state TEXT NOT NULL DEFAULT 'closed',
				failure_count INTEGER NOT NULL DEFAULT 0,
				last_failure_at TIMESTAMP,
				last_success_at TIMESTAMP,
				opened_at TIMESTAMP,
				half_open_at TIMESTAMP
			)`,
			// Upstream health history
			`CREATE TABLE IF NOT EXISTS upstream_health_history (
				id TEXT PRIMARY KEY,
				tenant_id TEXT NOT NULL,
				status TEXT NOT NULL,
				latency_ms INTEGER NOT NULL DEFAULT 0,
				error TEXT NOT NULL DEFAULT '',
				checked_at TIMESTAMP NOT NULL
			)`,
			`CREATE INDEX IF NOT EXISTS idx_health_history_tenant_time ON upstream_health_history (tenant_id, checked_at DESC)`,
			// Admin activity audit log
			`CREATE TABLE IF NOT EXISTS admin_audits (
				id TEXT PRIMARY KEY,
				timestamp TIMESTAMP NOT NULL,
				user_id TEXT NOT NULL,
				user_email TEXT NOT NULL DEFAULT '',
				action TEXT NOT NULL,
				resource_type TEXT NOT NULL,
				resource_id TEXT NOT NULL DEFAULT '',
				details TEXT NOT NULL DEFAULT '',
				org_id TEXT NOT NULL DEFAULT ''
			)`,
			`CREATE INDEX IF NOT EXISTS idx_admin_audits_timestamp ON admin_audits (timestamp DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_admin_audits_org ON admin_audits (org_id)`,
			// Traffic analytics aggregation
			`CREATE TABLE IF NOT EXISTS traffic_stats (
				id TEXT PRIMARY KEY,
				bucket_start TIMESTAMP NOT NULL,
				bucket_minutes INTEGER NOT NULL DEFAULT 60,
				route_slug TEXT NOT NULL DEFAULT '',
				tenant_id TEXT NOT NULL DEFAULT '',
				token_id TEXT NOT NULL DEFAULT '',
				org_id TEXT NOT NULL DEFAULT '',
				request_count INTEGER NOT NULL DEFAULT 0,
				error_count INTEGER NOT NULL DEFAULT 0,
				avg_latency_ms INTEGER NOT NULL DEFAULT 0,
				status_2xx INTEGER NOT NULL DEFAULT 0,
				status_4xx INTEGER NOT NULL DEFAULT 0,
				status_5xx INTEGER NOT NULL DEFAULT 0
			)`,
			`CREATE INDEX IF NOT EXISTS idx_traffic_stats_bucket ON traffic_stats (bucket_start DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_traffic_stats_org ON traffic_stats (org_id, bucket_start DESC)`,
			// Session management
			`CREATE TABLE IF NOT EXISTS admin_sessions (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				ip_address TEXT NOT NULL DEFAULT '',
				user_agent TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMP NOT NULL,
				last_seen_at TIMESTAMP NOT NULL,
				revoked BOOLEAN NOT NULL DEFAULT FALSE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions (user_id)`,
			// Multi-region / replica status
			`CREATE TABLE IF NOT EXISTS instance_heartbeats (
				instance_id TEXT PRIMARY KEY,
				region TEXT NOT NULL DEFAULT '',
				hostname TEXT NOT NULL DEFAULT '',
				version TEXT NOT NULL DEFAULT '',
				started_at TIMESTAMP NOT NULL,
				last_heartbeat_at TIMESTAMP NOT NULL,
				metadata TEXT NOT NULL DEFAULT '{}'
			)`,
		},
	},
	{
		version: 8,
		name:    "traffic_stats_upsert_index",
		statements: []string{
			// Clear duplicate rows accumulated before this index existed (inserts were non-deduplicating)
			`DELETE FROM traffic_stats`,
			// Required for ON CONFLICT(bucket_start, route_slug, tenant_id, token_id) to work
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_stats_upsert ON traffic_stats (bucket_start, route_slug, tenant_id, token_id)`,
		},
	},
	{
		version: 9,
		name:    "upstream_health_per_url",
		statements: []string{
			// Drop the old single-row-per-tenant health table so we can replace it with one
			// that tracks health per individual upstream URL (composite PK).
			`DROP TABLE IF EXISTS upstream_health`,
			`CREATE TABLE upstream_health (
				tenant_id   TEXT NOT NULL,
				upstream_url TEXT NOT NULL DEFAULT '',
				status       TEXT NOT NULL DEFAULT 'unknown',
				last_checked_at TIMESTAMP NOT NULL,
				latency_ms   INTEGER NOT NULL DEFAULT 0,
				error        TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (tenant_id, upstream_url)
			)`,
		},
	},
	{
		version: 10,
		name:    "audit_request_path",
		statements: []string{
			// Store the incoming proxy request URI (path + query) so operators can
			// see exactly which path the client hit on the proxy side.
			`ALTER TABLE audits ADD COLUMN request_path TEXT NOT NULL DEFAULT ''`,
		},
	},
	{
		version: 11,
		name:    "create_protected_apps",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS protected_apps (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				slug TEXT NOT NULL UNIQUE,
				upstream_url TEXT NOT NULL,
				org_id TEXT NOT NULL DEFAULT '',
				auth_mode TEXT NOT NULL DEFAULT 'oidc',
				inject_headers_json TEXT NOT NULL DEFAULT '[]',
				strip_headers_json TEXT NOT NULL DEFAULT '[]',
				extra_ca_pem TEXT NOT NULL DEFAULT '',
				rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
				rate_limit_burst INTEGER NOT NULL DEFAULT 0,
				rate_limit_per TEXT NOT NULL DEFAULT 'session',
				allow_cidrs TEXT NOT NULL DEFAULT '',
				deny_cidrs TEXT NOT NULL DEFAULT '',
				health_check_path TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMP NOT NULL,
				created_by TEXT NOT NULL DEFAULT ''
			)`,
			`CREATE INDEX IF NOT EXISTS idx_protected_apps_org ON protected_apps (org_id)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_protected_apps_slug ON protected_apps (slug)`,
			`CREATE TABLE IF NOT EXISTS app_sessions (
				id TEXT PRIMARY KEY,
				app_id TEXT NOT NULL,
				user_sub TEXT NOT NULL DEFAULT '',
				user_email TEXT NOT NULL DEFAULT '',
				user_name TEXT NOT NULL DEFAULT '',
				user_groups_json TEXT NOT NULL DEFAULT '[]',
				token_hash TEXT NOT NULL UNIQUE,
				ip TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMP NOT NULL,
				expires_at TIMESTAMP NOT NULL,
				last_used_at TIMESTAMP NOT NULL,
				revoked BOOLEAN NOT NULL DEFAULT FALSE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_app_sessions_app ON app_sessions (app_id)`,
			`CREATE INDEX IF NOT EXISTS idx_app_sessions_hash ON app_sessions (token_hash)`,
			`CREATE TABLE IF NOT EXISTS app_tokens (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				app_id TEXT NOT NULL,
				token_hash TEXT NOT NULL UNIQUE,
				preview TEXT NOT NULL DEFAULT '',
				active BOOLEAN NOT NULL DEFAULT TRUE,
				rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
				rate_limit_burst INTEGER NOT NULL DEFAULT 0,
				expires_at TIMESTAMP NOT NULL,
				last_used_at TIMESTAMP NOT NULL,
				created_at TIMESTAMP NOT NULL
			)`,
			`CREATE INDEX IF NOT EXISTS idx_app_tokens_app ON app_tokens (app_id)`,
			`CREATE INDEX IF NOT EXISTS idx_app_tokens_hash ON app_tokens (token_hash)`,
		},
	},
}

func (store *sqlStore) runMigrations(ctx context.Context) error {
	if _, err := store.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at TIMESTAMP NOT NULL
	)`); err != nil {
		return err
	}

	rows, err := store.db.QueryContext(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return err
	}
	defer rows.Close()

	applied := make(map[int]struct{})
	for rows.Next() {
		var version int
		if err := rows.Scan(&version); err != nil {
			return err
		}
		applied[version] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, migration := range schemaMigrations {
		if _, exists := applied[migration.version]; exists {
			continue
		}

		transaction, err := store.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}

		for _, statement := range migration.statements {
			if _, err := transaction.ExecContext(ctx, store.rebind(statement)); err != nil {
				_ = transaction.Rollback()
				return fmt.Errorf("apply migration %d (%s): %w", migration.version, migration.name, err)
			}
		}

		if _, err := transaction.ExecContext(
			ctx,
			store.rebind(`INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`),
			migration.version,
			migration.name,
			time.Now().UTC(),
		); err != nil {
			_ = transaction.Rollback()
			return err
		}

		if err := transaction.Commit(); err != nil {
			return err
		}
	}

	return nil
}
