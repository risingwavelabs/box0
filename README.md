# Box0

An agent platform for deploying and managing specialized AI workers.

Users say one thing, a group of specialized agents do their jobs, and results come back.

## Quick Start

### Build

```bash
cargo build --release
# Binary at: target/release/b0
```

### Single Machine Setup

```bash
# 1. Start server (prints admin key on first start)
b0 server
#   Admin key: b0_abc123...

# 2. Connect with admin key (from another terminal)
b0 login http://localhost:8080 --key b0_abc123...

# 3. Create a group and invite yourself
b0 group create my-team
b0 group invite my-team --description "me"
#   Key: b0_def456...

# 4. Login with group key
b0 login http://localhost:8080 --key b0_def456...

# 5. Add a worker and delegate
b0 worker add reviewer --instructions "Senior code reviewer. Focus on correctness."
b0 delegate reviewer "Review the file src/main.rs for correctness."
b0 wait
```

### Multi-Machine Setup

```bash
# Machine A: start server
b0 server --host 0.0.0.0 --port 8080

# Machine A: create group and keys
b0 login http://localhost:8080 --key <admin-key>
b0 group create dev-team
b0 group invite dev-team --description "node-b"

# Machine B: join as a worker node
b0 node join http://machine-a:8080 --name gpu-box --key <group-key>

# Machine A: add worker on the remote node
b0 login http://localhost:8080 --key <group-key>
b0 worker add ml-agent --instructions "ML specialist." --node gpu-box
b0 delegate ml-agent "Analyze this dataset."
b0 wait
```

## CLI Reference

### Connection

```
b0 login <server-url> --key <api-key>   Connect to server
b0 logout                                Disconnect
b0 skill install claude-code             Install skill for Claude Code
b0 skill install codex                   Install skill for Codex
b0 skill uninstall <agent>               Remove skill
b0 skill show                            Print skill content to stdout
b0 status                                Show connection, workers, pending tasks
```

### Server

```
b0 server [--host 127.0.0.1] [--port 8080] [--db ./b0.db]
```

On first start, generates and prints an admin key.

### Workers

```
b0 worker add <name> --instructions "..." [--node <node>]
b0 worker ls
b0 worker info <name>
b0 worker update <name> --instructions "..."
b0 worker stop <name>
b0 worker start <name>
b0 worker logs <name>
b0 worker remove <name>
b0 worker temp "<task>" [--instructions "..."]
```

### Delegation

```
b0 delegate <worker> "<task>"       Send task (non-blocking), prints thread-id
b0 delegate <worker>                Read task from stdin
b0 worker temp "<task>"             One-off task (non-blocking), auto-cleanup
b0 wait                             Block until all pending tasks complete
b0 reply <thread-id> "<message>"    Reply to a worker's question
```

### Nodes

```
b0 node join <server-url> [--name <name>] [--key <api-key>]
b0 node ls
```

### Groups & Keys

```
b0 group create <name>                          Create a group (admin only)
b0 group ls                                     List groups (admin only)
b0 group invite <group> [--description "..."]   Generate group key (admin only)
b0 group keys                                   List API keys
b0 group revoke <key-prefix>                    Revoke a key (admin only)
```

## Authentication

Server generates an admin key on first start. All endpoints require authentication.

- **Admin key** — server-level. Can create groups, invite members, manage nodes.
- **Group key** — scoped to one group. Can manage workers, delegate tasks, see only own group's resources.

Groups are fully isolated: workers, agents, and messages in one group are invisible to other groups.

## Architecture

```
Server
├── Admin key (server-level)
├── Group: frontend
│   ├── key: b0_abc... (alice)
│   ├── reviewer worker (local node)
│   └── doc-writer worker (local node)
├── Group: ml-team
│   ├── key: b0_def... (bob)
│   └── ml-agent worker (gpu-box node)
│
├── Node: local (auto-registered)
├── Node: gpu-box (via b0 node join)
└── Node: cpu-1 (via b0 node join)
```

Workers are ephemeral per-task. When a request arrives, the node daemon spawns a Claude Code CLI subprocess, runs the task, and sends the result back.

## How Workers Execute Tasks

Workers invoke `claude --print --output-format json --system-prompt "<instructions>"` with the task piped via stdin. They use the machine's existing authentication (OAuth or API key).

Multi-turn is supported: if a lead sends a `b0 reply`, the daemon resumes the Claude session with `--resume <session_id>`.

## Configuration

Server config via TOML file (`--config path`) or environment variables:
- `B0_HOST` — server bind address
- `B0_PORT` — server port
- `B0_DB_PATH` — SQLite database file path
- `B0_LOG_LEVEL` — log level (info, debug, etc.)

CLI config stored at `~/.b0/config.toml`:
- `server_url` — server address (overridable via `B0_SERVER_URL`)
- `lead_id` — auto-generated stable identity
- `api_key` — stored by `b0 login --key`

## License

Private. Copyright RisingWave Labs.
