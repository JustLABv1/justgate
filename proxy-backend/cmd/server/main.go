package main

import (
	"log"
	"net/http"
	"os"

	"just-proxy-guard/proxy-backend/internal/service"
)

func main() {
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
		log.Fatal(err)
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: svc.Handler(),
	}

	log.Printf("just-proxy-guard backend listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
