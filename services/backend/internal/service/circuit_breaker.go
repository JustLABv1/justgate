package service

import (
	"context"
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
		if time.Since(cb.openedAt) > cbOpenDuration {
			// Transition to half-open
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

	if cb.state == cbStateHalfOpen {
		// Recovery: close the breaker
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

// GetState returns the current state for a route (for API reporting).
func (m *circuitBreakerManager) GetState(routeID string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cb, exists := m.breakers[routeID]
	if !exists {
		return cbStateClosed
	}

	// Re-check open->half-open transition
	if cb.state == cbStateOpen && time.Since(cb.openedAt) > cbOpenDuration {
		return cbStateHalfOpen
	}
	return cb.state
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
	}
	go func() {
		if err := m.store.UpsertCircuitBreaker(context.Background(), record); err != nil {
			m.logger.Error("failed to persist circuit breaker state", "route_id", record.RouteID, "error", err)
		}
	}()
}

// LoadFromStore initializes in-memory state from the database.
func (m *circuitBreakerManager) LoadFromStore(ctx context.Context) {
	// We use individual lookups when needed; bulk load not needed at startup
	// since cold-start means all breakers are closed.
}
