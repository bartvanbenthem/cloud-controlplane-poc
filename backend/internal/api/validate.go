package api

import (
	"fmt"
	"regexp"
)

var (
	namePattern = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)
	uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

func validateName(field, v string) error {
	if v == "" {
		return fmt.Errorf("%s is required", field)
	}
	if len(v) > 63 {
		return fmt.Errorf("%s must be 63 characters or fewer", field)
	}
	if !namePattern.MatchString(v) {
		return fmt.Errorf("%s must be lowercase alphanumeric and hyphens only", field)
	}
	return nil
}

func validateUUID(field, v string) error {
	if !uuidPattern.MatchString(v) {
		return fmt.Errorf("%s must be a UUID", field)
	}
	return nil
}

func requireNonEmpty(field, v string) error {
	if v == "" {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}
