package service

import (
	"fmt"
	"net/http"
	"slices"

	"github.com/golang-jwt/jwt/v5"
)

type adminIdentity struct {
	Subject string
	Email   string
	Name    string
	Roles   []string
	Scope   string
}

type adminClaims struct {
	Email string   `json:"email"`
	Name  string   `json:"name"`
	Roles []string `json:"roles"`
	Scope string   `json:"scope"`
	jwt.RegisteredClaims
}

func validateAdminToken(rawToken, secret string) (adminIdentity, error) {
	if rawToken == "" {
		return adminIdentity{}, fmt.Errorf("missing bearer token")
	}

	claims := &adminClaims{}
	parsedToken, err := jwt.ParseWithClaims(
		rawToken,
		claims,
		func(token *jwt.Token) (any, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		},
		jwt.WithAudience("justgate-backend"),
		jwt.WithIssuer("justgate-admin"),
	)
	if err != nil || !parsedToken.Valid {
		return adminIdentity{}, fmt.Errorf("invalid admin token")
	}

	isAdmin := claims.Scope == "admin:control" || slices.Contains(claims.Roles, "admin")
	if !isAdmin {
		return adminIdentity{}, fmt.Errorf("admin scope is required")
	}
	if claims.Subject == "" {
		return adminIdentity{}, fmt.Errorf("admin subject is required")
	}

	return adminIdentity{
		Subject: claims.Subject,
		Email:   claims.Email,
		Name:    claims.Name,
		Roles:   claims.Roles,
		Scope:   claims.Scope,
	}, nil
}

// withSuperAdminAuth wraps a handler so only platform admins can access it.
// It reuses withAdminAuth for JWT validation and then checks the platform_admins table.
func (s *Service) withSuperAdminAuth(next http.HandlerFunc) http.HandlerFunc {
	return s.withAdminAuth(func(writer http.ResponseWriter, request *http.Request) {
		adminID := adminIDFromContext(request.Context())
		ok, err := s.store.IsPlatformAdmin(request.Context(), adminID)
		if err != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": "failed to verify platform admin status"})
			return
		}
		if !ok {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "platform admin access required"})
			return
		}
		next(writer, request)
	})
}
