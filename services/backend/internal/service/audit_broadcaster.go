package service

import (
	"encoding/json"
	"sync"
)

// auditBroadcaster distributes live audit events to connected WebSocket
// subscribers. Each subscriber gets its own buffered channel. Slow readers
// are dropped rather than blocking the proxy path.
type auditBroadcaster struct {
	mu          sync.RWMutex
	subscribers map[chan []byte]struct{}
}

func newAuditBroadcaster() *auditBroadcaster {
	return &auditBroadcaster{
		subscribers: make(map[chan []byte]struct{}),
	}
}

// Subscribe returns a channel that receives JSON-encoded audit events.
// The caller must call Unsubscribe when done.
func (b *auditBroadcaster) Subscribe() chan []byte {
	ch := make(chan []byte, 64)
	b.mu.Lock()
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber channel and closes it.
func (b *auditBroadcaster) Unsubscribe(ch chan []byte) {
	b.mu.Lock()
	delete(b.subscribers, ch)
	b.mu.Unlock()
	close(ch)
}

// Broadcast sends an audit event to all subscribers. Non-blocking: if a
// subscriber's buffer is full the message is dropped for that subscriber.
func (b *auditBroadcaster) Broadcast(event auditEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch := range b.subscribers {
		select {
		case ch <- data:
		default:
			// slow reader, skip
		}
	}
}
