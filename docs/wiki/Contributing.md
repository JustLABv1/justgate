# Contributing

Contributions are welcome! This page explains how to set up the development environment, run tests, and submit changes.

---

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/justgate.git
   cd justgate
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```

---

## Development Setup

Follow the [Quick Start — Local Development](Quick-Start#local-development) guide to run the backend and frontend simultaneously.

### Backend (Go)

```bash
cd services/backend

# Run the server (SQLite, dev secrets)
JUST_GATE_BACKEND_JWT_SECRET=dev-secret go run ./cmd/server

# Run all tests
go test ./...

# Run integration tests only
go test ./internal/service/... -run Integration -v
```

### Frontend (Next.js)

```bash
cd services/frontend
pnpm install
pnpm dev       # dev server with hot reload
pnpm build     # production build
pnpm lint      # ESLint check
```

---

## Project Structure

```
services/
├── backend/
│   ├── cmd/server/           Binary entry point
│   └── internal/service/     HTTP handlers, store, migrations, auth
└── frontend/
    ├── app/                  Next.js App Router pages and API routes
    ├── components/           UI components (HeroUI v3 / Tailwind v4)
    └── lib/                  Auth helpers, backend client, type contracts
```

---

## Guidelines

### Keeping PRs focused

- One logical change per pull request.
- Large refactors or new features should be discussed in an issue first.
- Bug fixes should not include unrelated clean-up.

### Tests

- Add or update tests for any changed behaviour.
- Backend: Go table-driven tests in `_test.go` files alongside the code.
- Frontend: component and utility tests where applicable.
- Integration tests live in `services/backend/internal/service/service_integration_test.go`.

### Database migrations

- All schema changes must be expressed as versioned migrations in `internal/service/migrations.go`.
- Migrations must be forwards-only and non-destructive where possible.
- Test that the migration runs cleanly against both SQLite and PostgreSQL.

### Frontend conventions

- Use HeroUI v3 components; avoid raw HTML elements for UI.
- Follow the existing patterns in `components/admin/` for new admin pages.
- API calls to the backend go through the typed client in `lib/backend-client.ts` and `lib/backend-server.ts`.
- Type contracts for API request/response shapes live in `lib/contracts.ts`.

---

## Opening a Pull Request

1. Push your branch and open a PR against `main`.
2. Describe **what** the change does and **why** (link to an issue if applicable).
3. The PR checks run automatically (lint, build, tests). Fix any failures before requesting review.
4. A maintainer will review and merge once the checks pass and the change is approved.

---

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce (minimal, if possible)
- JustGate version or commit SHA

---

## License

By contributing, you agree that your contributions will be licensed under the [Business Source License 1.1](../LICENSE), which governs the project.
