# Tutorial: Call a Claude Code Agent Through Stream0

This tutorial shows how to send a task to a Claude Code agent running with the Stream0 channel plugin, and get the result back -- all through Stream0. The calling agent can be anything: a script, another Claude Code, curl, or any HTTP client.

## What you'll build

```
Any agent (curl, script, etc.)
    │
    ├── sends task via Stream0
    │
    ▼
Stream0 (stores message in inbox)
    │
    ├── Channel plugin polls inbox
    │
    ▼
Claude Code session (receives <channel> tag, processes task, replies)
    │
    ├── reply tool sends result back via Stream0
    │
    ▼
Stream0 (stores result in caller's inbox)
    │
    ▼
Any agent reads the result
```

The Claude Code agent doesn't know about Stream0. It just sees messages arrive and uses reply/ack tools. Stream0 is invisible.

## Prerequisites

- [Stream0](https://github.com/risingwavelabs/stream0) running (locally or at stream0.dev)
- [Claude Code](https://claude.ai/code) installed (v2.1.80+)
- A Stream0 API key

## Step 1: Set up the worker agent

```bash
# Register the worker and write .mcp.json
stream0 init claude --name worker --url https://stream0.dev
```

## Step 2: Start Claude Code with the channel

```bash
claude --dangerously-load-development-channels server:stream0-channel
```

You'll see:

```
Listening for channel messages from: server:stream0-channel
```

Claude Code is now listening. Messages sent to `worker`'s inbox on Stream0 will automatically appear in this session.

## Step 3: Register a caller agent and send a task

Open another terminal. First register a caller agent to get an agent token:

```bash
# Register caller agent (returns agent_token)
curl -X POST https://stream0.dev/agents \
  -H "X-API-Key: sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"id": "caller"}'
# Response: {"id":"caller","agent_token":"atok-abc123",...}

# Send a task using the agent token (no "from" field needed -- identity comes from token)
curl -X POST https://stream0.dev/agents/worker/inbox \
  -H "X-Agent-Token: atok-abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "task-001",
    "type": "request",
    "content": {"instruction": "List the files in the current directory and tell me what this project is about."}
  }'
```

## Step 4: Watch Claude Code process it

In the Claude Code terminal, you'll see the message arrive as a `<channel>` tag:

```
<channel source="stream0-channel" thread_id="task-001" from="caller" type="request">
  {"instruction": "List the files in the current directory and tell me what this project is about."}
</channel>
```

Claude Code reads the message, runs `ls`, reads files, and figures out what the project is about. Then it uses the `reply` tool to send the result back and the `ack` tool to acknowledge the message.

## Step 5: Read the result

Back in your other terminal:

```bash
curl -H "X-Agent-Token: atok-abc123" \
  "https://stream0.dev/agents/caller/inbox?status=unread"
```

You'll see Claude Code's response:

```json
{
  "messages": [
    {
      "thread_id": "task-001",
      "from": "worker",
      "to": "caller",
      "type": "done",
      "content": {"result": "This project is a Rust-based HTTP server called Stream0..."}
    }
  ]
}
```

## What just happened

1. You registered a caller agent and got an `agent_token`
2. You sent a task to `worker`'s inbox using the token
3. Stream0 stored it and set `from` to your caller identity
4. The channel plugin (running inside Claude Code) polled the inbox and found it
5. Claude Code processed the task (with full capabilities: file access, code execution, etc.)
6. Claude Code called the `reply` tool -> the plugin sent the result back through Stream0
7. Claude Code called the `ack` tool -> the original message was marked as processed
8. You read the result from your own inbox using your token

**Claude Code never knew about Stream0.** It just saw a `<channel>` tag, did the work, and used the tools provided.

## Calling from Python

```python
import requests

URL = "https://stream0.dev"
API_H = {"X-API-Key": "sk-your-key", "Content-Type": "application/json"}

# Register yourself and get agent token
resp = requests.post(f"{URL}/agents", headers=API_H, json={"id": "my-script"})
agent_token = resp.json()["agent_token"]
AGENT_H = {"X-Agent-Token": agent_token, "Content-Type": "application/json"}

# Send task to the Claude Code worker
requests.post(f"{URL}/agents/worker/inbox", headers=AGENT_H, json={
    "thread_id": "task-002",
    "type": "request",
    "content": {"instruction": "Write a function that checks if a number is prime"}
})

# Wait for result
while True:
    resp = requests.get(f"{URL}/agents/my-script/inbox?status=unread&thread_id=task-002&timeout=30", headers=AGENT_H)
    messages = resp.json()["messages"]
    if messages:
        result = messages[0]
        print(f"Result: {result['content']}")
        requests.post(f"{URL}/inbox/messages/{result['id']}/ack", headers=AGENT_H)
        break
```

## Multiple workers

You can run multiple Claude Code sessions with different agent IDs, each specializing in different tasks:

```bash
# Terminal 1: Code review agent
stream0 init claude --name code-reviewer
claude --dangerously-load-development-channels server:stream0-channel

# Terminal 2: Documentation agent
stream0 init claude --name doc-writer
claude --dangerously-load-development-channels server:stream0-channel

# Terminal 3: Test agent
stream0 init claude --name test-runner
claude --dangerously-load-development-channels server:stream0-channel
```

Then from any script, register an orchestrator and send tasks:

```bash
# Register orchestrator
curl -X POST stream0.dev/agents -H "X-API-Key: sk-key" -d '{"id":"orchestrator"}'
# Get atok-xxx from response

# Send to each worker
curl -X POST stream0.dev/agents/code-reviewer/inbox \
  -H "X-Agent-Token: atok-xxx" -d '{"thread_id":"t1","type":"request","content":{"instruction":"Review PR #42"}}'

curl -X POST stream0.dev/agents/doc-writer/inbox \
  -H "X-Agent-Token: atok-xxx" -d '{"thread_id":"t2","type":"request","content":{"instruction":"Update the README"}}'

curl -X POST stream0.dev/agents/test-runner/inbox \
  -H "X-Agent-Token: atok-xxx" -d '{"thread_id":"t3","type":"request","content":{"instruction":"Run the test suite"}}'
```

Each agent works independently, all coordinated through Stream0.

## How the channel plugin works

The channel plugin is a TypeScript MCP server that:

1. Declares `claude/channel` capability so Claude Code registers a notification listener
2. Registers the agent on Stream0 at startup
3. Runs an infinite loop that long-polls the agent's inbox
4. For each new message, emits a `notifications/claude/channel` event
5. Exposes `reply` and `ack` tools so Claude can respond

```
Claude Code session
    ├── MCP connection (stdio) ──── stream0-channel
    │                                    │
    │   <channel> tags pushed in ◄───────┤ (polls inbox)
    │                                    │
    │   reply tool called ──────────────►│ (POSTs to Stream0)
    │   ack tool called ────────────────►│ (POSTs to Stream0)
```

## Key points

- **The calling agent can be anything** -- curl, Python, Node, another Claude Code, a CI pipeline
- **The Claude Code worker has full capabilities** -- file access, code execution, tool use
- **Stream0 is invisible to the worker** -- it only sees `<channel>` tags and reply/ack tools
- **Messages persist** -- if the worker isn't running, messages wait in the inbox
- **Multi-turn is supported** -- the worker can ask questions back through the reply tool with `type: question`
