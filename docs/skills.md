# Skills

Skills teach your AI agent (Claude Code or Codex) how to use Box0. After installing a skill, your agent knows how to create agents, delegate tasks, and collect results without any manual instruction.

## Install

```bash
b0 skill install claude-code
b0 skill install codex
```

Pick one or both, depending on which agent you use. You only need to do this once per machine.

## What happens

- **Claude Code**: writes `~/.claude/skills/b0/SKILL.md`. Claude Code automatically reads skill files and learns the workflow.
- **Codex**: appends a marked section to `~/.codex/AGENTS.md`. Codex reads this file for agent instructions.

## What the skill teaches

The skill gives your agent these capabilities:

**Discover agents.** Run `b0 agent ls` to see available agents and match them to the task by description.

**Delegate tasks.** Compose detailed prompts and send them to agents:

```bash
b0 delegate reviewer "Review the changes on branch feature-timeout.
Focus on correctness, edge cases, and error handling.
Cite line numbers for any issues found."
```

**Run tasks in parallel.** Delegate to multiple agents, then wait for all results:

```bash
b0 delegate reviewer "Review the diff for correctness."
b0 delegate security "Check for OWASP top 10 vulnerabilities."
b0 delegate doc-writer "Update README for the new config option."
b0 wait --all
```

**Pipe content.** For large diffs or file contents, pipe via stdin:

```bash
git diff main..HEAD | b0 delegate reviewer "Review this diff."
```

**Handle questions.** If an agent asks a clarifying question during `b0 wait`, answer it and continue:

```bash
b0 reply <thread-id> "Yes, the timeout change is intentional."
b0 wait
```

**Continue conversations.** Multi-turn interactions with the same agent:

```bash
b0 delegate --thread <thread-id> researcher "Now compare with DynamoDB too."
b0 wait
```

**Schedule recurring tasks.**

```bash
b0 cron add --every 6h "Check production logs for errors."
```

**Proactive status checks.** The skill instructs the agent to run `b0 status` before responding to new messages, so completed results are reported automatically.

## View skill content

To see the exact instructions that get installed:

```bash
b0 skill show
```

## Uninstall

```bash
b0 skill uninstall claude-code
b0 skill uninstall codex
```
