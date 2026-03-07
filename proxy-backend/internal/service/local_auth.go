package service

import (
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func normalizeLocalAccountEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validateLocalAccountPassword(password string) error {
	trimmed := strings.TrimSpace(password)
	if len(trimmed) < 10 {
		return fmt.Errorf("password must be at least 10 characters")
	}
	return nil
}

func hashLocalAccountPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func verifyLocalAccountPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
