# Boxhouse Manual Testing Guide

## Prerequisites

- Rust toolchain installed
- Claude Code CLI installed and authenticated (run `claude --version` to verify)
- For multi-machine tests: two machines that can reach each other over the network

Build first:

```bash
cd boxhouse
cargo build --release
export PATH="$PWD/target/release:$PATH"
```

Verify:

```bash
bh --version
bh --help
```

---

## Test 1: Single Machine — Basic Flow

**Goal**: Verify the core loop works: server → worker → delegate → wait.

### Steps

Terminal 1 — start server:
```bash
bh server
```

Expected output:
```
INFO bh::daemon: Node daemon started (local)
INFO bh::server: Boxhouse server starting address=127.0.0.1:8080
```

Terminal 2 — use CLI:
```bash
# 1. Login
bh login http://localhost:8080
# Expected: "Connected to Boxhouse server v0.1.0"
# Expected: "Claude Code skill installed."
# Expected: "Login complete. Server: http://localhost:8080"

# 2. Verify skill file was created
cat ~/.claude/skills/bh.md | head -5
# Expected: YAML frontmatter with name: boxhouse

# 3. Verify config was created
cat ~/.bh/config.toml
# Expected: server_url and lead_id

# 4. Check status
bh status
# Expected: connected, 1 node (local), 0 workers, no pending tasks

# 5. Add a worker
bh worker add reviewer --instructions "You are a code reviewer. Be concise — max 2 sentences."

# 6. List workers
bh worker ls
# Expected: reviewer, local, active

# 7. Delegate a task
bh delegate reviewer "What are the benefits of Rust's ownership model?"
# Expected: prints a thread-id like "thread-abc12345"

# 8. Wait for result
bh wait
# Expected: blocks for a few seconds, then:
# "reviewer done (Xs): <response about ownership>"
# "All done."

# 9. Remove worker
bh worker remove reviewer
bh worker ls
# Expected: "No workers registered."

# 10. Logout
bh logout
# Expected: "Logged out."
ls ~/.claude/skills/bh.md
# Expected: file not found
cat ~/.bh/config.toml
# Expected: file not found
```

### What to Check

- [ ] Server starts without errors
- [ ] `bh login` installs skill and saves config
- [ ] `bh worker add` registers successfully
- [ ] `bh delegate` returns a thread-id immediately (non-blocking)
- [ ] `bh wait` blocks and eventually prints the worker's response
- [ ] Response is coherent (Claude actually processed the task)
- [ ] `bh worker remove` cleans up
- [ ] `bh logout` removes skill and config
- [ ] Server terminal shows "Processing task" and "Task completed" log lines

---

## Test 2: Single Machine — Worker Temp

**Goal**: Verify one-off temp workers work end-to-end.

```bash
# Server should be running from Test 1. If not:
bh server &
bh login http://localhost:8080

# Run a temp task
bh worker temp "What is the capital of France? One word only."
# Expected: blocks, then "done (Xs): Paris"

# Verify the temp worker was cleaned up
bh worker ls
# Expected: "No workers registered." (temp worker auto-removed)
```

### What to Check

- [ ] `bh worker temp` blocks until result
- [ ] Result is correct
- [ ] No leftover temp workers after completion

---

## Test 3: Single Machine — Parallel Delegation

**Goal**: Verify multiple tasks can be delegated and collected.

```bash
bh worker add fast --instructions "Answer in exactly one word."
bh worker add slow --instructions "Answer in exactly one sentence."

# Delegate two tasks
bh delegate fast "Capital of Japan?"
bh delegate slow "Explain quantum entanglement."

# Check pending
bh status
# Expected: 2 pending tasks

# Wait for both
bh wait
# Expected: both results arrive (possibly in different order)
# "fast done (Xs): Tokyo"
# "slow done (Xs): <sentence about quantum entanglement>"
# "All done."

# Cleanup
bh worker remove fast
bh worker remove slow
```

### What to Check

- [ ] Both tasks delegated without blocking
- [ ] `bh status` shows 2 pending tasks
- [ ] `bh wait` collects both results
- [ ] Both responses are correct
- [ ] "All done." printed after both complete

---

## Test 4: Single Machine — Auth / Team

**Goal**: Verify API key auth works.

```bash
# Start with no auth (server should be running)
bh login http://localhost:8080

# Create first API key — this enables auth
bh team invite --description "admin"
# Expected: prints the full key (bh_...) and prefix
# SAVE THE KEY — you'll need it

# Try a command without the key
bh logout
bh login http://localhost:8080
bh worker ls
# Expected: "Error: missing X-API-Key header"

# Login with the key
bh login http://localhost:8080 --key <THE_KEY>
bh worker ls
# Expected: "No workers registered." (auth passes)

# Create a second key
bh team invite --description "ci-bot"

# List keys
bh team ls
# Expected: 2 keys with prefixes and descriptions

# Revoke the second key
bh team revoke <second-key-prefix>
bh team ls
# Expected: 1 key remaining
```

### What to Check

- [ ] No auth required before any keys exist
- [ ] After first key: all protected endpoints require `X-API-Key`
- [ ] `/health` still works without auth (public endpoint)
- [ ] `bh login --key` stores key, subsequent commands pass auth
- [ ] `bh team invite` generates unique keys
- [ ] `bh team revoke` invalidates the key
- [ ] Invalid/revoked keys are rejected with 401

---

## Test 5: Single Machine — Worker with File Access

**Goal**: Verify workers can use Claude Code's tools (read files, run commands).

