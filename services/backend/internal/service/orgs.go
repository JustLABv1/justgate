package service

import (
	"net/http"
	"strings"
	"time"
)

// handleOrgs handles GET /api/v1/admin/orgs and POST /api/v1/admin/orgs.
func (s *Service) handleOrgs(writer http.ResponseWriter, request *http.Request) {
	adminID := adminIDFromContext(request.Context())

	switch request.Method {
	case http.MethodGet:
		orgs, err := s.store.ListOrgs(request.Context(), adminID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list organisations"})
			return
		}
		items := make([]orgSummary, 0, len(orgs))
		for _, org := range orgs {
			items = append(items, orgSummary{
				ID:        org.ID,
				Name:      org.Name,
				Role:      org.Role,
				CreatedAt: org.CreatedAt.Format("2006-01-02T15:04:05Z"),
			})
		}
		writeJSON(writer, http.StatusOK, items)

	case http.MethodPost:
		var payload createOrgRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		payload.Name = strings.TrimSpace(payload.Name)
		if payload.Name == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		org, err := s.store.CreateOrg(request.Context(), payload.Name, adminID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to create organisation"})
			return
		}
		writeJSON(writer, http.StatusCreated, orgSummary{
			ID:        org.ID,
			Name:      org.Name,
			Role:      org.Role,
			CreatedAt: org.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// handleOrgByID handles /api/v1/admin/orgs/{...} sub-routes.
func (s *Service) handleOrgByID(writer http.ResponseWriter, request *http.Request) {
	adminID := adminIDFromContext(request.Context())
	trimmed := strings.TrimPrefix(request.URL.Path, "/api/v1/admin/orgs/")
	parts := strings.SplitN(trimmed, "/", 3)

	// POST /api/v1/admin/orgs/join  (accept invite, no org context needed)
	if parts[0] == "join" {
		s.handleAcceptInvite(writer, request, adminID)
		return
	}

	orgID := parts[0]
	if orgID == "" {
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	// All sub-routes below require org membership.
	membership, ok, err := s.store.GetOrgMembership(request.Context(), orgID, adminID)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to verify org membership"})
		return
	}
	if !ok {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "not a member of this organisation"})
		return
	}

	subPath := ""
	if len(parts) >= 2 {
		subPath = parts[1]
	}
	subID := ""
	if len(parts) >= 3 {
		subID = parts[2]
	}

	switch subPath {
	case "members":
		s.handleOrgMembers(writer, request, orgID, subID, membership.Role)
	case "invites":
		s.handleOrgInvites(writer, request, orgID, adminID, membership.Role)
	default:
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

func (s *Service) handleOrgMembers(writer http.ResponseWriter, request *http.Request, orgID, memberID, callerRole string) {
	switch request.Method {
	case http.MethodGet:
		// GET /api/v1/admin/orgs/{orgID}/members
		members, err := s.store.ListOrgMembers(request.Context(), orgID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to list members"})
			return
		}
		items := make([]memberSummary, 0, len(members))
		for _, m := range members {
			items = append(items, memberSummary{
				UserID:    m.UserID,
				UserName:  m.UserName,
				UserEmail: m.UserEmail,
				Role:      m.Role,
				JoinedAt:  m.JoinedAt.Format("2006-01-02T15:04:05Z"),
			})
		}
		writeJSON(writer, http.StatusOK, items)

	case http.MethodPost:
		// POST /api/v1/admin/orgs/{orgID}/members  (add by email, owner only)
		if callerRole != "owner" {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "only owners can add members"})
			return
		}
		var payload addMemberRequest
		if err := decodeJSON(request, &payload); err != nil {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		payload.Email = strings.ToLower(strings.TrimSpace(payload.Email))
		if payload.Email == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "email is required"})
			return
		}
		role := strings.TrimSpace(payload.Role)
		if role != "owner" && role != "member" {
			role = "member"
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
		if err := s.store.AddOrgMember(request.Context(), orgID, user.ID, role); err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to add member"})
			return
		}
		writeJSON(writer, http.StatusCreated, memberSummary{
			UserID:    user.ID,
			UserName:  user.Name,
			UserEmail: user.Email,
			Role:      role,
			JoinedAt:  time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		})

	case http.MethodDelete:
		// DELETE /api/v1/admin/orgs/{orgID}/members/{userID}
		if memberID == "" {
			writeJSON(writer, http.StatusNotFound, map[string]string{"error": "member ID required"})
			return
		}
		adminID := adminIDFromContext(request.Context())
		if callerRole != "owner" && memberID != adminID {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "only owners can remove other members"})
			return
		}
		if err := s.store.RemoveOrgMember(request.Context(), orgID, memberID); err != nil {
			status := http.StatusInternalServerError
			if err.Error() == "member not found" {
				status = http.StatusNotFound
			}
			writeJSON(writer, status, map[string]string{"error": err.Error()})
			return
		}
		writer.WriteHeader(http.StatusNoContent)

	default:
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleOrgInvites(writer http.ResponseWriter, request *http.Request, orgID, adminID, callerRole string) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if callerRole != "owner" {
		writeJSON(writer, http.StatusForbidden, map[string]string{"error": "only owners can create invites"})
		return
	}
	expiresAt := time.Now().UTC().Add(7 * 24 * time.Hour)
	invite, err := s.store.CreateOrgInvite(request.Context(), orgID, adminID, expiresAt, 10)
	if err != nil {
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to create invite"})
		return
	}
	writeJSON(writer, http.StatusCreated, orgInviteSummary{
		Code:      invite.Code,
		OrgID:     invite.OrgID,
		ExpiresAt: invite.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		MaxUses:   invite.MaxUses,
		UseCount:  invite.UseCount,
	})
}

func (s *Service) handleAcceptInvite(writer http.ResponseWriter, request *http.Request, adminID string) {
	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var payload acceptInviteRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	payload.Code = strings.TrimSpace(payload.Code)
	if payload.Code == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "code is required"})
		return
	}
	orgID, err := s.store.ConsumeOrgInvite(request.Context(), payload.Code, adminID)
	if err != nil {
		status := http.StatusBadRequest
		writeJSON(writer, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(writer, http.StatusOK, map[string]string{"orgID": orgID})
}
