# Slack notifications

Box0 can send Slack messages when agents complete or fail a task.

## Setup

### 1. Create a Slack app

Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app for your workspace.

### 2. Add permissions

Under **OAuth & Permissions**, add the `chat:write` bot scope.

### 3. Install to workspace

Install the app to your Slack workspace and copy the **Bot User OAuth Token** (starts with `xoxb-`).

### 4. Invite the bot

Invite the bot to any channel you want notifications in:

```
/invite @your-bot-name
```

### 5. Configure Box0

Set the token as an environment variable before starting the server:

```bash
export B0_SLACK_TOKEN=xoxb-your-token-here
b0 server
```

## Usage

Specify a Slack channel when creating an agent:

```bash
b0 agent add monitor --instructions "Watch for regressions." --slack "#ops"
```

Or with a cron job:

```bash
b0 cron add --every 1h "Check production health." --slack "#ci-alerts"
```

When the agent finishes (or fails), Box0 posts a message to the channel:

```
[Box0] monitor done: No regressions found in the latest deployment.
```

```
[Box0] monitor failed: Connection timeout reaching production API.
```

## Notes

- The message includes the agent name, status (done/failed), and result text (truncated to 500 characters).
- Both `--slack` and `--webhook` can be used on the same agent.
- The server must have `B0_SLACK_TOKEN` set. If the token is missing, Slack notifications are silently skipped.
