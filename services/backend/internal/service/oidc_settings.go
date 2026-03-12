package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ── OIDC config types ──────────────────────────────────────────────────

type oidcConfigRequest struct {
	Issuer       string `json:"issuer"`
	ClientID     string `json:"clientID"`
	ClientSecret string `json:"clientSecret"`
	DisplayName  string `json:"displayName"`
	GroupsClaim  string `json:"groupsClaim"`
	Enabled      bool   `json:"enabled"`
}

type oidcConfigResponse struct {
	Issuer      string `json:"issuer"`
	ClientID    string `json:"clientID"`
	HasSecret   bool   `json:"hasSecret"`
	DisplayName string `json:"displayName"`
	GroupsClaim string `json:"groupsClaim"`
	Enabled     bool   `json:"enabled"`
	UpdatedAt   string `json:"updatedAt"`
	FromEnv     bool   `json:"fromEnv,omitempty"`
}

type oidcOrgMappingRequest struct {
	OIDCGroup string `json:"oidcGroup"`
	OrgID     string `json:"orgID"`
}

type oidcOrgMappingSummary struct {
	ID        string `json:"id"`
	OIDCGroup string `json:"oidcGroup"`
	OrgID     string `json:"orgID"`
	CreatedAt string `json:"createdAt"`
}

// ── Handlers ───────────────────────────────────────────────────────────

func (s *Service) handleOIDCSettings(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		cfg, ok, err := s.store.GetOIDCConfig(request.Context())
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load OIDC config"})
			return
		}
		if !ok {
			// No DB record – fall back to environment variable config if present.
			if s.config.OIDCIssuer != "" || s.config.OIDCClientID != "" {
				displayName := s.config.OIDCDisplayName
				if displayName == "" {
					displayName = "Single Sign-On"
				}
				writeJSON(writer, http.StatusOK, oidcConfigResponse{
					Issuer:      s.config.OIDCIssuer,
					ClientID:    s.config.OIDCClientID,
					HasSecret:   s.config.OIDCClientSecret != "",
					DisplayName: displayName,
					Enabled:     true,
					FromEnv:     true,
				})
				return
			}
			writeJSON(writer, http.StatusOK, oidcConfigResponse{
				DisplayName: "Single Sign-On",
			})
			return
		}
		writeJSON(writer, http.StatusOK, oidcConfigResponse{
			Issuer:      cfg.Issuer,
			ClientID:    cfg.ClientID,
			HasSecret:   cfg.ClientSecretEncrypted != "",
			DisplayName: cfg.DisplayName,
			GroupsClaim: cfg.GroupsClaim,
			Enabled:     cfg.Enabled,
			UpdatedAt:   cfg.UpdatedAt.Format(time.RFC3339),
		})

	case http.MethodPut:
		var payload oidcConfigRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		payload.Issuer = strings.TrimRight(strings.TrimSpace(payload.Issuer), "/")
		payload.ClientID = strings.TrimSpace(payload.ClientID)
		payload.ClientSecret = strings.TrimSpace(payload.ClientSecret)
		payload.DisplayName = strings.TrimSpace(payload.DisplayName)
		payload.GroupsClaim = strings.TrimSpace(payload.GroupsClaim)

		if payload.DisplayName == "" {
			payload.DisplayName = "Single Sign-On"
		}

		if payload.Enabled {
			if payload.Issuer == "" || payload.ClientID == "" {
				writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "issuer and clientID are required when enabled"})
				return
			}
			if _, err := url.ParseRequestURI(payload.Issuer); err != nil {
				writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "issuer must be a valid URL"})
				return
			}
		}

		// Handle client secret: encrypt if new value provided, keep existing if empty
		var encryptedSecret string
		if payload.ClientSecret != "" {
			encrypted, err := encryptSecret(payload.ClientSecret, s.config.AdminJWTSecret)
			if err != nil {
				writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to encrypt client secret"})
				return
			}
			encryptedSecret = encrypted
		} else {
			// Keep existing secret
			existing, ok, err := s.store.GetOIDCConfig(request.Context())
			if err == nil && ok {
				encryptedSecret = existing.ClientSecretEncrypted
			}
		}

		now := time.Now().UTC()
		if err := s.store.UpsertOIDCConfig(request.Context(), oidcConfigRecord{
			ID:                    "global",
			Issuer:                payload.Issuer,
			ClientID:              payload.ClientID,
			ClientSecretEncrypted: encryptedSecret,
			DisplayName:           payload.DisplayName,
			GroupsClaim:           payload.GroupsClaim,
			Enabled:               payload.Enabled,
			UpdatedAt:             now,
		}); err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to save OIDC config"})
			return
		}

		writeJSON(writer, http.StatusOK, oidcConfigResponse{
			Issuer:      payload.Issuer,
			ClientID:    payload.ClientID,
			HasSecret:   encryptedSecret != "",
			DisplayName: payload.DisplayName,
			GroupsClaim: payload.GroupsClaim,
			Enabled:     payload.Enabled,
			UpdatedAt:   now.Format(time.RFC3339),
		})

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleOIDCMappings(writer http.ResponseWriter, request *http.Request) {
	// Handle DELETE: /api/v1/admin/settings/oidc/mappings/{id}
	trimmed := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/settings/oidc/mappings")
	mappingID := strings.Trim(trimmed, "/")

	if mappingID != "" && request.Method == http.MethodDelete {
		if err := s.store.DeleteOIDCOrgMapping(request.Context(), mappingID); err != nil {
			status := http.StatusInternalServerError
			if err.Error() == "mapping not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		writer.WriteHeader(http.StatusNoContent)
		return
	}

	switch request.Method {
	case http.MethodGet:
		mappings, err := s.store.ListOIDCOrgMappings(request.Context())
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list OIDC mappings"})
			return
		}
		items := make([]oidcOrgMappingSummary, 0, len(mappings))
		for _, m := range mappings {
			items = append(items, oidcOrgMappingSummary{
				ID:        m.ID,
				OIDCGroup: m.OIDCGroup,
				OrgID:     m.OrgID,
				CreatedAt: m.CreatedAt.Format(time.RFC3339),
			})
		}
		writeJSON(writer, http.StatusOK, items)

	case http.MethodPost:
		var payload oidcOrgMappingRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		payload.OIDCGroup = strings.TrimSpace(payload.OIDCGroup)
		payload.OrgID = strings.TrimSpace(payload.OrgID)

		if payload.OIDCGroup == "" || payload.OrgID == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "oidcGroup and orgID are required"})
			return
		}

		mapping := oidcOrgMappingRecord{
			ID:        newResourceID("mapping"),
			OIDCGroup: payload.OIDCGroup,
			OrgID:     payload.OrgID,
			CreatedAt: time.Now().UTC(),
		}

		if err := s.store.CreateOIDCOrgMapping(request.Context(), mapping); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(writer, http.StatusCreated, oidcOrgMappingSummary{
			ID:        mapping.ID,
			OIDCGroup: mapping.OIDCGroup,
			OrgID:     mapping.OrgID,
			CreatedAt: mapping.CreatedAt.Format(time.RFC3339),
		})

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// ── Internal provider config (returns decrypted secret for frontend auth) ──

