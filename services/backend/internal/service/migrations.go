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
