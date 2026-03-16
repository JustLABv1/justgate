package service

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

const (
	cbStateClosed   = "closed"
	cbStateOpen     = "open"
	cbStateHalfOpen = "half_open"

	// Default thresholds
	cbFailureThreshold   = 5
	cbOpenDuration       = 30 * time.Second
	cbHalfOpenMaxRetries = 1
)

// circuitBreakerManager manages per-route circuit breakers in-memory,
// syncing state to the database periodically.
type circuitBreakerManager struct {
	mu       sync.RWMutex
	breakers map[string]*circuitBreakerState
	store    dataStore
	logger   interface{ Error(msg string, args ...any) }
}

type circuitBreakerState struct {
	routeID       string
	state         string
	failureCount  int
	lastFailureAt time.Time
	lastSuccessAt time.Time
	openedAt      time.Time
	halfOpenAt    time.Time
	locked        bool // when true, automatic state transitions are suppressed
}

func newCircuitBreakerManager(store dataStore, logger interface{ Error(msg string, args ...any) }) *circuitBreakerManager {
	return &circuitBreakerManager{
		breakers: make(map[string]*circuitBreakerState),
		store:    store,
		logger:   logger,
	}
}

// AllowRequest returns true if the circuit breaker for the route allows the request.
func (m *circuitBreakerManager) AllowRequest(routeID string) bool {
	m.mu.RLock()
	cb, exists := m.breakers[routeID]
	m.mu.RUnlock()

	if !exists {
		return true // no breaker = closed = allow
	}

	switch cb.state {
	case cbStateClosed:
		return true
	case cbStateOpen:
		if !cb.locked && time.Since(cb.openedAt) > cbOpenDuration {
			// Transition to half-open (only when not manually locked)
			m.mu.Lock()
			cb.state = cbStateHalfOpen
			cb.halfOpenAt = time.Now()
			m.mu.Unlock()
			return true
		}
		return false
	case cbStateHalfOpen:
		return true // allow a trial request
	default:
		return true
	}
}

// RecordSuccess records a successful upstream response.
func (m *circuitBreakerManager) RecordSuccess(routeID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cb, exists := m.breakers[routeID]
	if !exists {
		return
	}

	cb.lastSuccessAt = time.Now()

	if cb.state == cbStateHalfOpen && !cb.locked {
		// Recovery: close the breaker (only when not manually locked)
		cb.state = cbStateClosed
		cb.failureCount = 0
	}

	m.persistAsync(cb)
}

// RecordFailure records a failed upstream response.
func (m *circuitBreakerManager) RecordFailure(routeID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cb, exists := m.breakers[routeID]
	if !exists {
		cb = &circuitBreakerState{
			routeID: routeID,
			state:   cbStateClosed,
		}
		m.breakers[routeID] = cb
	}

	now := time.Now()
	cb.failureCount++
	cb.lastFailureAt = now

	if cb.state == cbStateHalfOpen {
		// Failed during half-open: go back to open
		cb.state = cbStateOpen
		cb.openedAt = now
	} else if cb.failureCount >= cbFailureThreshold {
		cb.state = cbStateOpen
		cb.openedAt = now
	}

	m.persistAsync(cb)
}

// GetLocked returns whether the circuit breaker is manually locked.
func (m *circuitBreakerManager) GetLocked(routeID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	cb, exists := m.breakers[routeID]
	if !exists {
		return false
	}
	return cb.locked
}

// GetState returns the current state for a route (for API reporting).
func (m *circuitBreakerManager) GetState(routeID string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cb, exists := m.breakers[routeID]
	if !exists {
		return cbStateClosed
	}

	// Re-check open->half-open transition (only when not manually locked)
	if cb.state == cbStateOpen && !cb.locked && time.Since(cb.openedAt) > cbOpenDuration {
		return cbStateHalfOpen
	}
	return cb.state
}

// ForceState overrides the circuit breaker state for a route.
// Valid states are "closed", "open", and "half_open".
// The write is synchronous so that the state is durable before the HTTP response is sent.
func (m *circuitBreakerManager) ForceState(ctx context.Context, routeID string, state string) error {
	m.mu.Lock()

	cb, exists := m.breakers[routeID]
	if !exists {
		cb = &circuitBreakerState{routeID: routeID}
		m.breakers[routeID] = cb
	}

	now := time.Now()
	cb.state = state
	switch state {
	case cbStateClosed:
		cb.failureCount = 0
		cb.locked = false
	case cbStateOpen:
		cb.openedAt = now
		cb.locked = true // manual open: hold until explicitly cleared
	case cbStateHalfOpen:
		cb.halfOpenAt = now
		cb.locked = false
	}

	record := circuitBreakerRecord{
		RouteID:       cb.routeID,
		State:         cb.state,
		FailureCount:  cb.failureCount,
		LastFailureAt: cb.lastFailureAt,
		LastSuccessAt: cb.lastSuccessAt,
		OpenedAt:      cb.openedAt,
		HalfOpenAt:    cb.halfOpenAt,
		Locked:        cb.locked,
	}
	m.mu.Unlock()

	if err := m.store.UpsertCircuitBreaker(ctx, record); err != nil {
		return err
	}
	slog.Info("circuit breaker: state persisted", "route_id", record.RouteID, "state", record.State, "locked", record.Locked)
	return nil
}

func (m *circuitBreakerManager) persistAsync(cb *circuitBreakerState) {
	record := circuitBreakerRecord{
		RouteID:       cb.routeID,
		State:         cb.state,
		FailureCount:  cb.failureCount,
		LastFailureAt: cb.lastFailureAt,
		LastSuccessAt: cb.lastSuccessAt,
		OpenedAt:      cb.openedAt,
		HalfOpenAt:    cb.halfOpenAt,
		Locked:        cb.locked,
	}
	go func() {
		if err := m.store.UpsertCircuitBreaker(context.Background(), record); err != nil {
			m.logger.Error("failed to persist circuit breaker state", "route_id", record.RouteID, "error", err)
		}
	}()
}

// LoadFromStore restores persisted circuit breaker state from the database on startup.
// This ensures manually locked breakers (and any open/half-open state) survive a restart.
func (m *circuitBreakerManager) LoadFromStore(ctx context.Context) {
	records, err := m.store.ListCircuitBreakers(ctx)
	if err != nil {
		m.logger.Error("circuit breaker: failed to load persisted state", "error", err)
		return
	}
	slog.Info("circuit breaker: loading persisted state", "count", len(records))
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, rec := range records {
		slog.Info("circuit breaker: restoring", "route_id", rec.RouteID, "state", rec.State, "locked", rec.Locked)
		m.breakers[rec.RouteID] = &circuitBreakerState{
			routeID:       rec.RouteID,
			state:         rec.State,
			failureCount:  rec.FailureCount,
			lastFailureAt: rec.LastFailureAt,
			lastSuccessAt: rec.LastSuccessAt,
			openedAt:      rec.OpenedAt,
			halfOpenAt:    rec.HalfOpenAt,
			locked:        rec.Locked,
		}
	}
}