type oidcProviderConfigResponse struct {
	Issuer       string `json:"issuer"`
	ClientID     string `json:"clientID"`
	ClientSecret string `json:"clientSecret"`
	DisplayName  string `json:"displayName"`
	GroupsClaim  string `json:"groupsClaim"`
	Enabled      bool   `json:"enabled"`
}

func (s *Service) handleInternalOIDCProviderConfig(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	cfg, ok, err := s.store.GetOIDCConfig(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to load OIDC config"})
		return
	}
	if !ok || !cfg.Enabled {
		writeJSON(writer, http.StatusOK, oidcProviderConfigResponse{})
		return
	}

	secret, err := decryptSecret(cfg.ClientSecretEncrypted, s.config.AdminJWTSecret)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to decrypt client secret"})
		return
	}

	writeJSON(writer, http.StatusOK, oidcProviderConfigResponse{
		Issuer:       cfg.Issuer,
		ClientID:     cfg.ClientID,
		ClientSecret: secret,
		DisplayName:  cfg.DisplayName,
		GroupsClaim:  cfg.GroupsClaim,
		Enabled:      cfg.Enabled,
	})
}

// ── Secret encryption helpers ──────────────────────────────────────────

func deriveKey(secret string) []byte {
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
}

func encryptSecret(plaintext, keySecret string) (string, error) {
	key := deriveKey(keySecret)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptSecret(encrypted, keySecret string) (string, error) {
	if encrypted == "" {
		return "", nil
	}
	key := deriveKey(keySecret)
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("failed to decode encrypted secret")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("encrypted data too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt secret")
	}
	return string(plaintext), nil
}
