package service

import (
	"context"
	"net/http"
	"strings"
	"time"
)

type setupStatusResponse struct {
	SetupRequired bool `json:"setupRequired"`
}

type setupOIDCConfig struct {
	Issuer       string `json:"issuer"`
	ClientID     string `json:"clientID"`
	ClientSecret string `json:"clientSecret"`
	DisplayName  string `json:"displayName"`
	AdminGroup   string `json:"adminGroup"`
}

type setupCompleteRequest struct {
	// Local admin account — optional when OIDC with AdminGroup is provided.
	AdminName     string           `json:"adminName"`
	AdminEmail    string           `json:"adminEmail"`
	AdminPassword string           `json:"adminPassword"`
	OIDC          *setupOIDCConfig `json:"oidc,omitempty"`
}

// isSetupRequired returns true when setup has not been explicitly marked
// complete AND no local admin accounts exist. OIDC-only setups mark
// setup_complete themselves, so this returns false once the wizard finishes.
func (s *Service) isSetupRequired(ctx context.Context) (bool, error) {
	val, ok, err := s.store.GetSystemSetting(ctx, "setup_complete")
	if err != nil {
		return false, err
	}
	if ok && val == "true" {
		return false, nil
	}
	count, err := s.store.CountLocalAdmins(ctx)
	if err != nil {
		return false, err
	}
	return count == 0, nil
}

// autoCompleteSetupForExistingDeployments marks setup as complete when local
// admin accounts already exist. Called once at startup so every subsequent
// status check is a fast single-row system_settings lookup.
func (s *Service) autoCompleteSetupForExistingDeployments() {
	ctx := context.Background()
	val, ok, err := s.store.GetSystemSetting(ctx, "setup_complete")
	if err != nil || (ok && val == "true") {
		return
	}
	count, err := s.store.CountLocalAdmins(ctx)
	if err != nil || count == 0 {
		return
	}
	if err := s.store.SetSystemSetting(ctx, "setup_complete", "true"); err != nil {
		s.logger.Warn("failed to auto-complete setup for existing deployment", "error", err)
		return
	}
	s.logger.Info("existing deployment detected — initial setup auto-completed")
}

func (s *Service) handleSetupStatus(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	required, err := s.isSetupRequired(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to check setup status"})
		return
	}
	writeJSON(writer, http.StatusOK, setupStatusResponse{SetupRequired: required})
}

func (s *Service) handleSetupComplete(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	required, err := s.isSetupRequired(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to check setup status"})
		return
	}
	if !required {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "setup already completed"})
		return
	}

	var payload setupCompleteRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// Determine whether this is a local-account setup or OIDC-only setup.
	hasLocalAccount := strings.TrimSpace(payload.AdminEmail) != ""
	hasOIDCWithGroup := payload.OIDC != nil &&
		payload.OIDC.Issuer != "" &&
		payload.OIDC.ClientID != "" &&
		payload.OIDC.ClientSecret != "" &&
		strings.TrimSpace(payload.OIDC.AdminGroup) != ""

	if !hasLocalAccount && !hasOIDCWithGroup {
		writeJSON(writer, http.StatusBadRequest, map[string]string{
			"error": "either a local admin account or an OIDC configuration with an admin group is required",
		})
		return
	}

	now := time.Now().UTC()

	// ── Path A: local admin account ─────────────────────────────────────
	var createdID, createdEmail, createdName string
	if hasLocalAccount {
		payload.AdminEmail = normalizeLocalAccountEmail(payload.AdminEmail)
		payload.AdminName = strings.TrimSpace(payload.AdminName)
		if payload.AdminEmail == "" || payload.AdminName == "" || payload.AdminPassword == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "adminName, adminEmail, and adminPassword are required"})
			return
		}
		if err := validateLocalAccountPassword(payload.AdminPassword); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		passwordHash, err := hashLocalAccountPassword(payload.AdminPassword)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to hash password"})
			return
		}
		account, err := s.store.CreateLocalAdmin(request.Context(), localAdminRecord{
			ID:           newResourceID("admin"),
			Email:        payload.AdminEmail,
			Name:         payload.AdminName,
			PasswordHash: passwordHash,
			CreatedAt:    now,
		})
		if err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := s.store.UpsertUser(request.Context(), userRecord{
			ID:        account.ID,
			Email:     account.Email,
			Name:      account.Name,
			Source:    "local",
			CreatedAt: now,
		}); err != nil {
			s.logger.Warn("setup: failed to upsert user record", "error", err)
		}
		if err := s.store.GrantPlatformAdmin(request.Context(), account.ID, "setup"); err != nil {
			s.logger.Warn("setup: failed to grant platform admin", "error", err)
		}
		createdID, createdEmail, createdName = account.ID, account.Email, account.Name
	}

	// ── Persist OIDC config if provided ─────────────────────────────────
	if oidc := payload.OIDC; oidc != nil && oidc.Issuer != "" && oidc.ClientID != "" && oidc.ClientSecret != "" {
		oidc.Issuer = strings.TrimRight(strings.TrimSpace(oidc.Issuer), "/")
		oidc.ClientID = strings.TrimSpace(oidc.ClientID)
		oidc.AdminGroup = strings.TrimSpace(oidc.AdminGroup)
		displayName := strings.TrimSpace(oidc.DisplayName)
		if displayName == "" {
			displayName = "Single Sign-On"
		}
		if encrypted, err := encryptSecret(oidc.ClientSecret, s.config.AdminJWTSecret); err == nil {
			if err := s.store.UpsertOIDCConfig(request.Context(), oidcConfigRecord{
				ID:                    "global",
				Issuer:                oidc.Issuer,
				ClientID:              oidc.ClientID,
				ClientSecretEncrypted: encrypted,
				DisplayName:           displayName,
				AdminGroup:            oidc.AdminGroup,
				Enabled:               true,
				UpdatedAt:             now,
			}); err != nil {
				s.logger.Warn("setup: failed to save OIDC config", "error", err)
			}
		}
	}

	if err := s.store.SetSystemSetting(request.Context(), "setup_complete", "true"); err != nil {
		s.logger.Warn("setup: failed to mark setup complete", "error", err)
	}

	if hasLocalAccount {
		s.logger.Info("initial setup completed (local account)", "adminEmail", createdEmail, "adminID", createdID)
		writeJSON(writer, http.StatusOK, map[string]string{
			"id":    createdID,
			"email": createdEmail,
			"name":  createdName,
		})
	} else {
		s.logger.Info("initial setup completed (OIDC-only)", "adminGroup", payload.OIDC.AdminGroup)
		writeJSON(writer, http.StatusOK, map[string]string{
			"mode": "oidc-only",
		})
	}
}
