package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type migration struct {
	version    int
	name       string
	statements []string
	// fn is an optional programmatic step that runs inside the migration transaction.
	// Use it when SQL alone cannot express the logic (e.g. conditional DDL).
	// dialect is "sqlite" or "postgres".
	fn func(ctx context.Context, tx *sql.Tx, dialect string) error
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
	{
		version: 12,
		name:    "create_provisioning_grants",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS provisioning_grants (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				tenant_id TEXT NOT NULL,
				scopes_json TEXT NOT NULL DEFAULT '[]',
				token_ttl_hours INTEGER NOT NULL DEFAULT 720,
				max_uses INTEGER NOT NULL DEFAULT 10,
				use_count INTEGER NOT NULL DEFAULT 0,
				active BOOLEAN NOT NULL DEFAULT TRUE,
				grant_hash TEXT NOT NULL UNIQUE,
				preview TEXT NOT NULL DEFAULT '',
				rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
				rate_limit_burst INTEGER NOT NULL DEFAULT 0,
				org_id TEXT NOT NULL DEFAULT '',
				expires_at TIMESTAMP NOT NULL,
				created_at TIMESTAMP NOT NULL,
				created_by TEXT NOT NULL DEFAULT ''
			)`,
			`CREATE INDEX IF NOT EXISTS idx_grants_org ON provisioning_grants (org_id)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_hash ON provisioning_grants (grant_hash)`,
		},
	},
	{
		version: 13,
		name:    "create_org_ip_rules",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS org_ip_rules (
				id TEXT PRIMARY KEY,
				org_id TEXT NOT NULL,
				cidr TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMP NOT NULL,
				created_by TEXT NOT NULL DEFAULT ''
			)`,
			`CREATE INDEX IF NOT EXISTS idx_org_ip_rules_org ON org_ip_rules (org_id)`,
		},
	},
	{
		version: 14,
		name:    "create_grant_issuances",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS grant_issuances (
				id TEXT PRIMARY KEY,
				grant_id TEXT NOT NULL,
				token_id TEXT NOT NULL,
				agent_name TEXT NOT NULL DEFAULT '',
				issued_at TIMESTAMP NOT NULL
			)`,
			`CREATE INDEX IF NOT EXISTS idx_grant_issuances_grant ON grant_issuances (grant_id)`,
			`CREATE INDEX IF NOT EXISTS idx_grant_issuances_issued ON grant_issuances (issued_at DESC)`,
		},
	},
	{
		version: 15,
		name:    "add_circuit_breaker_locked",
		statements: []string{
			`ALTER TABLE circuit_breakers ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE`,
		},
	},
	{
		version: 16,
		name:    "create_system_settings",
		statements: []string{
			`CREATE TABLE IF NOT EXISTS system_settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TIMESTAMP NOT NULL
			)`,
		},
	},
	{
		version: 17,
		name:    "ensure_circuit_breaker_locked_column",
		// Migration 15 added this column but may have been recorded as applied on a
		// different DB file. This migration repairs any DB where the column is missing.
		fn: func(ctx context.Context, tx *sql.Tx, dialect string) error {
			if dialect == "postgres" {
				// Postgres supports ADD COLUMN IF NOT EXISTS directly.
				_, err := tx.ExecContext(ctx, `ALTER TABLE circuit_breakers ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE`)
				return err
			}
			// SQLite: check via PRAGMA before attempting ALTER TABLE.
			rows, err := tx.QueryContext(ctx, `PRAGMA table_info(circuit_breakers)`)
			if err != nil {
				return err
			}
			defer rows.Close()
			for rows.Next() {
				var cid int
				var name, colType string
				var notNull int
				var dflt sql.NullString
				var pk int
				if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
					return err
				}
				if name == "locked" {
					return nil // column already present — nothing to do
				}
			}
			if err := rows.Err(); err != nil {
				return err
			}
			_, err = tx.ExecContext(ctx, `ALTER TABLE circuit_breakers ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE`)
			return err
		},
	},
	{
		version: 18,
		name:    "route_level_upstreams",
		// Upstream URL moves from tenants to routes: tenants become auth-only config,
		// routes own the upstream they proxy to. Per-route load-balancing replaces the
		// old per-tenant tenant_upstreams pool. Health-check path also moves to routes.
		fn: func(ctx context.Context, tx *sql.Tx, dialect string) error {
			if dialect == "postgres" {
				// Move health_check_path to routes before dropping it from tenants.
				if _, err := tx.ExecContext(ctx, `ALTER TABLE routes ADD COLUMN IF NOT EXISTS health_check_path TEXT NOT NULL DEFAULT ''`); err != nil {
					return err
				}
				if _, err := tx.ExecContext(ctx, `UPDATE routes SET health_check_path = (SELECT health_check_path FROM tenants WHERE tenants.tenant_id = routes.tenant_id LIMIT 1)`); err != nil {
					return err
				}
				// Remove upstream from tenants.
				if _, err := tx.ExecContext(ctx, `ALTER TABLE tenants DROP COLUMN IF EXISTS upstream_url`); err != nil {
					return err
				}
				if _, err := tx.ExecContext(ctx, `ALTER TABLE tenants DROP COLUMN IF EXISTS health_check_path`); err != nil {
					return err
				}
				// Add route_upstreams (per-route load-balancing pool, replaces tenant_upstreams).
				if _, err := tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS route_upstreams (
					id TEXT PRIMARY KEY,
					route_id TEXT NOT NULL,
					upstream_url TEXT NOT NULL,
					weight INTEGER NOT NULL DEFAULT 1,
					is_primary BOOLEAN NOT NULL DEFAULT FALSE,
					created_at TIMESTAMP NOT NULL
				)`); err != nil {
					return err
				}
				if _, err := tx.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_route_upstreams_route ON route_upstreams (route_id)`); err != nil {
					return err
				}
				// Migrate existing tenant_upstreams → route_upstreams (one entry per matching route).
				if _, err := tx.ExecContext(ctx, `INSERT INTO route_upstreams (id, route_id, upstream_url, weight, is_primary, created_at)
					SELECT tu.id || '-' || r.id, r.id, tu.upstream_url, tu.weight, tu.is_primary, tu.created_at
					FROM tenant_upstreams tu
					JOIN routes r ON r.tenant_id = tu.tenant_id`); err != nil {
					return err
				}
				// Change upstream_health primary key from tenant_id to route_id.
				if _, err := tx.ExecContext(ctx, `ALTER TABLE upstream_health RENAME COLUMN tenant_id TO route_id`); err != nil {
					return err
				}
				// Update upstream_health rows to use route.id instead of tenant_id string.
				if _, err := tx.ExecContext(ctx, `UPDATE upstream_health SET route_id = COALESCE((SELECT r.id FROM routes r WHERE r.tenant_id = upstream_health.route_id LIMIT 1), upstream_health.route_id)`); err != nil {
					return err
				}
				_, err := tx.ExecContext(ctx, `DROP TABLE IF EXISTS tenant_upstreams`)
				return err
			}

			// SQLite: remove upstream_url and health_check_path from tenants (requires table recreate),
			// add health_check_path to routes, add route_upstreams, migrate data, drop tenant_upstreams.
			stmts := []string{
				// Add health_check_path to routes, backfill from tenants.
				`ALTER TABLE routes ADD COLUMN health_check_path TEXT NOT NULL DEFAULT ''`,
				`UPDATE routes SET health_check_path = COALESCE((SELECT health_check_path FROM tenants WHERE tenants.tenant_id = routes.tenant_id LIMIT 1), '')`,
				// Recreate tenants without upstream_url and health_check_path.
				`CREATE TABLE IF NOT EXISTS tenants_new (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					tenant_id TEXT NOT NULL UNIQUE,
					auth_mode TEXT NOT NULL,
					header_name TEXT NOT NULL,
					created_at TIMESTAMP NOT NULL,
					org_id TEXT NOT NULL DEFAULT ''
				)`,
				`INSERT INTO tenants_new SELECT id, name, tenant_id, auth_mode, header_name, created_at, org_id FROM tenants`,
				`DROP TABLE tenants`,
				`ALTER TABLE tenants_new RENAME TO tenants`,
				`CREATE INDEX IF NOT EXISTS idx_tenants_org ON tenants (org_id)`,
				// Add route_upstreams table.
				`CREATE TABLE IF NOT EXISTS route_upstreams (
					id TEXT PRIMARY KEY,
					route_id TEXT NOT NULL,
					upstream_url TEXT NOT NULL,
					weight INTEGER NOT NULL DEFAULT 1,
					is_primary BOOLEAN NOT NULL DEFAULT FALSE,
					created_at TIMESTAMP NOT NULL
				)`,
				`CREATE INDEX IF NOT EXISTS idx_route_upstreams_route ON route_upstreams (route_id)`,
				// Migrate tenant_upstreams → route_upstreams.
				`INSERT INTO route_upstreams (id, route_id, upstream_url, weight, is_primary, created_at)
					SELECT tu.id || '-' || r.id, r.id, tu.upstream_url, tu.weight, tu.is_primary, tu.created_at
					FROM tenant_upstreams tu
					JOIN routes r ON r.tenant_id = tu.tenant_id`,
				// Recreate upstream_health with route_id instead of tenant_id.
				`CREATE TABLE upstream_health_new (
					route_id TEXT NOT NULL,
					upstream_url TEXT NOT NULL DEFAULT '',
					status TEXT NOT NULL DEFAULT 'unknown',
					last_checked_at TIMESTAMP NOT NULL,
					latency_ms INTEGER NOT NULL DEFAULT 0,
					error TEXT NOT NULL DEFAULT '',
					PRIMARY KEY (route_id, upstream_url)
				)`,
				`INSERT INTO upstream_health_new (route_id, upstream_url, status, last_checked_at, latency_ms, error)
					SELECT COALESCE((SELECT r.id FROM routes r WHERE r.tenant_id = uh.tenant_id LIMIT 1), uh.tenant_id),
					       uh.upstream_url, uh.status, uh.last_checked_at, uh.latency_ms, uh.error
					FROM upstream_health uh`,
				`DROP TABLE upstream_health`,
				`ALTER TABLE upstream_health_new RENAME TO upstream_health`,
				`DROP TABLE IF EXISTS tenant_upstreams`,
			}
			for _, stmt := range stmts {
				if _, err := tx.ExecContext(ctx, stmt); err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		version: 19,
		name:    "fix_health_history_route_id",
		// upstream_health_history was created with tenant_id; the code expects route_id.
		// Recreate the table with the correct schema and re-map tenant_id → route_id.
		statements: []string{
			`CREATE TABLE IF NOT EXISTS upstream_health_history_new (
				id TEXT PRIMARY KEY,
				route_id TEXT NOT NULL,
				status TEXT NOT NULL,
				latency_ms INTEGER NOT NULL DEFAULT 0,
				error TEXT NOT NULL DEFAULT '',
				checked_at TIMESTAMP NOT NULL
			)`,
			`INSERT INTO upstream_health_history_new (id, route_id, status, latency_ms, error, checked_at)
				SELECT h.id,
				       COALESCE((SELECT r.id FROM routes r WHERE r.tenant_id = h.tenant_id LIMIT 1), h.tenant_id),
				       h.status, h.latency_ms, h.error, h.checked_at
				FROM upstream_health_history h`,
			`DROP TABLE upstream_health_history`,
			`ALTER TABLE upstream_health_history_new RENAME TO upstream_health_history`,
			`CREATE INDEX IF NOT EXISTS idx_health_history_route_time ON upstream_health_history (route_id, checked_at DESC)`,
		},
	},
	{
		version: 20,
		name:    "oidc_config_admin_group",
		statements: []string{
			`ALTER TABLE oidc_config ADD COLUMN admin_group TEXT NOT NULL DEFAULT ''`,
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

		if migration.fn != nil {
			if err := migration.fn(ctx, transaction, store.dialect); err != nil {
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
