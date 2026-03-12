# AgentBus Design Discussions Summary

This document captures key design discussions and decisions from the development of AgentBus.

## Table of Contents

1. [Why Build vs Buy](#why-build-vs-buy)
2. [Architecture Decisions](#architecture-decisions)
3. [Communication Patterns](#communication-patterns)
4. [BoxCrew Integration](#boxcrew-integration)
5. [Testing Philosophy](#testing-philosophy)
6. [Future Roadmap](#future-roadmap)

---

## Why Build vs Buy

### Problem with Existing Systems

| System | Why It Doesn't Fit |
|--------|-------------------|
| **Apache Kafka** | Complex protocol, requires client libraries, partition management overhead |
| **Redis Streams** | Requires Redis server, not durable by default, limited consumer groups |
| **NATS** | Requires server deployment, learning curve |
| **AWS SQS/SNS** | Vendor lock-in, complex IAM, not dev-friendly for local testing |
| **RabbitMQ** | Heavy broker, AMQP complexity |
| **Temporal** | Heavy, workflow-centric, not pub/sub |

### Agent-Specific Needs

Agents are different from traditional services:
- **Ephemeral execution**: Spawn, process, die (seconds to minutes)
- **Polyglot runtime**: Python, Node, Go - anything with HTTP
- **Autonomous coordination**: No central orchestrator
- **Zero setup**: Must run locally without Docker

### Decision: Build

**Rationale:**
1. No existing system is truly *agent-native*
2. SQLite backend = zero infrastructure
3. HTTP API = universal accessibility
4. Building reveals which features actually matter

**Trade-off:** We sacrifice Kafka-scale throughput for developer experience.

---

## Architecture Decisions

### Single-Node vs Distributed

**Current (v0.1): Single-node SQLite**
- One process, one database file
- 1-5K msg/sec throughput (sufficient for agents)
- Deployment modes: Embedded, Sidecar, Centralized

**Future (v0.3): Distributed**
- Only needed for HA/production scale
- Would add: Raft consensus, partition replication

**Decision:** Start simple, add distribution later when needed.

### Delivery Semantics

**Question:** Exactly-once vs at-least-once?

**Answer:** At-least-once with idempotency support.

- Exactly-once in distributed systems is extremely hard
- Agents should be designed to handle duplicate messages
- Consumer groups track offsets to minimize duplicates

### Consumer Group Mechanism

**Chosen:** Visibility timeout model (like SQS)

```
1. Consumer claims message → lease created with expiry
2. Consumer processes (takes N seconds)
3. Consumer acks → lease deleted
4. If no ack before expiry → message available again
5. After max retries → Dead Letter Queue
```

**Why not Kafka-style partitions?**
- Partitions add complexity (rebalancing, assignment strategy)
- Agents don't need ordering guarantees across large volumes
- Simpler = fewer bugs

---

## Communication Patterns

### Pub/Sub vs Request-Reply

**AgentBus is pub/sub (event-driven), but agents often need request-response.**

#### Pattern 1: Pure Pub/Sub (Best for)
- Broadcasting: "Code is ready for review"
- Event chains: User request → Research → Write → Edit
- Fire-and-forget background tasks

#### Pattern 2: Request-Reply (Needed for)
- "Analyze this and tell me the result"
- Synchronous dependencies
- Timeout-sensitive operations

#### Hybrid Approach for BoxCrew

**Layer 1: AgentBus (Transport)**
- Reliable message delivery
- Persistence, retries, consumer groups

**Layer 2: Conversation API (Coordination)**
```python
conv = start_conversation(goal="Build web app")
design = await conv.ask("architect", "Design this")
code = await conv.ask("developer", f"Implement {design}")
```

**Layer 3: Workflow DSL (Optional)**
```yaml
workflows:
  build_app:
    steps:
      - agent: architect
        output: design
      - agent: developer
        input: "{{design}}"
```

### Is Pub/Sub the Best Way?

**Honest answer:** It depends.

| Scenario | Best Pattern |
|----------|--------------|
| Something happened → react | Pub/Sub ✅ |
| Do this → get result → do next | RPC / Workflow ✅ |
| Complex multi-step with dependencies | Orchestrator + Pub/Sub ✅ |

**Recommendation:** 
- Keep AgentBus as the reliable messaging layer
- Add conversation/workflow patterns on top
- Avoid pure pub/sub for complex request chains

---

## BoxCrew Integration

### Scenarios

#### Scenario 1: BoxCrew Provides AgentBus as Service ✅
```
Agent A → https://bus.boxcrew.internal/topics/tasks
Agent B → https://bus.boxcrew.internal/topics/tasks
```
- Agents use consumer groups to coordinate
- Persistent storage across agent restarts
- Works perfectly

#### Scenario 2: Self-Hosted (Doesn't Work)
```
Agent A runs AgentBus on port 8080
Agent B can't reach it (network isolation)
```
- Requires network tunneling or shared service

#### Scenario 3: Hybrid/Federation (Overkill)
- Each agent has embedded AgentBus
- Federation layer connects them
- Too complex for v1

### Architecture Recommendation

```
┌─────────────────────────────────────────┐
│           BoxCrew Platform              │
│  ┌─────────┐    ┌─────────────────┐    │
│  │ Agent A │───→│  AgentBus       │    │
│  │ (User)  │    │  (Managed       │    │
│  └─────────┘    │   Service)      │    │
│       ↑         └────────┬────────┘    │
│       │                  │             │
│  ┌─────────┐             ↓             │
│  │ Agent B │←── WebSocket / HTTP       │
│  │ (User)  │                            │
│  └─────────┘                            │
└─────────────────────────────────────────┘
```

**Key Requirements:**
- Topic scoping: `org-{id}/agent-{id}/tasks`
- Auth via BoxCrew JWT tokens
- Regional instances for latency
- Visibility timeout: 30-60s (agent processing time)

### Why Agents Need to Communicate

**Current limitation:** Each BoxCrew agent works in isolation

**With AgentBus:**
- **Specialization**: Architect → Developer → Reviewer agents
- **Persistence**: Message state survives agent restarts  
- **Parallelism**: Multiple agents work simultaneously
- **Reliability**: Failed steps retry automatically

**Competitive advantage:**
- vs OpenAI: Inter-agent communication
- vs LangChain: Built-in coordination
- vs custom: Zero-config, managed

---

## Testing Philosophy

### Test Coverage

| Category | Count | Key Tests |
|----------|-------|-----------|
| Basic Operations | 6 | Create topic, produce/consume/ack |
| Consumer Groups | 5 | Load balancing, visibility timeout |
| Failure Recovery | 4 | Crash recovery, DLQ, redelivery |
| Edge Cases | 10 | Unicode, large payloads, concurrent access |

### Key Bug Found & Fixed

**Issue:** Consumer groups weren't properly tracking acknowledged messages

**Root cause:** `claim_messages()` didn't check consumer offsets

**Fix:** Added offset check to filter out already-processed messages

```sql
-- Get last acknowledged offset for this group
SELECT last_offset FROM offsets 
WHERE consumer_group = ? AND topic_id = ?

-- Only claim messages with offset > last_offset
WHERE m.offset > ?
```

### Testing Lessons

1. **Integration tests > Unit tests** for distributed systems
2. **Test failure modes explicitly** (crashes, timeouts)
3. **Concurrent access** reveals race conditions
4. **Visibility timeout tests** need real waits (not mocked)

---

## Future Roadmap

### MVP (v0.1) ✅ Complete
- HTTP produce/consume
- Consumer groups with visibility timeout
- SQLite persistence
- Basic test suite

### v0.2 (Next)
- Dead letter queue UI
- Message replay API
- Docker image
- Basic auth

### v0.3 (Scale)
- Clustering (3-node HA)
- Metrics endpoint (Prometheus)
- Admin dashboard
- Cloud offering

### Open Questions

1. **Message priorities?** (P0/P1/P2 for urgent vs background)
2. **Default retention?** 7 days seems reasonable
3. **Scheduled messages?** "Deliver at time T"

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-12 | SQLite backend | Zero setup, sufficient for agent scale |
| 2026-03-12 | At-least-once delivery | Exactly-once is too hard, agents should be idempotent |
| 2026-03-12 | Visibility timeout model | Simpler than Kafka partitions |
| 2026-03-12 | HTTP API only | No client libraries needed |
| 2026-03-12 | Single-node v1 | Distribution can be added later |

---

## References

- `TUTORIAL.md` - Use case examples
- `docs/request_reply_patterns.md` - Communication patterns
- `PRD.md` - Full product requirements
- `tests/` - Comprehensive test suite
