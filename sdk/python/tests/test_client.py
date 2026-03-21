"""Unit tests for Stream0Client using mocked HTTP responses."""

import json

import pytest
import responses

from stream0 import (
    Stream0Client,
    Agent,
    AuthenticationError,
    NotFoundError,
    TimeoutError,
    ServerError,
    Stream0Error,
)

BASE_URL = "http://localhost:8080"


@pytest.fixture
def client():
    """Client with API key for group-level operations."""
    c = Stream0Client(BASE_URL, api_key="test-key-123")
    yield c
    c.close()


@pytest.fixture
def agent_client():
    """Client with agent token for agent-level operations."""
    c = Stream0Client(BASE_URL, api_key="test-key-123", agent_token="atok-test-token")
    yield c
    c.close()


# --- Health ---


@responses.activate
def test_health(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/health",
        json={"status": "healthy", "version": "0.4.0"},
        status=200,
    )
    result = client.health()
    assert result["status"] == "healthy"


# --- Agents (Group-auth) ---


@responses.activate
def test_list_agents(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents",
        json={
            "agents": [
                {"id": "agent-1", "created_at": "2024-01-01T00:00:00Z"},
                {"id": "agent-2", "created_at": "2024-01-02T00:00:00Z"},
            ]
        },
        status=200,
    )
    agents = client.list_agents()
    assert len(agents) == 2
    assert agents[0]["id"] == "agent-1"


@responses.activate
def test_list_agents_empty(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents",
        json={"agents": []},
        status=200,
    )
    agents = client.list_agents()
    assert agents == []


@responses.activate
def test_register_agent(client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents",
        json={
            "id": "agent-1",
            "agent_token": "atok-abc123",
            "created_at": "2024-01-01T00:00:00Z",
        },
        status=201,
    )
    result = client.register_agent("agent-1")
    assert result["id"] == "agent-1"
    assert result["agent_token"] == "atok-abc123"

    body = json.loads(responses.calls[0].request.body)
    assert body["id"] == "agent-1"


@responses.activate
def test_register_agent_with_options(client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents",
        json={
            "id": "agent-1",
            "agent_token": "atok-abc123",
            "description": "A test agent",
            "aliases": ["a1"],
            "created_at": "2024-01-01T00:00:00Z",
        },
        status=201,
    )
    result = client.register_agent("agent-1", aliases=["a1"], description="A test agent")
    assert result["agent_token"] == "atok-abc123"

    body = json.loads(responses.calls[0].request.body)
    assert body["aliases"] == ["a1"]
    assert body["description"] == "A test agent"


@responses.activate
def test_delete_agent(client):
    responses.add(
        responses.DELETE,
        f"{BASE_URL}/agents/agent-1",
        json={"status": "deleted", "agent_id": "agent-1"},
        status=200,
    )
    result = client.delete_agent("agent-1")
    assert result["status"] == "deleted"


@responses.activate
def test_delete_agent_not_found(client):
    responses.add(
        responses.DELETE,
        f"{BASE_URL}/agents/ghost",
        json={"error": "agent not found"},
        status=404,
    )
    with pytest.raises(NotFoundError):
        client.delete_agent("ghost")


# --- Inbox: Send (Agent-auth) ---


@responses.activate
def test_send_message(agent_client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/worker/inbox",
        json={"message_id": "imsg-abc123", "created_at": "2024-01-01T00:00:00Z"},
        status=201,
    )
    result = agent_client.send(
        to="worker",
        thread_id="task-1",
        msg_type="request",
        content={"instruction": "do work"},
    )
    assert result["message_id"] == "imsg-abc123"

    body = json.loads(responses.calls[0].request.body)
    assert body["thread_id"] == "task-1"
    assert body["type"] == "request"
    assert body["content"]["instruction"] == "do work"
    assert "from" not in body  # from is set server-side via token


@responses.activate
def test_send_message_includes_agent_token(agent_client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/worker/inbox",
        json={"message_id": "imsg-1", "created_at": "2024-01-01T00:00:00Z"},
        status=201,
    )
    agent_client.send(to="worker", thread_id="t1", msg_type="request")

    assert responses.calls[0].request.headers["X-Agent-Token"] == "atok-test-token"


def test_send_without_token_raises():
    c = Stream0Client(BASE_URL, api_key="test-key")
    with pytest.raises(Stream0Error, match="agent_token required"):
        c.send(to="worker", thread_id="t1", msg_type="request")
    c.close()


@responses.activate
def test_send_message_agent_not_found(agent_client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/ghost/inbox",
        json={"error": "agent not found"},
        status=404,
    )
    with pytest.raises(NotFoundError):
        agent_client.send("ghost", "task-1", "request")


# --- Inbox: Receive (Agent-auth) ---


@responses.activate
def test_receive_messages(agent_client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/worker/inbox",
        json={
            "messages": [
                {
                    "id": "imsg-1",
                    "thread_id": "task-1",
                    "from": "main",
                    "to": "worker",
                    "type": "request",
                    "content": {"n": 1},
                    "status": "unread",
                },
            ]
        },
        status=200,
    )
    messages = agent_client.receive("worker", status="unread")
    assert len(messages) == 1
    assert messages[0]["thread_id"] == "task-1"

    assert responses.calls[0].request.headers["X-Agent-Token"] == "atok-test-token"
    assert "status=unread" in responses.calls[0].request.url


