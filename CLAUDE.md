# CLAUDE.md

This file is for Claude Code (or any AI agent) working on Stream0. Read this first.

## What is Stream0?

An agent communication layer. Every agent gets an inbox. Agents send messages to each other's inboxes, grouped by `thread_id`. Supports multi-turn conversations (request -> question -> answer -> done).

## Project structure

```
├── Cargo.toml        # Rust dependencies
├── src/
│   ├── main.rs       # Entry point, HTTP handlers, auth middleware
│   ├── db.rs         # SQLite operations, schema, models
│   └── config.rs     # YAML config + env var loading
├── sdk/python/       # Python SDK
│   ├── stream0/      # Package (client.py, exceptions.py)
│   └── tests/        # Unit + integration tests
└── docs/             # PRD
```

## Build and test

```bash
# Build
cargo build --release

# Run
./target/release/stream0                              # default config
./target/release/stream0 --config stream0.yaml        # custom config

# Test (Python SDK unit tests)
cd sdk/python && pip install -e ".[dev]" && pytest tests/test_client.py -v

# Integration tests (needs running server)
STREAM0_URL=http://localhost:8080 pytest tests/test_integration.py -v
```

## Key APIs

### Two-layer auth

- `X-API-Key` header for group-level operations (register/list/delete agents, view threads)
- `X-Agent-Token` header for agent-level operations (send/receive/ack messages)

Registration returns an `agent_token` in the response. The server derives sender identity from the agent token, so no `from` field is needed when sending messages.

### Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /agents` | `X-API-Key` | Register agent `{"id": "agent-name"}`. Returns `agent_token`. |
| `GET /agents` | `X-API-Key` | List all agents in this group |
| `DELETE /agents/{id}` | `X-API-Key` | Delete an agent |
| `POST /agents/{id}/inbox` | `X-Agent-Token` | Send message `{"thread_id", "type", "content"}` |
| `GET /agents/{id}/inbox?status=unread&thread_id=X&timeout=10` | `X-Agent-Token` | Poll inbox |
| `POST /inbox/messages/{id}/ack` | `X-Agent-Token` | Mark message as read |
| `GET /threads/{thread_id}/messages` | `X-API-Key` | Conversation history |

Message types: `request`, `question`, `answer`, `done`, `failed`, `message`

## Important technical details

- **Language**: Rust (axum + rusqlite + serde + tokio)
- **SQLite**: Uses `rusqlite` with `bundled` feature (compiles SQLite from source, no system dependency)
- **Config loading**: YAML parsed with serde_yaml. Env vars override only when set.
- **Auth**: Two-layer. `X-API-Key` for group-level ops, `X-Agent-Token` for agent-level ops. Constant-time comparison (`subtle` crate). Supports both flat `auth.api_keys` (all map to "default" group) and `auth.groups` (per-group key scoping).
- **Multi-group isolation**: Each API key maps to a group. Agents and messages are fully isolated between groups. Two teams can use the same Stream0 instance without seeing each other's data.
- **Agent tokens**: Generated at registration time (`atok-` prefix). The server resolves the token to the agent's identity, so the `from` field is not in the send request body.
- **Long-polling**: Inbox endpoints support long-polling with `timeout` param.
- **Timestamps**: Stored as ISO 8601 strings in SQLite, parsed with chrono.
- **Agent aliases**: The `agent_aliases` table maps alternate names to canonical agent IDs. Messages sent to an alias are delivered to the canonical inbox.
- **Presence**: `last_seen` is updated on the agents row each time an agent polls their inbox.
- **Webhooks**: Agents can register a `webhook` URL at registration time. On message delivery, Stream0 fires an async HTTP POST notification to the URL using reqwest with a 10-second timeout. Fire-and-forget -- failures don't affect message storage.

## Deployment

- **EC2**: Build on instance with `cargo build --release`, systemd service at `/etc/systemd/system/stream0.service`
- **Config**: `/etc/stream0/stream0.yaml`
- **Data**: `/var/lib/stream0/stream0.db`
- **API keys**: Only in config file on server, never in code or chat

## Common tasks

### Add a new endpoint

1. Add handler function in `src/main.rs`
2. Register route in the `Router` setup in `main()` -- choose the correct auth layer (`group_routes` for X-API-Key, `agent_routes` for X-Agent-Token)
3. Add database method in `src/db.rs` if needed
4. Update Python SDK in `sdk/python/stream0/client.py`
5. Add Python tests in `sdk/python/tests/test_client.py`

### Deploy an update

```bash
# Upload source to EC2
scp Cargo.toml ubuntu@<IP>:/tmp/stream0-rust/
scp src/*.rs ubuntu@<IP>:/tmp/stream0-rust/src/

# SSH in and build
ssh ubuntu@<IP>
source ~/.cargo/env
cd /tmp/stream0-rust && cargo build --release

# Deploy
sudo systemctl stop stream0
sudo cp target/release/stream0 /usr/local/bin/stream0
sudo systemctl start stream0
```

## Documentation rule

Every time you make major changes, develop new features, or do major refactors, you **must** update the relevant docs and push them to the GitHub repo in the same commit or immediately after. This includes:

- **README.md** -- if the API surface changes or new features are added
- **CLAUDE.md** -- if build steps, project structure, or technical details change
- **STREAM0_SKILL.md** -- if endpoints or usage patterns change (this is what other agents read)
- **sdk/python/README.md** -- if the Python SDK changes
- **SELF_HOSTING.md** -- if deployment steps change

Do not ship code without shipping docs.

## Do not

- Do not commit API keys or secrets
- Do not use Go -- the project has been rewritten in Rust
