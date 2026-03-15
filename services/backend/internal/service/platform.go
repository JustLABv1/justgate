package service

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// ── Platform admin response types ─────────────────────────────────────

type platformAdminSummary struct {
	UserID    string `json:"userID"`
	UserName  string `json:"userName"`
	UserEmail string `json:"userEmail"`
	GrantedBy string `json:"grantedBy"`
	GrantedAt string `json:"grantedAt"`
}

type userAdminSummary struct {
	ID              string `json:"id"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	Source          string `json:"source"`
	CreatedAt       string `json:"createdAt"`
	IsPlatformAdmin bool   `json:"isPlatformAdmin"`
}

type orgAdminSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	CreatedBy   string `json:"createdBy"`
	CreatedAt   string `json:"createdAt"`
	MemberCount int    `json:"memberCount"`
}

type grantPlatformAdminRequest struct {
	Email string `json:"email"`
}

type platformCheckResponse struct {
	IsPlatformAdmin bool `json:"isPlatformAdmin"`
}

// ── Route registration (called from Handler()) ─────────────────────────

func (s *Service) registerPlatformRoutes(mux interface {
	HandleFunc(string, func(http.ResponseWriter, *http.Request))
}) {
	type muxer interface {
		HandleFunc(string, func(http.ResponseWriter, *http.Request))
	}
	m := mux.(muxer)
	// Check endpoint — used by frontend to include isPlatformAdmin in display logic
	m.HandleFunc("/api/v1/admin/platform/check", s.withAdminAuth(s.handlePlatformCheck))
	// Platform admin management
	m.HandleFunc("/api/v1/admin/platform/admins", s.withSuperAdminAuth(s.handlePlatformAdmins))
	m.HandleFunc("/api/v1/admin/platform/admins/", s.withSuperAdminAuth(s.handlePlatformAdminByID))
	// User management
	m.HandleFunc("/api/v1/admin/platform/users", s.withSuperAdminAuth(s.handlePlatformUsers))
	m.HandleFunc("/api/v1/admin/platform/users/", s.withSuperAdminAuth(s.handlePlatformUserByID))
	// Org management
	m.HandleFunc("/api/v1/admin/platform/orgs", s.withSuperAdminAuth(s.handlePlatformOrgs))
	m.HandleFunc("/api/v1/admin/platform/orgs/", s.withSuperAdminAuth(s.handlePlatformOrgByID))
	// Replica / multi-region status
	m.HandleFunc("/api/v1/admin/platform/replicas", s.withSuperAdminAuth(s.handleReplicas))
}

// ── Handlers ───────────────────────────────────────────────────────────

// GET /api/v1/admin/platform/check — accessible to all admins; returns isPlatformAdmin flag
func (s *Service) handlePlatformCheck(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	adminID := adminIDFromContext(request.Context())
	ok, err := s.store.IsPlatformAdmin(request.Context(), adminID)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to check platform admin status"})
		return
	}
	writeJSON(writer, http.StatusOK, platformCheckResponse{IsPlatformAdmin: ok})
}

// GET /api/v1/admin/platform/admins — list platform admins
// POST /api/v1/admin/platform/admins — grant platform admin by email
func (s *Service) handlePlatformAdmins(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		admins, err := s.store.ListPlatformAdmins(request.Context())
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list platform admins"})
			return
		}
		items := make([]platformAdminSummary, 0, len(admins))
		for _, a := range admins {
			items = append(items, platformAdminSummary{
				UserID:    a.UserID,
				UserName:  a.UserName,
				UserEmail: a.UserEmail,
				GrantedBy: a.GrantedBy,
				GrantedAt: a.GrantedAt.Format(time.RFC3339),
			})
		}
		writeJSON(writer, http.StatusOK, items)

	case http.MethodPost:
		var payload grantPlatformAdminRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		payload.Email = strings.ToLower(strings.TrimSpace(payload.Email))
		if payload.Email == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "email is required"})
			return
		}
		user, ok, err := s.store.GetUserByEmail(request.Context(), payload.Email)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to look up user"})
			return
		}
		if !ok {
			writeJSON(writer, http.StatusNotFound, map[string]string{"error": "no account found for that email"})
			return
		}
		callerID := adminIDFromContext(request.Context())
		if err := s.store.GrantPlatformAdmin(request.Context(), user.ID, callerID); err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to grant platform admin"})
			return
		}
		writeJSON(writer, http.StatusCreated, platformAdminSummary{
			UserID:    user.ID,
			UserName:  user.Name,
			UserEmail: user.Email,
			GrantedBy: callerID,
			GrantedAt: time.Now().UTC().Format(time.RFC3339),
		})

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// DELETE /api/v1/admin/platform/admins/{userID}
func (s *Service) handlePlatformAdminByID(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodDelete {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	userID := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/platform/admins/")
	userID = strings.Trim(userID, "/")
	if userID == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "user ID required"})
		return
	}

	// Prevent last admin from removing themselves
	callerID := adminIDFromContext(request.Context())
	if userID == callerID {
		count, err := s.store.CountPlatformAdmins(request.Context())
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to count platform admins"})
			return
		}
		if count <= 1 {
			writeJSON(writer, http.StatusConflict, map[string]string{"error": "cannot remove the last platform admin"})
			return
		}
	}

	if err := s.store.RevokePlatformAdmin(request.Context(), userID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "platform admin not found" {
			status = http.StatusNotFound
		}
		writeJSON(writer, status, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/admin/platform/users — list all users
func (s *Service) handlePlatformUsers(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	users, err := s.store.ListAllUsers(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list users"})
		return
	}
	// Build a set of platform admin IDs for O(1) lookup.
	adminRecords, _ := s.store.ListPlatformAdmins(request.Context())
	adminSet := make(map[string]bool, len(adminRecords))
	for _, a := range adminRecords {
		adminSet[a.UserID] = true
	}
	items := make([]userAdminSummary, 0, len(users))
	for _, u := range users {
		items = append(items, userAdminSummary{
			ID:              u.ID,
			Email:           u.Email,
			Name:            u.Name,
			Source:          u.Source,
			CreatedAt:       u.CreatedAt.Format(time.RFC3339),
			IsPlatformAdmin: adminSet[u.ID],
		})
	}
	writeJSON(writer, http.StatusOK, items)
}

// DELETE /api/v1/admin/platform/users/{userID}
func (s *Service) handlePlatformUserByID(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodDelete {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	userID := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/platform/users/")
	userID = strings.Trim(userID, "/")
	if userID == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "user ID required"})
		return
	}
	// Prevent platform admins from deleting themselves
	callerID := adminIDFromContext(request.Context())
	if userID == callerID {
		writeJSON(writer, http.StatusConflict, map[string]string{"error": "cannot delete your own account"})
		return
	}
	if err := s.store.DeleteUser(request.Context(), userID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "user not found" {
			status = http.StatusNotFound
		}
		writeJSON(writer, status, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/admin/platform/orgs — list all orgs
func (s *Service) handlePlatformOrgs(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	orgs, err := s.store.ListAllOrgs(request.Context())
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list orgs"})
		return
	}
	// Fetch member counts for all orgs
	items := make([]orgAdminSummary, 0, len(orgs))
	for _, o := range orgs {
		_, count, err := s.store.GetOrgWithMemberCount(request.Context(), o.ID)
		if err != nil {
			count = 0
		}
		items = append(items, orgAdminSummary{
			ID:          o.ID,
			Name:        o.Name,
			CreatedBy:   o.CreatedBy,
			CreatedAt:   o.CreatedAt.Format(time.RFC3339),
			MemberCount: count,
		})
	}
	writeJSON(writer, http.StatusOK, items)
}

// DELETE /api/v1/admin/platform/orgs/{orgID}
func (s *Service) handlePlatformOrgByID(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodDelete {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	orgID := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/platform/orgs/")
	orgID = strings.Trim(orgID, "/")
	if orgID == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "org ID required"})
		return
	}
	if err := s.store.DeleteOrg(request.Context(), orgID); err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "org not found" {
			status = http.StatusNotFound
		}
		writeJSON(writer, status, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

// seedInitialPlatformAdmin looks up the user by email and grants them platform admin status.
// Called once at startup; idempotent (uses INSERT OR IGNORE).
// Retries for up to 10 minutes in case the user hasn't signed in yet.
func (s *Service) seedInitialPlatformAdmin(email string) {
	ctx := context.Background()
	email = strings.ToLower(strings.TrimSpace(email))

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	deadline := time.Now().Add(10 * time.Minute)

	for {
		user, ok, err := s.store.GetUserByEmail(ctx, email)
		if err != nil {
			s.logger.Warn("failed to look up initial platform admin email", "email", email, "error", err.Error())
			return
		}
		if ok {
			if err := s.store.GrantPlatformAdmin(ctx, user.ID, "system"); err != nil {
				s.logger.Warn("failed to seed initial platform admin", "email", email, "error", err.Error())
			} else {
				s.logger.Info("seeded initial platform admin", "email", email, "userID", user.ID)
			}
			return
		}

		if time.Now().After(deadline) {
			s.logger.Warn("giving up seeding initial platform admin — user never signed in", "email", email)
			return
		}
		s.logger.Info("initial platform admin not in DB yet, will retry", "email", email)
		<-ticker.C
	}
}