@responses.activate
def test_receive_with_thread_filter(agent_client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/worker/inbox",
        json={"messages": []},
        status=200,
    )
    agent_client.receive("worker", thread_id="task-42")

    assert "thread_id=task-42" in responses.calls[0].request.url


@responses.activate
def test_receive_with_long_poll(agent_client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/worker/inbox",
        json={"messages": []},
        status=200,
    )
    agent_client.receive("worker", timeout=10)

    assert "timeout=10" in responses.calls[0].request.url


@responses.activate
def test_receive_empty(agent_client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/worker/inbox",
        json={"messages": []},
        status=200,
    )
    messages = agent_client.receive("worker")
    assert messages == []


# --- Inbox: Ack (Agent-auth) ---


@responses.activate
def test_ack_inbox_message(agent_client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/inbox/messages/imsg-abc/ack",
        json={"status": "acked", "message_id": "imsg-abc"},
        status=200,
    )
    result = agent_client.ack_inbox("imsg-abc")
    assert result["status"] == "acked"

    assert responses.calls[0].request.headers["X-Agent-Token"] == "atok-test-token"


@responses.activate
def test_ack_inbox_message_not_found(agent_client):
    responses.add(
        responses.POST,
        f"{BASE_URL}/inbox/messages/imsg-ghost/ack",
        json={"error": "message not found or already acked"},
        status=404,
    )
    with pytest.raises(NotFoundError):
        agent_client.ack_inbox("imsg-ghost")


# --- Threads (Group-auth) ---


@responses.activate
def test_get_thread_messages(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/threads/task-1/messages",
        json={
            "messages": [
                {"id": "imsg-1", "thread_id": "task-1", "from": "main", "to": "worker", "type": "request"},
                {"id": "imsg-2", "thread_id": "task-1", "from": "worker", "to": "main", "type": "question"},
                {"id": "imsg-3", "thread_id": "task-1", "from": "main", "to": "worker", "type": "answer"},
                {"id": "imsg-4", "thread_id": "task-1", "from": "worker", "to": "main", "type": "done"},
            ]
        },
        status=200,
    )
    messages = client.get_thread_messages("task-1")
    assert len(messages) == 4
    assert [m["type"] for m in messages] == ["request", "question", "answer", "done"]


@responses.activate
def test_get_thread_messages_empty(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/threads/nonexistent/messages",
        json={"messages": []},
        status=200,
    )
    messages = client.get_thread_messages("nonexistent")
    assert messages == []


# --- Authentication ---


@responses.activate
def test_api_key_header_sent(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents",
        json={"agents": []},
        status=200,
    )
    client.list_agents()

    assert responses.calls[0].request.headers["X-API-Key"] == "test-key-123"


@responses.activate
def test_auth_failure(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents",
        json={"error": "missing X-API-Key header"},
        status=401,
    )
    with pytest.raises(AuthenticationError) as exc_info:
        client.list_agents()
    assert exc_info.value.status_code == 401


# --- Error handling ---


@responses.activate
def test_server_error(client):
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents",
        json={"error": "internal server error"},
        status=500,
    )
    with pytest.raises(ServerError) as exc_info:
        client.list_agents()
    assert exc_info.value.status_code == 500


# --- Context manager ---


@responses.activate
def test_context_manager():
    responses.add(
        responses.GET,
        f"{BASE_URL}/health",
        json={"status": "healthy"},
        status=200,
    )
    with Stream0Client(BASE_URL) as c:
        result = c.health()
        assert result["status"] == "healthy"


# --- URL handling ---


def test_trailing_slash_stripped():
    c = Stream0Client("http://localhost:8080/")
    assert c.base_url == "http://localhost:8080"
    c.close()


def test_url_construction():
    c = Stream0Client("http://example.com:9090")
    assert c._url("/agents") == "http://example.com:9090/agents"
    c.close()


# --- Agent high-level class ---


@responses.activate
def test_agent_register_stores_token():
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents",
        json={"id": "my-agent", "agent_token": "atok-xyz", "created_at": "2024-01-01T00:00:00Z"},
        status=201,
    )
    with Agent("my-agent", url=BASE_URL, api_key="key") as agent:
        result = agent.register()
        assert result["agent_token"] == "atok-xyz"
        # Token should be stored for subsequent operations
        assert agent.client.agent_token == "atok-xyz"


@responses.activate
def test_agent_send():
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/other-agent/inbox",
        json={"message_id": "imsg-1", "created_at": "2024-01-01T00:00:00Z"},
        status=201,
    )
    with Agent("my-agent", url=BASE_URL, agent_token="atok-test") as agent:
        result = agent.send("other-agent", thread_id="t1", msg_type="request", content={"x": 1})
        assert result["message_id"] == "imsg-1"

    # Verify agent token header is sent
    assert responses.calls[0].request.headers["X-Agent-Token"] == "atok-test"

    # Verify no `from` field in body
    body = json.loads(responses.calls[0].request.body)
    assert "from" not in body


