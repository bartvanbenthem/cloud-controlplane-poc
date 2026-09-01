// Command portal-backend serves the cloud-controlplane portal: a REST API
// over the compute.sostackit.dev Server/Cluster CRDs (backed by a
// dynamic Kubernetes client) plus the built React frontend, as one static
// binary/container.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bartvanbenthem/cloud-controlplane-poc/backend/internal/api"
	"github.com/bartvanbenthem/cloud-controlplane-poc/backend/internal/k8s"
	"github.com/bartvanbenthem/cloud-controlplane-poc/backend/internal/web"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	if err := run(log); err != nil {
		log.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	port := envOr("PORT", "8080")
	authUser := os.Getenv("AUTH_USERNAME")
	authPass := os.Getenv("AUTH_PASSWORD")
	if authUser == "" || authPass == "" {
		log.Warn("AUTH_USERNAME/AUTH_PASSWORD not both set — API is unauthenticated")
	}

	clients, err := k8s.New()
	if err != nil {
		return err
	}

	apiServer := api.NewServer(clients, log)

	mux := http.NewServeMux()
	apiServer.Register(mux)
	mux.Handle("/", web.Handler())

	handler := api.RequestLogging(log, api.BasicAuth(authUser, authPass, mux))

	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return httpServer.Shutdown(shutdownCtx)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
