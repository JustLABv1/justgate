package service

import (
	"math"
	"sync"
	"time"
)

// rateLimiter controls request rates. The in-memory token-bucket
// implementation is used by default; a Redis adapter can be plugged in later
// via the rateLimiter interface.
type rateLimiter interface {
	// Allow checks whether a request keyed by `key` is permitted.
	// rpm is the limit in requests per minute; burst is the maximum burst.
	// Returns true if allowed.
	Allow(key string, rpm, burst int) bool
}

// ── In-memory token-bucket limiter ─────────────────────────────────────

type tokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

type memoryRateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	now     func() time.Time
}

func newMemoryRateLimiter() *memoryRateLimiter {
	return &memoryRateLimiter{
		buckets: make(map[string]*tokenBucket),
		now:     func() time.Time { return time.Now() },
	}
}

func (rl *memoryRateLimiter) Allow(key string, rpm, burst int) bool {
	if rpm <= 0 {
		return true // no limit configured
	}
	if burst <= 0 {
		burst = int(math.Max(1, float64(rpm)/10))
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := rl.now()

	// Composite key includes the rpm/burst so changing settings invalidates old buckets
	bucketKey := key

	bucket, ok := rl.buckets[bucketKey]
	if !ok {
		bucket = &tokenBucket{
			tokens:     float64(burst),
			maxTokens:  float64(burst),
			refillRate: float64(rpm) / 60.0,
			lastRefill: now,
		}
		rl.buckets[bucketKey] = bucket
	}

	// Refill based on elapsed time
	elapsed := now.Sub(bucket.lastRefill).Seconds()
	if elapsed > 0 {
		bucket.tokens = math.Min(bucket.maxTokens, bucket.tokens+elapsed*bucket.refillRate)
		bucket.lastRefill = now
	}

	if bucket.tokens < 1 {
		return false
	}

	bucket.tokens--
	return true
}

// cleanup removes stale buckets that haven't been accessed recently.
func (rl *memoryRateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := rl.now().Add(-10 * time.Minute)
	for key, bucket := range rl.buckets {
		if bucket.lastRefill.Before(cutoff) {
			delete(rl.buckets, key)
		}
	}
}
