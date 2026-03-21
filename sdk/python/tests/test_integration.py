"""Integration tests that run against a real stream0 server.

To run these tests:
    1. Start stream0: ./stream0 --config stream0.yaml
    2. Set STREAM0_URL: export STREAM0_URL=http://localhost:8080
    3. Optionally set STREAM0_API_KEY if auth is enabled
    4. Run: pytest tests/test_integration.py -v

These tests are skipped if STREAM0_URL is not set.
"""

import os
import threading
import time
import uuid

import pytest

from stream0 import Stream0Client, Agent, TimeoutError

STREAM0_URL = os.environ.get("STREAM0_URL")
STREAM0_API_KEY = os.environ.get("STREAM0_API_KEY")

pytestmark = pytest.mark.skipif(
    not STREAM0_URL, reason="STREAM0_URL not set - skipping integration tests"
)


def unique_name(prefix="test"):
    """Generate a unique name to avoid test interference."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def client():
    c = Stream0Client(STREAM0_URL, api_key=STREAM0_API_KEY)
    yield c
    c.close()


def _register_and_get_token(client, agent_id, **kwargs):
    """Register an agent and return its agent_token."""
    result = client.register_agent(agent_id, **kwargs)
    return result["agent_token"]


def _make_agent_client(agent_token):
    """Create a Stream0Client with an agent_token for agent-level operations."""
    return Stream0Client(STREAM0_URL, api_key=STREAM0_API_KEY, agent_token=agent_token)


# --- Health ---


def test_health(client):
    result = client.health()
    assert result["status"] == "healthy"


# --- Agent Registration ---


@pytest.fixture
def main_agent():
    agent_id = unique_name("main")
    a = Agent(agent_id, url=STREAM0_URL, api_key=STREAM0_API_KEY)
    a.register()
    yield a
    a.close()


@pytest.fixture
def worker_agent():
    agent_id = unique_name("worker")
    a = Agent(agent_id, url=STREAM0_URL, api_key=STREAM0_API_KEY)
    a.register()
    yield a
    a.close()


def test_list_agents_integration(client):
    # Register a few agents with unique names
    a1 = unique_name("agent")
    a2 = unique_name("agent")
    client.register_agent(a1)
    client.register_agent(a2)

    agents = client.list_agents()
    agent_ids = [a["id"] for a in agents]
    assert a1 in agent_ids
    assert a2 in agent_ids


def test_list_agents_after_delete(client):
    agent_id = unique_name("agent")
    client.register_agent(agent_id)

    # Verify it's in the list
    agents = client.list_agents()
    assert agent_id in [a["id"] for a in agents]

    # Delete and verify it's gone
    client.delete_agent(agent_id)
    agents = client.list_agents()
    assert agent_id not in [a["id"] for a in agents]


def test_register_agent_integration(client):
    agent_id = unique_name("agent")
    result = client.register_agent(agent_id)
    assert result["id"] == agent_id
    assert "agent_token" in result


def test_register_agent_idempotent(client):
    agent_id = unique_name("agent")
    r1 = client.register_agent(agent_id)
    r2 = client.register_agent(agent_id)
    assert r1["id"] == r2["id"]


def test_delete_agent_integration(client):
    agent_id = unique_name("agent")
    client.register_agent(agent_id)
    result = client.delete_agent(agent_id)
    assert result["status"] == "deleted"


# --- Inbox: Send, Receive, Ack ---


def test_send_and_receive(main_agent, worker_agent):
    thread_id = unique_name("task")

    # Main sends to worker
    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="request",
                    content={"instruction": "process this"})

    # Worker receives
    messages = worker_agent.receive(thread_id=thread_id)
    assert len(messages) == 1
    assert messages[0]["thread_id"] == thread_id
    assert messages[0]["type"] == "request"
    assert messages[0]["content"]["instruction"] == "process this"


def test_ack_marks_as_read(main_agent, worker_agent):
    thread_id = unique_name("task")

    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="request")

    # Get the message
    messages = worker_agent.receive()
    assert len(messages) == 1

    # Ack it
    worker_agent.ack(messages[0]["id"])

    # Should no longer appear in unread
    unread = worker_agent.receive()
    assert len(unread) == 0


def test_inbox_long_polling(main_agent, worker_agent):
    thread_id = unique_name("task")

    result_holder = {}

    def poller():
        messages = worker_agent.receive(thread_id=thread_id, timeout=10)
        result_holder["messages"] = messages

    # Start long-polling
    t = threading.Thread(target=poller)
    t.start()

    # Wait a bit, then send
    time.sleep(1)
    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="request",
                    content={"data": "arrived via long-poll"})

    t.join(timeout=15)

    assert "messages" in result_holder
    assert len(result_holder["messages"]) == 1
    assert result_holder["messages"][0]["content"]["data"] == "arrived via long-poll"


def test_task_history(main_agent, worker_agent):
    thread_id = unique_name("task")

    # Send request
    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="request",
                    content={"instruction": "translate"})

    # Worker asks question
    worker_agent.send(main_agent.agent_id, thread_id=thread_id, msg_type="question",
                      content={"q": "A or B?"})

    # Main answers
    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="answer",
                    content={"a": "use A"})

    # Worker completes
    worker_agent.send(main_agent.agent_id, thread_id=thread_id, msg_type="done",
                      content={"result": "translated document"})

    # Get full history
    history = main_agent.history(thread_id)
    assert len(history) == 4
    assert [m["type"] for m in history] == ["request", "question", "answer", "done"]


def test_multi_turn_translation_scenario(main_agent, worker_agent):
    """Full translation scenario from the PRD."""
    thread_id = unique_name("translate")

    # Step 1: Main agent sends translation task
    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="request",
                    content={
                        "instruction": "Translate this legal contract to Japanese",
                        "document": "The party of the first part hereby...",
                    })

    # Step 2: Worker picks up the task
    messages = worker_agent.receive(thread_id=thread_id)
    assert len(messages) == 1
    assert messages[0]["type"] == "request"
    worker_agent.ack(messages[0]["id"])

    # Step 3: Worker finds ambiguity, asks a question
    worker_agent.send(main_agent.agent_id, thread_id=thread_id, msg_type="question",
                      content={
                          "question": "Clause 3 uses 'indemnification' - use \u640d\u5bb3\u8ce0\u511f or \u88dc\u511f?",
                      })

    # Step 4: Main agent receives the question
    questions = main_agent.receive(thread_id=thread_id)
    assert len(questions) == 1
    assert questions[0]["type"] == "question"
    main_agent.ack(questions[0]["id"])

    # Step 5: Main agent answers
    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="answer",
                    content={"answer": "Use \u88dc\u511f (compensation)"})

    # Step 6: Worker receives answer, continues, completes
    answers = worker_agent.receive(thread_id=thread_id)
    assert len(answers) == 1
    assert answers[0]["type"] == "answer"
    worker_agent.ack(answers[0]["id"])

    # Step 7: Worker sends completed result
    worker_agent.send(main_agent.agent_id, thread_id=thread_id, msg_type="done",
                      content={"translated_document": "\u7b2c\u4e00\u5f53\u4e8b\u8005\u306f\u3001\u3053\u3053\u306b..."})

    # Step 8: Main agent receives the result
    results = main_agent.receive(thread_id=thread_id)
    assert len(results) == 1
    assert results[0]["type"] == "done"
    assert "\u7b2c\u4e00\u5f53\u4e8b\u8005" in results[0]["content"]["translated_document"]

    # Verify full conversation history
    history = main_agent.history(thread_id)
    assert len(history) == 4

    expected_flow = [
        ("request", main_agent.agent_id, worker_agent.agent_id),
        ("question", worker_agent.agent_id, main_agent.agent_id),
        ("answer", main_agent.agent_id, worker_agent.agent_id),
        ("done", worker_agent.agent_id, main_agent.agent_id),
    ]

    for i, (exp_type, exp_from, exp_to) in enumerate(expected_flow):
        assert history[i]["type"] == exp_type, f"msg {i}: expected type {exp_type}, got {history[i]['type']}"
        assert history[i]["from"] == exp_from, f"msg {i}: expected from {exp_from}, got {history[i]['from']}"
        assert history[i]["to"] == exp_to, f"msg {i}: expected to {exp_to}, got {history[i]['to']}"


def test_multiple_sub_agents(client):
    """Main agent manages 3 sub-agents concurrently, all on the same task."""
    main_id = unique_name("main")
    research_id = unique_name("research")
    writer_id = unique_name("writer")
    charts_id = unique_name("charts")
    thread_id = unique_name("report")

    # Register all agents and get their tokens
    main_token = _register_and_get_token(client, main_id)
    research_token = _register_and_get_token(client, research_id)
    writer_token = _register_and_get_token(client, writer_id)
    charts_token = _register_and_get_token(client, charts_id)

    # Create agent-level clients for sending
    main_client = _make_agent_client(main_token)

    try:
        # Main sends tasks to all 3 sub-agents
        for sub_id, instruction in [
            (research_id, "find market data"),
            (writer_id, "write executive summary"),
            (charts_id, "create visualizations"),
        ]:
            main_client.send(sub_id, thread_id, "request", {"instruction": instruction})

        # Each sub-agent completes and sends back to main
        for sub_token, result in [
            (research_token, {"data": "market is $5B"}),
            (writer_token, {"summary": "Report written"}),
            (charts_token, {"chart": "chart.png"}),
        ]:
            sub_client = _make_agent_client(sub_token)
            try:
                sub_client.send(main_id, thread_id, "done", result)
            finally:
                sub_client.close()

        # Main sees all 3 completions
        messages = main_client.receive(main_id, thread_id=thread_id)
        assert len(messages) == 3
        assert all(m["type"] == "done" for m in messages)

        # Full task history: 3 requests + 3 completions = 6
        history = client.get_thread_messages(thread_id)
        assert len(history) == 6
    finally:
        main_client.close()


def test_inbox_isolation(client):
    """Messages to agent A don't appear in agent B's inbox."""
    agent_a = unique_name("agent")
    agent_b = unique_name("agent")
    sender_id = unique_name("sender")

    # Register all agents and get tokens
    token_a = _register_and_get_token(client, agent_a)
    token_b = _register_and_get_token(client, agent_b)
    sender_token = _register_and_get_token(client, sender_id)

    sender_client = _make_agent_client(sender_token)
    client_a = _make_agent_client(token_a)
    client_b = _make_agent_client(token_b)

    try:
        sender_client.send(agent_a, "task-1", "request", {"for": "a"})
        sender_client.send(agent_b, "task-1", "request", {"for": "b"})

        msgs_a = client_a.receive(agent_a)
        msgs_b = client_b.receive(agent_b)

        assert len(msgs_a) == 1
        assert len(msgs_b) == 1
        assert msgs_a[0]["content"]["for"] == "a"
        assert msgs_b[0]["content"]["for"] == "b"
    finally:
        sender_client.close()
        client_a.close()
        client_b.close()


def test_agent_aliases(client):
    """Messages sent to an alias arrive in the canonical inbox."""
    agent_id = unique_name("agent")
    alias = unique_name("alias")
    sender_id = unique_name("sender")

    token = _register_and_get_token(client, agent_id, aliases=[alias])
    sender_token = _register_and_get_token(client, sender_id)

    sender_client = _make_agent_client(sender_token)
    agent_client = _make_agent_client(token)

    try:
        # Send via alias
        sender_client.send(alias, "task-1", "request", {"via": "alias"})

        # Receive on canonical ID
        messages = agent_client.receive(agent_id, status="unread")
        assert len(messages) == 1
        assert messages[0]["to"] == agent_id
        assert messages[0]["content"]["via"] == "alias"
    finally:
        sender_client.close()
        agent_client.close()


def test_agent_aliases_in_list(client):
    """Listed agents include their aliases."""
    agent_id = unique_name("agent")
    alias1 = unique_name("alias")
    alias2 = unique_name("alias")

    client.register_agent(agent_id, aliases=[alias1, alias2])

    agents = client.list_agents()
    agent = next(a for a in agents if a["id"] == agent_id)
    assert alias1 in agent["aliases"]
    assert alias2 in agent["aliases"]


def test_agent_last_seen(client):
    """Polling inbox updates last_seen timestamp."""
    agent_id = unique_name("agent")
    result = client.register_agent(agent_id)
    token = result["agent_token"]

    # Before polling, last_seen should be null
    agents = client.list_agents()
    agent = next(a for a in agents if a["id"] == agent_id)
    assert agent.get("last_seen") is None

    # Poll inbox (requires agent token)
    agent_client = _make_agent_client(token)
    try:
        agent_client.receive(agent_id)
    finally:
        agent_client.close()

    # Now last_seen should be set
    agents = client.list_agents()
    agent = next(a for a in agents if a["id"] == agent_id)
    assert agent.get("last_seen") is not None


def test_webhook_stored_on_registration(client):
    """Webhook URL is stored and returned in agent list."""
    agent_id = unique_name("agent")
    result = client.register_agent(agent_id, webhook="https://example.com/notify")
    assert result.get("webhook") == "https://example.com/notify"

    agents = client.list_agents()
    agent = next(a for a in agents if a["id"] == agent_id)
    assert agent.get("webhook") == "https://example.com/notify"


def test_webhook_called_on_message(client):
    """Stream0 POSTs to the webhook URL when a message is sent to the agent."""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import json

    received = []

    class WebhookHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            received.append(body)
            self.send_response(200)
            self.end_headers()
        def log_message(self, *args):
            pass  # suppress logs

    # Start a local webhook server
    server = HTTPServer(("127.0.0.1", 0), WebhookHandler)
    port = server.server_address[1]
    webhook_url = f"http://127.0.0.1:{port}/webhook"

    server_thread = threading.Thread(target=server.handle_request)
    server_thread.start()

    # Register agent with webhook, and a sender agent
    agent_id = unique_name("agent")
    sender_id = unique_name("sender")
    client.register_agent(agent_id, webhook=webhook_url)
    sender_token = _register_and_get_token(client, sender_id)

    # Sender needs a token to send
    sender_client = _make_agent_client(sender_token)
    try:
        sender_client.send(agent_id, "task-wh", "request", {"data": "hello"})
    finally:
        sender_client.close()

    # Wait for webhook to be received
    server_thread.join(timeout=5)
    server.server_close()

    assert len(received) == 1
    assert received[0]["event"] == "new_message"
    assert received[0]["agent_id"] == agent_id
    assert received[0]["thread_id"] == "task-wh"
    assert received[0]["from"] == sender_id
    assert received[0]["type"] == "request"


def test_failed_task(main_agent, worker_agent):
    """Worker reports task failure."""
    thread_id = unique_name("task")

    main_agent.send(worker_agent.agent_id, thread_id=thread_id, msg_type="request",
                    content={"instruction": "do something impossible"})

    messages = worker_agent.receive(thread_id=thread_id)
    worker_agent.ack(messages[0]["id"])

    # Worker fails
    worker_agent.send(main_agent.agent_id, thread_id=thread_id, msg_type="failed",
                      content={"error": "task is impossible", "code": "IMPOSSIBLE"})

    # Main sees the failure
    results = main_agent.receive(thread_id=thread_id)
    assert len(results) == 1
    assert results[0]["type"] == "failed"
    assert results[0]["content"]["error"] == "task is impossible"
