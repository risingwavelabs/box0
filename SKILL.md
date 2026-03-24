---
name: b0-onboarding
description: Install and configure Box0 multi-agent platform
---

# Box0 Agent Onboarding

You are setting up Box0, a multi-agent platform that lets you run AI agents in parallel across machines.

## Step 1: Check if Box0 is already installed

```bash
b0 --version
```

If this succeeds, skip to Step 3.

## Step 2: Install Box0

```bash
npm install -g @box0/cli@latest
```

Verify:

```bash
b0 --version
```

If npm is not available, build from source:

```bash
git clone https://github.com/risingwavelabs/box0.git
cd box0 && cargo build --release
export PATH="$PWD/target/release:$PATH"
```

## Step 3: Check if server is running

```bash
b0 status
```

If this shows connection info, the server is already running. Skip to Step 5.

## Step 4: Start the server

```bash
b0 server
```

This must run in a separate terminal or background process. On first start, Box0 creates an admin account and auto-configures `~/.b0/config.toml`.

After starting, verify:

```bash
b0 status
```

## Step 5: Install the skill

Detect which agent runtime is available and install the corresponding skill:

```bash
which claude && b0 skill install claude-code
which codex && b0 skill install codex
```

On Windows, use `where` instead of `which`.

## Step 6: Verify

```bash
b0 agent ls
```

This should return a list (possibly empty) without errors. Box0 is ready.

## Definition of Done

All of these must be true:
- [ ] `b0 --version` returns a version number
- [ ] `b0 status` shows a connected server
- [ ] Skill is installed for at least one agent runtime (Claude Code or Codex)
- [ ] `b0 agent ls` runs without errors

Tell the user: "Box0 is installed and ready. You can now delegate tasks to agents. Try asking me to create some agents and run a task in parallel."

## What Box0 does

After setup, you can:

- **Delegate tasks**: `b0 delegate <agent> "<task>"` sends a task to an agent (non-blocking)
- **Run in parallel**: delegate to multiple agents, then `b0 wait --all`
- **Multi-turn**: `b0 delegate --thread <id> <agent> "<follow-up>"`
- **Cron jobs**: `b0 cron add --every 6h "<task>"`
- **Temp agents**: `b0 agent temp "<task>"` for one-off tasks
- **Pipe content**: `git diff | b0 delegate reviewer "Review this diff."`

Full command reference: https://github.com/risingwavelabs/box0/blob/main/docs/cli.md
