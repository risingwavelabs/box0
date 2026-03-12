# Architecture Decision Records (ADRs)

## ADR 1: SQLite as Primary Storage

**Status:** Accepted

**Context:**
Need a storage backend that is:
- Zero-setup (no separate server)
- ACID-compliant
- Sufficient for agent-scale workloads (1-5K msg/sec)
- Easy to backup/inspect

**Decision:**
Use SQLite with WAL mode enabled.

**Consequences:**
- ✅ Single binary deployment
- ✅ ACID guarantees
- ✅ Easy debugging (just open the .db file)
- ❌ Single-node only (HA requires v0.3)
- ❌ Not suitable for >100GB data

**Rejected alternatives:**
- PostgreSQL: Requires separate server
- Redis: Not durable by default
- Custom format: Reinventing the wheel

---

## ADR 2: HTTP API Instead of Binary Protocol

**Status:** Accepted

**Context:**
Agents are polyglot (Python, Node, Go, shell scripts). Need universal accessibility.

**Decision:**
REST API + WebSocket for streaming.

**Consequences:**
- ✅ Any language can call it
- ✅ Works with curl for debugging
- ✅ Easy load balancing
- ❌ Higher overhead per message than binary protocols
- ❌ Less efficient than Kafka protocol

**Rejected alternatives:**
- Kafka protocol: Too complex
- gRPC: Requires client libraries
- Custom binary: Harder to debug

---

## ADR 3: Visibility Timeout Consumer Groups

**Status:** Accepted

**Context:**
Need consumer group semantics for load balancing. Two main approaches:
1. Kafka-style: Partition assignment, offset tracking
2. SQS-style: Visibility timeouts, leases

**Decision:**
Visibility timeout with per-message leases.

**Consequences:**
- ✅ Simpler implementation (no partition rebalancing)
- ✅ Natural handling of slow consumers
- ✅ Message-level timeout control
- ❌ Harder to provide ordering guarantees
- ❌ More DB queries (per-message leases)

**Schema:**
```sql
leases (
  message_id,
  consumer_group,
  consumer_id,
  acquired_at,
  expires_at,  -- visibility timeout
  delivery_count
)
```

---

## ADR 4: At-Least-Once Delivery

**Status:** Accepted

**Context:**
Delivery semantics options:
1. At-most-once: May lose messages
2. At-least-once: May duplicate, never lose
3. Exactly-once: Perfect, but very hard

**Decision:**
At-least-once with idempotency support.

**Consequences:**
- ✅ Implementable correctly
- ✅ No message loss
- ❌ Consumers must handle duplicates

**Mitigation:**
Document that consumers should be idempotent:
```python
def process_message(msg):
    if already_processed(msg.id):
        return  # Idempotent
    do_work(msg)
    mark_processed(msg.id)
```

---

## ADR 5: Single-Node First

**Status:** Accepted

**Context:**
Trade-off between building distributed system vs simple system first.

**Decision:**
Build single-node version (v0.1), add clustering in v0.3.

**Consequences:**
- ✅ Faster to market
- ✅ Simpler codebase
- ✅ Most agent use cases don't need distribution
- ❌ Requires migration path for HA needs

**Migration path:**
Same API, just add clustering layer:
```python
# v0.1
agentbus --data ./local.db

# v0.3
agentbus --cluster --peers node1,node2,node3
```

---

## ADR 6: No Built-In Request-Reply

**Status:** Accepted

**Context:**
Pub/sub is event-driven. Many agent interactions are request-response.

**Decision:**
Provide pub/sub primitive. Request-reply is a pattern on top.

**Rationale:**
- Request-reply has multiple valid implementations
- Keeping core simple allows flexibility
- Can provide conversation library as add-on

**Pattern for request-reply:**
```python
# Conversation layer on top of AgentBus
conv = Conversation(conversation_id)
response = await conv.ask("analyzer", data)
```

---

## ADR 7: Default Retention 7 Days

**Status:** Accepted

**Context:**
How long to keep messages? Trade-off between:
- Debugging ability
- Storage cost
- Replay needs

**Decision:**
7 days default, configurable per-topic.

**Rationale:**
- Enough for debugging recent issues
- Not overwhelming for disk usage
- Replay is typically for "what happened yesterday"

---

## ADR 8: Minimum Visibility Timeout 5 Seconds

**Status:** Accepted

**Context:**
Visibility timeout must be long enough for processing, but short enough for quick recovery.

**Decision:**
Min 5s, max 300s, default 30s.

**Rationale:**
- Agents can be slow (LLM calls take seconds)
- But too long means slow recovery from crashes
- 30s is reasonable default

---

## Open ADRs (Pending Decision)

### Schema Registry
Should AgentBus enforce message schemas?

**Options:**
1. No - schema on read (flexible)
2. Optional - per-topic schema validation
3. Required - strict schema enforcement

**Status:** Under discussion

### Message Priorities
Should some messages skip ahead in queue?

**Options:**
1. No - FIFO only (simple)
2. Priority levels (P0 urgent, P1 normal, P2 background)
3. Strict priority (can starve low priority)

**Status:** Under discussion
