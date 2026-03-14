"use client";

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const APPS = [
  {
    name: "Grafana",
    config: `[server]
root_url = %(protocol)s://%(domain)s/app/<slug>/
serve_from_sub_path = true`,
    note: "Set in grafana.ini or via the GF_SERVER_ROOT_URL and GF_SERVER_SERVE_FROM_SUB_PATH env vars.",
  },
  {
    name: "Prometheus",
    config: `# Pass --web.external-url when starting Prometheus:
--web.external-url=https://<your-domain>/app/<slug>/
--web.route-prefix=/`,
    note: "Prometheus uses --web.external-url to prefix all asset and redirect URLs.",
  },
  {
    name: "Alertmanager",
    config: `--web.external-url=https://<your-domain>/app/<slug>/
--web.route-prefix=/`,
    note: "Same pattern as Prometheus.",
  },
  {
    name: "Uptime Kuma",
    config: `# Set the BASE_URL environment variable:
BASE_URL=/app/<slug>`,
    note: "Supported from v1.21+. Restart the container after changing.",
  },
  {
    name: "Gitea",
    config: `[server]
ROOT_URL = https://<your-domain>/app/<slug>/`,
    note: "Set in app.ini under [server]. Gitea rebuilds asset paths at startup.",
  },
  {
    name: "Jupyter",
    config: `# Launch with a base URL:
jupyter lab --NotebookApp.base_url=/app/<slug>/`,
    note: "Or set c.NotebookApp.base_url in jupyter_notebook_config.py.",
  },
  {
    name: "Netdata",
    config: `# In netdata.conf:
[web]
  web server bind to = 127.0.0.1
  # Netdata reads X-Forwarded-Prefix automatically — no extra config needed.`,
    note: "Netdata honours X-Forwarded-Prefix out of the box (v1.37+).",
  },
  {
    name: "Generic (falls back to X-Forwarded-Prefix)",
    config: `# JustGate sends this header on every proxied request:
X-Forwarded-Prefix: /app/<slug>
X-Forwarded-Host:   <your-domain>
X-Forwarded-Proto:  https

# Many frameworks read X-Forwarded-Prefix automatically:
#  - Traefik (as a downstream), Spring Boot, Express (trust proxy), etc.`,
    note: "If the app supports X-Forwarded-Prefix you may not need any extra configuration.",
  },
];

export function UpstreamConfigGuide() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-panel/60"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <BookOpen size={11} />
          Upstream subpath configuration guide
        </div>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground/60" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground/60" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          {/* Explanation */}
          <div className="enterprise-panel p-4 space-y-2">
            <div className="enterprise-kicker">Why upstream apps need subpath configuration</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every protected app is served under <code className="font-mono text-[11px] bg-surface px-1 rounded">/app/{"<slug>"}/</code>.
              {" "}When an upstream app generates URLs or redirects (e.g. for assets, login pages, or API calls),
              it typically outputs paths relative to its own root — for example <code className="font-mono text-[11px] bg-surface px-1 rounded">/login</code> or <code className="font-mono text-[11px] bg-surface px-1 rounded">/public/app.js</code>.
              The browser resolves these against the proxy origin, producing <code className="font-mono text-[11px] bg-surface px-1 rounded">{"<domain>"}/login</code> instead of{" "}
              <code className="font-mono text-[11px] bg-surface px-1 rounded">{"<domain>"}/app/{"<slug>"}/login</code>, breaking navigation and asset loading.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              JustGate automatically rewrites <strong>redirect responses</strong> (3xx) from the upstream to preserve
              the <code className="font-mono text-[11px] bg-surface px-1 rounded">/app/{"<slug>"}/</code> prefix.
              However, <strong>HTML and JavaScript</strong> that embed absolute or root-relative URLs (like most SPA frameworks do for their asset bundles) must be configured at the upstream itself.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              JustGate passes these headers on every proxied request so upstreams can self-configure:
            </p>
            <div className="rounded-md bg-background/60 px-4 py-3 text-[12px] font-mono text-muted-foreground space-y-0.5">
              <div><span className="text-foreground/70">X-Forwarded-Prefix:</span> /app/{"<slug>"}</div>
              <div><span className="text-foreground/70">X-Forwarded-Host:</span> {"<your-domain>"}</div>
              <div><span className="text-foreground/70">X-Forwarded-Proto:</span> https</div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Apps that honour <code className="font-mono text-[11px] bg-surface px-1 rounded">X-Forwarded-Prefix</code> automatically (like Netdata v1.37+) work with zero configuration.
              Others require a one-time setting in their config file or environment. Select your app below.
            </p>
          </div>

          {/* Per-app config */}
          <div className="space-y-2">
            {APPS.map((app, i) => (
              <div key={app.name} className="rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium hover:bg-surface/60 transition-colors"
                  onClick={() => setActive(active === i ? null : i)}
                >
                  {app.name}
                  {active === i ? (
                    <ChevronUp size={13} className="text-muted-foreground/60 shrink-0" />
                  ) : (
                    <ChevronDown size={13} className="text-muted-foreground/60 shrink-0" />
                  )}
                </button>
                {active === i && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                    <pre className="rounded-md bg-background/60 px-4 py-3 text-[12px] font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto">{app.config}</pre>
                    <div className="enterprise-note">{app.note}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
