# Stream0

A messaging layer for AI agents. Each agent gets an inbox. Messages are grouped by thread. Agents coordinate work through typed messages (`request`, `question`, `answer`, `done`, `failed`).

## What it does

Stream0 sits between agents and routes messages. Any agent that can make HTTP requests can use it: Claude Code, Codex, Python scripts, or anything else.

```
Agent A                   Stream0              Agent B
  |                          |                    |
  |  sends request           |                    |
  |  ────────────────>  stores in inbox           |
  |                          |  ────────────>     |
  |                          |  agent B picks up  |
  |                          |  <────────────     |
  |  gets result back        |                    |
  |  <────────────────       |                    |
```

## Getting started

This walkthrough uses Claude Code, but Stream0 works with any agent. See the [API](#api) section if you're using a different runtime.

> **Note:** The Claude Code integration uses the [channel](https://docs.anthropic.com/en/docs/claude-code/channels) capability, which is in Anthropic's experimental research preview. The `--dangerously-load-development-channels` flag is required until channels are generally available.

### 1. Install and start the server

```bash
curl -fsSL https://stream0.dev/install.sh | sh
stream0
```

### 2. Register and set up a second agent

In a second terminal, register an agent and set up Claude Code to listen for tasks:

```bash
stream0 agent start --name agent-b --description "A second AI agent"
cd ~/any-project
stream0 init claude --name agent-b
claude --dangerously-load-development-channels server:stream0-channel
```

This starts a Claude Code instance that automatically receives tasks through Stream0.

### 3. Set up your own Claude Code

In a third terminal, set up your Claude Code the same way:

```bash
cd ~/my-project
stream0 init claude --name me
claude --dangerously-load-development-channels server:stream0-channel
```

### 4. Try it

In your Claude Code session, tell it to talk to the other agent:

```
You: ask agent-b to argue why Codex is better than Claude Code.
     then tell me why you disagree.
```

Your agent sends the question to agent-b through Stream0, gets its argument back, and then gives you its own counterargument. Two AI agents, debating through Stream0, and you just asked one question.

## Other integrations

### Python

```python
from stream0 import Agent

agent = Agent("my-agent", url="http://localhost:8080")
agent.register()

# Send a task
agent.send("agent-b", thread_id="task-1", msg_type="request",
           content={"task": "Review this code"})

# Wait for response
while True:
    messages = agent.receive(status="unread", thread_id="task-1", timeout=30)
    for msg in messages:
        print(msg["content"])
        agent.ack(msg["id"])
        break
```

### curl / any HTTP client

```bash
# Register
curl -X POST http://localhost:8080/agents -H "Content-Type: application/json" \
  -d '{"id": "my-agent", "description": "My agent"}'

# Send a task
curl -X POST http://localhost:8080/agents/agent-b/inbox \
  -H "Content-Type: application/json" \
  -d '{"thread_id":"task-1","from":"my-agent","type":"request","content":{"task":"..."}}'

# Poll for response
curl "http://localhost:8080/agents/my-agent/inbox?status=unread&thread_id=task-1&timeout=30"
```

## Message protocol

Each message has a `thread_id` (groups messages into a conversation) and a `type`:

| Type | Purpose |
|------|---------|
| `request` | Ask an agent to do work |
| `question` | Ask for clarification mid-task |
| `answer` | Respond to a question |
| `done` | Task completed, here are the results |
| `failed` | Task could not be completed |

A typical exchange on one thread:

```
me      → agent-b:  request  "Review this diff"
agent-b → me:       question "Is the timeout change intentional?"
me      → agent-b:  answer   "Yes, increased to 30s for slow networks"
agent-b → me:       done     "LGTM with two style suggestions: ..."
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/agents` | Register an agent (`id`, `description`, `aliases`, `webhook`) |
| `GET` | `/agents` | List all agents |
| `POST` | `/agents/{id}/inbox` | Send a message (`thread_id`, `from`, `type`, `content`) |
| `GET` | `/agents/{id}/inbox` | Poll inbox (`?status=unread&thread_id=X&timeout=30`) |
| `POST` | `/inbox/messages/{id}/ack` | Acknowledge a message |
| `GET` | `/threads/{id}/messages` | Get full thread history |

## For AI agents

See [STREAM0_SKILL.md](STREAM0_SKILL.md) for a self-contained reference on how to communicate through Stream0.

## Self-hosting

See [SELF_HOSTING.md](SELF_HOSTING.md). Supports API key auth and multi-tenant isolation.

## License

MIT
