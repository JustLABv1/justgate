package main

import (
	"log/slog"
	"net/http"
	"os"

	"just-gate/backend/internal/service"
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
		Version:          "1.0.5",
		AdminJWTSecret:   adminJWTSecret,
		DatabaseURL:      databaseURL,
		TenantHeaderName: tenantHeaderName,
	})
	if err != nil {
		slog.Error("failed to initialize backend service", "error", err)
		os.Exit(1)
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: svc.Handler(),
	}

	slog.Info("just-gate backend listening", "addr", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("backend server stopped unexpectedly", "error", err)
		os.Exit(1)
	}
}
