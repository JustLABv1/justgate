package service

import (
	"fmt"
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
		jwt.WithAudience("just-proxy-guard-backend"),
		jwt.WithIssuer("just-proxy-guard-admin"),
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
