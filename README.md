# Boxhouse

An agent platform for deploying and managing specialized AI workers.

Users say one thing, a group of specialized agents do their jobs, and results come back.

## Quick Start

### Build

```bash
cargo build --release
# Binary at: target/release/bh
```

### Single Machine Setup

```bash
# 1. Start server
bh server

# 2. Connect (from another terminal)
bh login http://localhost:8080

# 3. Add a worker
bh worker add reviewer --instructions "Senior code reviewer. Focus on correctness and edge cases. Cite line numbers."

# 4. Delegate work
bh delegate reviewer "Review the file src/main.rs for correctness."
# → prints thread-id

# 5. Wait for results
bh wait
# → blocks until worker completes, prints result
```

### Multi-Machine Setup

```bash
# Machine A: start server
bh server --port 8080

# Machine B: join as a worker node
bh node join http://machine-a:8080 --name gpu-box

# From anywhere: add worker on the remote node
bh login http://machine-a:8080
bh worker add ml-agent --instructions "ML specialist." --node gpu-box
bh delegate ml-agent "Analyze this dataset."
bh wait
```

## CLI Reference

### Connection

```
bh login <server-url> [--key <api-key>]    Connect to server, install Claude Code skill
bh logout                                   Disconnect, remove skill
bh status                                   Show connection, workers, pending tasks
```

### Server

```
bh server [--host 127.0.0.1] [--port 8080] [--db ./bh.db]
```

### Workers

```
bh worker add <name> --instructions "..." [--node <node>]
bh worker ls
bh worker remove <name>
bh worker temp "<task>" [--instructions "..."]
```

### Delegation

```
bh delegate <worker> "<task>"     Send task (non-blocking), prints thread-id
bh wait                           Block until all pending tasks complete
bh reply <thread-id> "<message>"  Reply to a worker's question
```

### Nodes

```
bh node join <server-url> [--name <name>] [--key <api-key>]
bh node ls
```

### Team

```
bh team invite [--description "..."]    Generate API key
bh team ls                              List keys (prefix only)
bh team revoke <key-prefix>             Revoke a key
```

Auth is disabled by default. Creating the first API key enables auth on all protected endpoints.

## Architecture

```
User's laptop
└── Claude Code (lead)
         │  uses bh CLI via bash
         ▼
   Boxhouse Server (control plane)
   ├── HTTP API (Axum)
   ├── SQLite database
   ├── Node daemon (local)
   │   ├── reviewer
   │   └── doc-writer
   │
   ├── Node: gpu-box (remote, via bh node join)
   │   └── ml-agent
   │
   └── Node: cpu-1 (remote)
       ├── security
       └── test-runner
```

Workers are ephemeral per-task. When a request arrives, the node daemon spawns a Claude Code CLI subprocess, runs the task, and sends the result back.

## Worker Types

**Full-time workers** — named, persistent roles:
```bash
bh worker add reviewer --instructions "Focus on correctness and edge cases."
```

**Temp workers** — one-off tasks:
```bash
bh worker temp "Look up AWS GPU pricing and summarize options."
```

## How Workers Execute Tasks

Workers invoke `claude --print --output-format json --system-prompt "<instructions>"` with the task piped via stdin. They use the machine's existing authentication (OAuth or API key).

Multi-turn is supported: if a lead sends a `bh reply`, the daemon resumes the Claude session with `--resume <session_id>`.

## Configuration

Server config via TOML file (`--config path`) or environment variables:
- `BH_HOST` — server bind address
- `BH_PORT` — server port
- `BH_DB_PATH` — SQLite database file path
- `BH_LOG_LEVEL` — log level (info, debug, etc.)

CLI config stored at `~/.bh/config.toml`:
- `server_url` — server address (overridable via `BH_SERVER_URL`)
- `lead_id` — auto-generated stable identity
- `api_key` — stored by `bh login --key`

## License

Private. Copyright RisingWave Labs.