@responses.activate
def test_agent_receive():
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/my-agent/inbox",
        json={
            "messages": [
                {"id": "imsg-1", "thread_id": "t1", "from": "other", "type": "request", "status": "unread"},
            ]
        },
        status=200,
    )
    with Agent("my-agent", url=BASE_URL, agent_token="atok-test") as agent:
        messages = agent.receive()
        assert len(messages) == 1

    assert "status=unread" in responses.calls[0].request.url
    assert responses.calls[0].request.headers["X-Agent-Token"] == "atok-test"


@responses.activate
def test_agent_ack():
    responses.add(
        responses.POST,
        f"{BASE_URL}/inbox/messages/imsg-1/ack",
        json={"status": "acked", "message_id": "imsg-1"},
        status=200,
    )
    with Agent("my-agent", url=BASE_URL, agent_token="atok-test") as agent:
        result = agent.ack("imsg-1")
        assert result["status"] == "acked"

    assert responses.calls[0].request.headers["X-Agent-Token"] == "atok-test"


@responses.activate
def test_agent_history():
    responses.add(
        responses.GET,
        f"{BASE_URL}/threads/t1/messages",
        json={
            "messages": [
                {"id": "imsg-1", "type": "request"},
                {"id": "imsg-2", "type": "done"},
            ]
        },
        status=200,
    )
    with Agent("my-agent", url=BASE_URL, api_key="key") as agent:
        messages = agent.history("t1")
        assert len(messages) == 2


@responses.activate
def test_agent_with_api_key():
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents",
        json={"id": "secure-agent", "agent_token": "atok-s", "created_at": "2024-01-01T00:00:00Z"},
        status=201,
    )
    with Agent("secure-agent", url=BASE_URL, api_key="secret-key") as agent:
        agent.register()

    assert responses.calls[0].request.headers["X-API-Key"] == "secret-key"


@responses.activate
def test_agent_full_conversation():
    """Test a complete multi-turn conversation using the Agent class."""
    # Register both agents — return agent tokens
    responses.add(
        responses.POST, f"{BASE_URL}/agents",
        json={"id": "main", "agent_token": "atok-main"},
        status=201,
    )
    responses.add(
        responses.POST, f"{BASE_URL}/agents",
        json={"id": "translator", "agent_token": "atok-translator"},
        status=201,
    )

    # Main sends request
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/translator/inbox",
        json={"message_id": "imsg-1"},
        status=201,
    )

    # Translator receives
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/translator/inbox",
        json={"messages": [{"id": "imsg-1", "thread_id": "t1", "type": "request", "from": "main"}]},
        status=200,
    )

    # Translator asks question
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/main/inbox",
        json={"message_id": "imsg-2"},
        status=201,
    )

    # Main receives question
    responses.add(
        responses.GET,
        f"{BASE_URL}/agents/main/inbox",
        json={"messages": [{"id": "imsg-2", "thread_id": "t1", "type": "question", "from": "translator"}]},
        status=200,
    )

    # Main answers
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/translator/inbox",
        json={"message_id": "imsg-3"},
        status=201,
    )

    # Translator completes
    responses.add(
        responses.POST,
        f"{BASE_URL}/agents/main/inbox",
        json={"message_id": "imsg-4"},
        status=201,
    )

    # Full conversation history
    responses.add(
        responses.GET,
        f"{BASE_URL}/threads/t1/messages",
        json={
            "messages": [
                {"id": "imsg-1", "type": "request", "from": "main", "to": "translator"},
                {"id": "imsg-2", "type": "question", "from": "translator", "to": "main"},
                {"id": "imsg-3", "type": "answer", "from": "main", "to": "translator"},
                {"id": "imsg-4", "type": "done", "from": "translator", "to": "main"},
            ]
        },
        status=200,
    )

    main = Agent("main", url=BASE_URL, api_key="key")
    translator = Agent("translator", url=BASE_URL, api_key="key")

    main.register()
    translator.register()

    # After registration, tokens should be stored
    assert main.client.agent_token == "atok-main"
    assert translator.client.agent_token == "atok-translator"

    # Main sends task
    main.send("translator", thread_id="t1", msg_type="request", content={"text": "translate this"})

    # Translator picks up
    msgs = translator.receive(thread_id="t1")
    assert len(msgs) == 1
    assert msgs[0]["type"] == "request"

    # Translator asks question
    translator.send("main", thread_id="t1", msg_type="question", content={"q": "A or B?"})

    # Main answers
    msgs = main.receive(thread_id="t1")
    assert msgs[0]["type"] == "question"
    main.send("translator", thread_id="t1", msg_type="answer", content={"a": "use A"})

    # Translator completes
    translator.send("main", thread_id="t1", msg_type="done", content={"result": "translated"})

    # Check full history
    history = main.history("t1")
    assert len(history) == 4
    assert [m["type"] for m in history] == ["request", "question", "answer", "done"]

    main.close()
    translator.close()
