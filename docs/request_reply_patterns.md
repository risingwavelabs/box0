# Request-Reply Patterns with AgentBus

AgentBus is pub/sub (event-driven), but agents often need request-response patterns. Here are three approaches:

## Pattern 1: Correlation ID + Reply Topic

The requester creates a unique reply topic and includes it in the request.

```python
# Agent A (Requester)
import uuid

request_id = str(uuid.uuid4())
reply_topic = f"reply.{request_id}"

# Create reply topic
await bus.create_topic(reply_topic)

# Send request
await bus.produce("tasks.analyze", {
    "request_id": request_id,
    "reply_to": reply_topic,
    "payload": {"query": "What is quantum computing?"}
})

# Wait for reply
response = await bus.consume(reply_topic, timeout=30)
print(f"Got answer: {response['answer']}")
```

```python
# Agent B (Worker)
async def worker_loop():
    for msg in bus.subscribe("tasks.analyze"):
        request = msg["payload"]

        # Process
        answer = analyze(request["query"])

        # Reply
        await bus.produce(request["reply_to"], {
            "request_id": request["request_id"],
            "answer": answer
        })

        # Ack original
        await bus.ack(msg["id"])
```

**Pros:** Simple, decoupled
**Cons:** Topic proliferation (one per request)

---

## Pattern 2: Shared Response Topic with Filtering

All responses go to one topic, filtered by request_id.

```python
# Agent A
request_id = str(uuid.uuid4())

await bus.produce("tasks.analyze", {
    "request_id": request_id,
    "payload": {"query": "..."}
})

# Poll shared response topic
for msg in bus.subscribe("tasks.responses"):
    if msg["payload"].get("correlation_id") == request_id:
        print(f"Got my answer: {msg['payload']['answer']}")
        break
```

```python
# Agent B
for msg in bus.subscribe("tasks.analyze"):
    request = msg["payload"]
    answer = analyze(request["query"])

    await bus.produce("tasks.responses", {
        "correlation_id": request["request_id"],  # Link to original
        "answer": answer
    })

    await bus.ack(msg["id"])
```

**Pros:** Fixed topic count
**Cons:** Requester must filter through all responses

---

## Pattern 3: Stateful Conversation Context

Maintain conversation state, agents check their "inbox" periodically.

```python
class ConversationContext:
    """Stateful conversation between agents."""

    def __init__(self, conversation_id, bus):
        self.id = conversation_id
        self.bus = bus
        self.inbox_topic = f"conv.{conversation_id}"
        self.pending_requests = {}

    async def ask(self, agent_type, question, timeout=30):
        """Ask a question and wait for answer."""
        request_id = str(uuid.uuid4())

        # Send request
        await self.bus.produce(f"agents.{agent_type}.inbox", {
            "conversation_id": self.id,
            "request_id": request_id,
            "question": question,
            "reply_to": self.inbox_topic
        })

        # Wait for response
        start = time.time()
        for msg in self.bus.subscribe(self.inbox_topic):
            if time.time() - start > timeout:
                raise TimeoutError(f"No response from {agent_type}")

            if msg["payload"].get("request_id") == request_id:
                return msg["payload"]["answer"]

    async def reply(self, request_id, answer):
        """Reply to a specific request."""
        # Find original message to get reply_to
        # ... lookup logic ...
        await self.bus.produce(reply_to, {
            "request_id": request_id,
            "answer": answer
        })


# Usage
conv = ConversationContext("trip-planning-123", bus)

# Research agent asks writer for help
outline = await conv.ask("writer", "Create an outline about Tokyo")

# Writer asks researcher for facts
facts = await conv.ask("researcher", "Find top 10 Tokyo attractions")

# Continue conversation...
```

**Pros:** Natural conversation flow, maintained context
**Cons:** More complex, requires state management

---

## When to Reply? Agent Lifecycle Patterns

### Pattern A: Work Queue (No Reply)
Agent consumes tasks, produces results to different topic. No direct reply.
```
Agent A ──[task]──→ Topic ──[task]──→ Agent B ──[result]──→ ResultTopic

Agent A doesn't wait. It subscribes to ResultTopic separately.
```

### Pattern B: Synchronous Request-Response
Agent blocks waiting for reply.
```python
# Agent A
response = await call_agent_b(request)  # Blocks until reply
next_step(response)
```

### Pattern C: Asynchronous with Callback
Agent continues working, handles reply when ready.
```python
# Agent A
await request_from_agent_b(request, callback=handle_response)
continue_other_work()  # Non-blocking

async def handle_response(reply):
    # Called when Agent B replies
    process(reply)
```

### Pattern D: Choreography (Event-Driven)
No explicit replies. Agents react to events.
```
UserRequest → ResearchAgent → DraftReadyEvent → WriterAgent → EditNeededEvent → EditorAgent → PublishedEvent
```
Each agent produces event, next agent consumes. No waiting.

---

## Recommendation for BoxCrew

**Use Pattern 3 (Conversations) for complex multi-agent collaborations:**

```python
from boxcrew import conversation

async def plan_trip():
    conv = conversation.start("trip-planning")

    # Parallel requests
    hotel_task = conv.ask("researcher", "Find Tokyo hotels")
    flight_task = conv.ask("researcher", "Find flights to Tokyo")

    hotels = await hotel_task
    flights = await flight_task

    # Sequential dependent step
    itinerary = await conv.ask("planner", f"Create itinerary with {hotels} and {flights}")

    return itinerary
```

This gives you:
- Request/response semantics
- Timeout handling
- Parallel execution
- Conversation context
