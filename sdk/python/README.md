# Stream0 Python SDK

Python client for [Stream0](https://github.com/risingwavelabs/stream0) -- the communication layer for AI agents.

## Install

```bash
pip install -e .
```

## Usage

### Agent class (recommended)

```python
from stream0 import Agent

# Create and register an agent (register returns agent_token, stored automatically)
agent = Agent("my-agent", url="http://localhost:8080", api_key="your-key")
agent.register()

# Send a message to another agent (sender identity from agent token)
agent.send("other-agent", thread_id="task-1", msg_type="request",
           content={"instruction": "do something"})

# Read inbox
messages = agent.receive()                    # all unread
messages = agent.receive(thread_id="task-1")  # filter by task
messages = agent.receive(timeout=10)          # long-poll up to 10s

# Acknowledge a message
agent.ack(messages[0]["id"])

# Get full conversation history
history = agent.history("task-1")
```

### Full conversation example

```python
from stream0 import Agent

main = Agent("main-agent", url="http://localhost:8080", api_key="your-key")
worker = Agent("worker", url="http://localhost:8080", api_key="your-key")

main.register()    # registers and stores agent_token
worker.register()  # registers and stores agent_token

# Main sends task
main.send("worker", thread_id="t1", msg_type="request",
          content={"instruction": "translate this contract"})

# Worker picks up
msgs = worker.receive(thread_id="t1")
worker.ack(msgs[0]["id"])

# Worker asks a question
worker.send("main-agent", thread_id="t1", msg_type="question",
            content={"q": "Use term A or B?"})

# Main answers
msgs = main.receive(thread_id="t1")
main.ack(msgs[0]["id"])
main.send("worker", thread_id="t1", msg_type="answer",
          content={"a": "use B"})

# Worker completes
msgs = worker.receive(thread_id="t1")
worker.ack(msgs[0]["id"])
worker.send("main-agent", thread_id="t1", msg_type="done",
            content={"result": "translated document"})

# View full conversation
history = main.history("t1")
# [request, question, answer, done]
```

### Low-level client

For direct API access without a fixed agent identity:

```python
from stream0 import Stream0Client

client = Stream0Client("http://localhost:8080", api_key="your-key")

# Register an agent (returns dict with agent_token)
result = client.register_agent("my-agent")
agent_token = result["agent_token"]

# Create a new client with the agent token for message operations
agent_client = Stream0Client("http://localhost:8080", api_key="your-key", agent_token=agent_token)

# Send a message (sender identity from agent token, no from_agent needed)
agent_client.send("target-agent", "task-1", "request", {"data": "hello"})

# Receive messages
messages = agent_client.receive("my-agent", status="unread")

# Acknowledge
agent_client.ack_inbox(messages[0]["id"])

# Thread history (uses X-API-Key)
history = client.get_thread_messages("task-1")
```

## Message types

| Type | Use |
|------|-----|
| `request` | Start a task |
| `question` | Ask for clarification mid-task |
| `answer` | Respond to a question |
| `done` | Task completed |
| `failed` | Task failed |
| `message` | General-purpose message |

## Error handling

```python
from stream0 import Agent, NotFoundError, AuthenticationError, TimeoutError

agent = Agent("my-agent", url="http://localhost:8080", api_key="your-key")
agent.register()

try:
    agent.send("ghost", thread_id="t1", msg_type="request")
except NotFoundError:
    print("Agent not registered")
except AuthenticationError:
    print("Bad API key or agent token")
```

## Testing

```bash
pip install -e ".[dev]"

# Unit tests (mocked HTTP)
pytest tests/test_client.py -v

# Integration tests (requires running stream0 server)
STREAM0_URL=http://localhost:8080 pytest tests/test_integration.py -v
```