```bash
bh worker add code-reader --instructions "You are a code assistant. When asked about a file, read it and summarize. Be concise."

# Task that requires reading a file
bh delegate code-reader "Read the file $(pwd)/Cargo.toml and list the dependencies."
bh wait
# Expected: worker reads Cargo.toml and lists dependencies (tokio, axum, etc.)

# Task that requires running a command
bh worker add cmd-runner --instructions "You are a system helper. Run commands when asked. Be concise."
bh delegate cmd-runner "How many .rs files are in $(pwd)/src/? Use the glob tool to count."
bh wait
# Expected: "6" or similar accurate count

bh worker remove code-reader
bh worker remove cmd-runner
```

### What to Check

- [ ] Worker can read files on the machine
- [ ] Worker can use tools (Glob, Grep, Bash, etc.)
- [ ] Results are accurate (correct file content / count)

---

## Test 6: Multi-Machine — Remote Node

**Goal**: Verify a remote machine can join as a worker node and execute tasks.

### Prerequisites

- Machine A (server): has Boxhouse built, reachable at `<MACHINE_A_IP>:8080`
- Machine B (node): has Boxhouse built, has Claude Code CLI installed and authenticated

### Steps

Machine A — start server:
```bash
# Bind to 0.0.0.0 so remote machines can connect
bh server --host 0.0.0.0 --port 8080
```

Machine A — login (from another terminal):
```bash
bh login http://localhost:8080
```

Machine B — join as a node:
```bash
bh node join http://<MACHINE_A_IP>:8080 --name machine-b
# Expected: "Joining as node "machine-b" → http://<MACHINE_A_IP>:8080"
# Expected: "Node daemon started (remote)"
# This process stays running (it's the daemon)
```

Machine A — verify node registered:
```bash
bh node ls
# Expected:
# NAME                 STATUS     LAST HEARTBEAT
# local                online     <timestamp>
# machine-b            online     <timestamp>
```

Machine A — add worker on remote node:
```bash
bh worker add remote-reviewer --instructions "You are a reviewer. Be brief." --node machine-b
bh worker ls
# Expected:
# NAME                 NODE       STATUS     CREATED
# remote-reviewer      machine-b  active     <timestamp>
```

Machine A — delegate and wait:
```bash
bh delegate remote-reviewer "Is Python or Go better for web servers? One sentence."
bh wait
# Expected: result comes back from machine-b
```

### What to Check

- [ ] `bh node join` connects to remote server successfully
- [ ] Node appears in `bh node ls` with "online" status
- [ ] Worker assigned to remote node appears in `bh worker ls`
- [ ] Delegation works: task is sent to server, remote daemon picks it up
- [ ] Result comes back to the lead on machine A
- [ ] Machine B's daemon shows "Processing task" / "Task completed" logs
- [ ] The Claude CLI on machine B uses machine B's authentication (not machine A's)

### Troubleshooting

If `bh node join` can't connect:
- Check firewall: machine A port 8080 must be open
- Check `--host 0.0.0.0` on machine A (not the default 127.0.0.1)
- Try `curl http://<MACHINE_A_IP>:8080/health` from machine B

If tasks aren't being picked up:
- Check machine B terminal for daemon logs
- Verify worker is assigned to the correct node: `bh worker ls`
- Check Claude CLI is installed on machine B: `claude --version`

---

## Test 7: Multi-Machine — With Auth

**Goal**: Verify remote nodes work when auth is enabled.

Machine A:
```bash
bh server --host 0.0.0.0 --port 8080
# In another terminal:
bh login http://localhost:8080
bh team invite --description "node-b-key"
# Save the key
```

Machine B:
```bash
bh node join http://<MACHINE_A_IP>:8080 --name machine-b --key <THE_KEY>
```

Machine A:
```bash
bh login http://localhost:8080 --key <THE_KEY>
bh node ls
# Expected: machine-b shows up
bh worker add test-worker --instructions "Echo the task back." --node machine-b
bh delegate test-worker "Hello from machine A"
bh wait
```

### What to Check

- [ ] Remote node can authenticate with API key
- [ ] Tasks are processed correctly with auth enabled
- [ ] Without `--key`, remote node gets rejected (401)

---

## Test 8: Multi-Machine — Mixed Nodes

**Goal**: Verify workers on different nodes can be used in parallel.

Machine A (server + local node):
```bash
bh server --host 0.0.0.0
bh login http://localhost:8080
bh worker add local-worker --instructions "Answer briefly." --node local
```

Machine B (remote node):
```bash
bh node join http://<MACHINE_A_IP>:8080 --name machine-b
```

Machine A:
```bash
bh worker add remote-worker --instructions "Answer briefly." --node machine-b

# Delegate to both in parallel
bh delegate local-worker "What is 2+2?"
bh delegate remote-worker "What is 3+3?"
bh wait
# Expected: both results arrive
# local-worker done: 4
# remote-worker done: 6
```

### What to Check

- [ ] Workers on different nodes execute independently
- [ ] Both results collected by `bh wait`
- [ ] Each worker runs on its assigned node (check logs on each machine)

---

## Test 9: Edge Cases

```bash
# Delegate to nonexistent worker
bh delegate nonexistent "hello"
# Expected: error message, not a crash

# Wait with no pending tasks
bh wait
# Expected: "No pending tasks."

# Remove nonexistent worker
bh worker remove nonexistent
# Expected: error message

# Double login
bh login http://localhost:8080
bh login http://localhost:8080
# Expected: works fine (idempotent)

# Server not running
bh server &  # start then kill it
kill %1
bh delegate reviewer "hello"
# Expected: connection error message
```

---

## Cleanup

After testing:

```bash
# Stop server (Ctrl+C in server terminal)
# Stop remote daemons (Ctrl+C)

# Remove local state
rm -rf ~/.bh/
rm -f ~/.claude/skills/bh.md

# Remove test databases
rm -f bh.db
```
