# JustGate Wiki

Welcome to the JustGate documentation wiki. Use the sidebar or the links below to navigate.

---

## Getting Started

- [Quick Start](Quick-Start) — Run JustGate locally, via Docker, or Docker Compose; the setup wizard walks you through creating the first admin account and configuring OIDC on first run
- [Configuration](Configuration) — Full reference for all backend and frontend environment variables
- [Deployment](Deployment) — Kubernetes / Helm guide, deployment modes, and values reference

## Core Concepts

- [Route & Token Configuration](Route-and-Token-Configuration) — Rate limiting, IP allow/deny, auth modes
- [Observability](Observability) — Traffic analytics dashboard, live topology map, route tester, upstream health
- [Protected Apps](Protected-Apps) — Browser-auth proxy: auth modes, subpath configuration, per-app examples

## Administration

- [Platform Admin](Platform-Admin) — Superadmin bootstrap, cross-org management, and capabilities
- [OIDC / Single Sign-On](OIDC-Single-Sign-On) — SSO setup, issuer formats, troubleshooting, Keycloak guide, org mappings

## Reference

- [API Reference](API-Reference) — Full list of backend REST endpoints
- [Contributing](Contributing) — How to contribute code, run tests, and open pull requests

---

## Overview

JustGate sits in front of any HTTP upstream and enforces multi-tenant access control via scoped bearer tokens. An organisation admin manages tenants, routes, and tokens through a web UI; remote clients authenticate with those tokens and JustGate proxies their requests to the correct upstream — injecting configured tenant identity headers, enforcing rate limits, filtering by IP, and tripping circuit breakers when the upstream is unhealthy.

Each **route** defines its own upstream URL, target path, and required token scope. **Tenants** group related routes and provide a shared identity header; they do not own an upstream URL.

```
Client (bearer token)
    │
    ▼
┌────────────────────────────────────────────────┐
│  JustGate  (/proxy/{slug}/…)                   │
│                                                │
│  1. IP allow/deny check                        │
│  2. Token validation (scope, expiry, active)   │
│  3. Rate limiting (per-route or per-token)     │
│  4. Circuit breaker                            │
│  5. Proxy  →  inject tenant identity header    │
│  6. Record audit + traffic stat                │
└────────────────────────────────────────────────┘
             │  X-Scope-OrgID: <tenant-id>
             ▼
     Upstream service
```
