package main

import (
	"log/slog"
	"net/http"
	"os"

	"justgate/backend/internal/service"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "9090"
	}

	adminJWTSecret := os.Getenv("JUST_GATE_BACKEND_JWT_SECRET")
	tenantHeaderName := os.Getenv("JUST_GATE_TENANT_HEADER")
	databaseURL := os.Getenv("JUST_GATE_DATABASE_URL")

	svc, err := service.New(service.Config{
		Version:                   "1.1.4",
		AdminJWTSecret:            adminJWTSecret,
		DatabaseURL:               databaseURL,
		TenantHeaderName:          tenantHeaderName,
		OIDCIssuer:                os.Getenv("JUST_GATE_OIDC_ISSUER"),
		OIDCClientID:              os.Getenv("JUST_GATE_OIDC_CLIENT_ID"),
		OIDCClientSecret:          os.Getenv("JUST_GATE_OIDC_CLIENT_SECRET"),
		OIDCDisplayName:           os.Getenv("JUST_GATE_OIDC_NAME"),
		ExtraCAFile:               os.Getenv("JUST_GATE_EXTRA_CA_FILE"),
		InitialPlatformAdminEmail: os.Getenv("JUSTGATE_INITIAL_ADMIN_EMAIL"),
		RedisURL:                  os.Getenv("JUST_GATE_REDIS_URL"),
		InstanceID:                os.Getenv("JUST_GATE_INSTANCE_ID"),
		Region:                    os.Getenv("JUST_GATE_REGION"),
	})
	if err != nil {
		slog.Error("failed to initialize backend service", "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: svc.Handler(),
	}

	slog.Info("justgate backend listening", "addr", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("backend server stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}
