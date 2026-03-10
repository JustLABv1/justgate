package main

import (
	"log/slog"
	"net/http"
	"os"

	"just-proxy-guard/proxy-backend/internal/service"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	adminJWTSecret := os.Getenv("JUST_PROXY_GUARD_BACKEND_JWT_SECRET")
	mimirHeaderName := os.Getenv("MIMIR_TENANT_HEADER")
	if mimirHeaderName == "" {
		mimirHeaderName = "X-Scope-OrgID"
	}
	databaseURL := os.Getenv("JUST_PROXY_GUARD_DATABASE_URL")

	svc, err := service.New(service.Config{
		Version:         "0.1.0-dev",
		AdminJWTSecret:  adminJWTSecret,
		DatabaseURL:     databaseURL,
		MimirHeaderName: mimirHeaderName,
	})
	if err != nil {
		slog.Error("failed to initialize backend service", "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: svc.Handler(),
	}

	slog.Info("just-proxy-guard backend listening", "addr", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("backend server stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}
