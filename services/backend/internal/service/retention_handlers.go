package service

import (
	"context"
	"net/http"
	"strconv"
	"time"
)

const (
	settingRetentionDays    = "traffic_stats_retention_days"
	settingRetentionEnabled = "traffic_stats_auto_purge"
	defaultRetentionDays    = 30
)

type retentionSettingsResponse struct {
	RetentionDays int  `json:"retentionDays"`
	AutoEnabled   bool `json:"autoEnabled"`
}

type updateRetentionRequest struct {
	RetentionDays *int  `json:"retentionDays"`
	AutoEnabled   *bool `json:"autoEnabled"`
}

type purgeRequest struct {
	OlderThanDays int `json:"olderThanDays"`
}

type purgeResponse struct {
	Purged int64 `json:"purged"`
}

func (s *Service) handleRetentionSettings(writer http.ResponseWriter, request *http.Request) {
	// Sub-route: POST /api/v1/admin/settings/retention/purge
	if request.URL.Path == "/api/v1/admin/settings/retention/purge" {
		if request.Method != http.MethodPost {
			writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		var payload purgeRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		days := payload.OlderThanDays
		if days <= 0 {
			days = defaultRetentionDays
		}
		olderThan := time.Now().UTC().Add(-time.Duration(days) * 24 * time.Hour)
		n, err := s.store.PurgeTrafficStats(request.Context(), olderThan)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "purge failed"})
			return
		}
		writeJSON(writer, http.StatusOK, purgeResponse{Purged: n})
		return
	}

	switch request.Method {
	case http.MethodGet:
		resp := s.loadRetentionSettings(request)
		writeJSON(writer, http.StatusOK, resp)
	case http.MethodPatch:
		var payload updateRetentionRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		ctx := request.Context()
		if payload.RetentionDays != nil {
			if err := s.store.SetSystemSetting(ctx, settingRetentionDays, strconv.Itoa(*payload.RetentionDays)); err != nil {
				writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to save setting"})
				return
			}
		}
		if payload.AutoEnabled != nil {
			val := "false"
			if *payload.AutoEnabled {
				val = "true"
			}
			if err := s.store.SetSystemSetting(ctx, settingRetentionEnabled, val); err != nil {
				writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to save setting"})
				return
			}
		}
		resp := s.loadRetentionSettings(request)
		writeJSON(writer, http.StatusOK, resp)
	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) loadRetentionSettings(request *http.Request) retentionSettingsResponse {
	ctx := request.Context()
	days := defaultRetentionDays
	if raw, ok, _ := s.store.GetSystemSetting(ctx, settingRetentionDays); ok {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			days = n
		}
	}
	enabled := false
	if raw, ok, _ := s.store.GetSystemSetting(ctx, settingRetentionEnabled); ok {
		enabled = raw == "true"
	}
	return retentionSettingsResponse{RetentionDays: days, AutoEnabled: enabled}
}

func (s *Service) runRetentionPurge() {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-s.stop:
			return
		case <-ticker.C:
			s.maybeAutoPurge()
		}
	}
}

func (s *Service) maybeAutoPurge() {
	ctx := context.Background()
	raw, ok, err := s.store.GetSystemSetting(ctx, settingRetentionEnabled)
	if err != nil || !ok || raw != "true" {
		return
	}
	days := defaultRetentionDays
	if raw2, ok2, _ := s.store.GetSystemSetting(ctx, settingRetentionDays); ok2 {
		if n, err := strconv.Atoi(raw2); err == nil && n > 0 {
			days = n
		}
	}
	olderThan := time.Now().UTC().Add(-time.Duration(days) * 24 * time.Hour)
	n, err := s.store.PurgeTrafficStats(ctx, olderThan)
	if err != nil {
		s.logger.Error("auto retention purge failed", "error", err)
		return
	}
	if n > 0 {
		s.logger.Info("auto retention purge complete", "purged", n, "older_than_days", days)
	}
}
