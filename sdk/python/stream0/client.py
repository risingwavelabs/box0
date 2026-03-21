import requests as _requests

from stream0.exceptions import (
    AuthenticationError,
    NotFoundError,
    ServerError,
    Stream0Error,
    TimeoutError,
)


class Stream0Client:
    """HTTP client for stream0 agent communication service.

    Uses X-API-Key for group-level operations (register/list/delete agents, view threads).
    Uses X-Agent-Token for agent-level operations (send/receive/ack messages).
    """

    def __init__(self, base_url, api_key=None, agent_token=None, timeout=30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.api_key = api_key
        self.agent_token = agent_token
        self._session = _requests.Session()
        self._session.headers["Content-Type"] = "application/json"
        if api_key:
            self._session.headers["X-API-Key"] = api_key

    def _url(self, path):
        return f"{self.base_url}{path}"

    def _handle_response(self, resp):
        if resp.status_code == 401:
            raise AuthenticationError(
                resp.json().get("error", "authentication failed"),
                status_code=401,
                response=resp,
            )
        if resp.status_code == 404:
            raise NotFoundError(
                resp.json().get("error", "not found"),
                status_code=404,
                response=resp,
            )
        if resp.status_code == 504:
            raise TimeoutError(
                resp.json().get("error", "request timed out"),
                status_code=504,
                response=resp,
            )
        if resp.status_code >= 500:
            raise ServerError(
                resp.json().get("error", "server error"),
                status_code=resp.status_code,
                response=resp,
            )
        if resp.status_code >= 400:
            raise Stream0Error(
                resp.json().get("error", "request failed"),
                status_code=resp.status_code,
                response=resp,
            )
        return resp.json()

    def _agent_headers(self):
        """Headers for agent-auth endpoints."""
        if not self.agent_token:
            raise Stream0Error("agent_token required for this operation")
        return {"X-Agent-Token": self.agent_token}

    # --- Health ---

    def health(self):
        """Check server health. Returns dict with status and version."""
        resp = self._session.get(self._url("/health"), timeout=self.timeout)
        return self._handle_response(resp)

    # --- Agents (Group-auth: X-API-Key) ---

    def list_agents(self):
        """List all registered agents in this group.

        Returns:
            List of agent dicts.
        """
        resp = self._session.get(
            self._url("/agents"),
            timeout=self.timeout,
        )
        result = self._handle_response(resp)
        return result.get("agents", [])

    def register_agent(self, agent_id, aliases=None, webhook=None, description=None):
        """Register an agent. Creates its inbox. Idempotent.

        Args:
            agent_id: Unique agent identifier.
            aliases: Optional list of alternative names for this agent.
            webhook: Optional URL for message notifications.
            description: Optional description of what this agent does.

        Returns:
            Dict with id, description, aliases, agent_token, created_at, etc.
        """
        body = {"id": agent_id}
        if aliases:
            body["aliases"] = aliases
        if webhook:
            body["webhook"] = webhook
        if description:
            body["description"] = description
        resp = self._session.post(
            self._url("/agents"),
            json=body,
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def delete_agent(self, agent_id):
        """Delete an agent.

        Args:
            agent_id: Agent identifier to delete.

        Returns:
            Dict with status and agent_id.
        """
        resp = self._session.delete(
            self._url(f"/agents/{agent_id}"),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    # --- Inbox (Agent-auth: X-Agent-Token) ---

    def send(self, to, thread_id, msg_type, content=None):
        """Send a message to an agent's inbox.

        Sender identity is derived from the agent token.

        Args:
            to: Target agent ID.
            thread_id: Thread/conversation identifier.
            msg_type: One of: request, question, answer, done, failed, message.
            content: Optional message content (dict).

        Returns:
            Dict with message_id and created_at.
        """
        body = {"thread_id": thread_id, "type": msg_type}
        if content is not None:
            body["content"] = content
        resp = self._session.post(
            self._url(f"/agents/{to}/inbox"),
            json=body,
            headers=self._agent_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    def receive(self, agent_id, status=None, thread_id=None, timeout=0):
        """Poll an agent's inbox for messages.

        Args:
            agent_id: Agent whose inbox to read (must match token's agent).
            status: Filter by status ('unread' or 'acked'). None for all.
            thread_id: Filter by thread_id. None for all.
            timeout: Long-poll timeout in seconds (0 for immediate).

        Returns:
            List of message dicts.
        """
        params = {}
        if status:
            params["status"] = status
        if thread_id:
            params["thread_id"] = thread_id
        if timeout > 0:
            params["timeout"] = timeout

        http_timeout = max(timeout + 5, self.timeout)
        resp = self._session.get(
            self._url(f"/agents/{agent_id}/inbox"),
            params=params,
            headers=self._agent_headers(),
            timeout=http_timeout,
        )
        result = self._handle_response(resp)
        return result.get("messages", [])

    def ack_inbox(self, message_id):
        """Acknowledge an inbox message (mark as read).

        Args:
            message_id: The inbox message ID to acknowledge.

        Returns:
            Dict with status and message_id.
        """
        resp = self._session.post(
            self._url(f"/inbox/messages/{message_id}/ack"),
            headers=self._agent_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(resp)

    # --- Threads (Group-auth: X-API-Key) ---

    def get_thread_messages(self, thread_id):
        """Get the full conversation history for a thread.

        Args:
            thread_id: Thread/conversation identifier.

        Returns:
            List of message dicts in chronological order.
        """
        resp = self._session.get(
            self._url(f"/threads/{thread_id}/messages"),
            timeout=self.timeout,
        )
        result = self._handle_response(resp)
        return result.get("messages", [])

    def close(self):
        """Close the underlying HTTP session."""
        self._session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class Agent:
    """High-level agent interface for stream0 inbox communication.

    Wraps Stream0Client with a fixed agent identity:

        agent = Agent("my-agent", url="http://localhost:8080", api_key="...")
        result = agent.register()  # returns agent_token
        agent.send("other-agent", thread_id="t1", msg_type="request", content={...})
        messages = agent.receive()
        agent.ack(messages[0]["id"])
    """

    def __init__(self, agent_id, url="http://localhost:8080", api_key=None, agent_token=None, timeout=30, aliases=None, webhook=None, description=None):
        self.agent_id = agent_id
        self.aliases = aliases
        self.webhook = webhook
        self.description = description
        self.client = Stream0Client(url, api_key=api_key, agent_token=agent_token, timeout=timeout)

    def register(self):
        """Register this agent with stream0. Stores the returned agent_token."""
        result = self.client.register_agent(self.agent_id, aliases=self.aliases, webhook=self.webhook, description=self.description)
        # Store the agent token for subsequent operations
        if "agent_token" in result:
            self.client.agent_token = result["agent_token"]
        return result

    def send(self, to, thread_id, msg_type, content=None):
        """Send a message to another agent's inbox."""
        return self.client.send(to, thread_id, msg_type, content)

    def receive(self, status="unread", thread_id=None, timeout=0):
        """Poll this agent's inbox."""
        return self.client.receive(self.agent_id, status=status, thread_id=thread_id, timeout=timeout)

    def ack(self, message_id):
        """Acknowledge a message."""
        return self.client.ack_inbox(message_id)

    def history(self, thread_id):
        """Get full conversation history for a thread."""
        return self.client.get_thread_messages(thread_id)

    def close(self):
        """Close the underlying client."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
