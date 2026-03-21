mod config;
mod db;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Json},
    routing::{delete, get, post},
    Extension, Router,
};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use subtle::ConstantTimeEq;
use tokio::signal;
use tower_http::cors::CorsLayer;

use config::Config;
use db::Database;

// --- Identity types ---

#[derive(Clone)]
struct Group(String);

#[derive(Clone)]
struct AgentIdentity {
    group: String,
    agent_id: String,
}

// --- App State ---

struct AppState {
    db: Database,
    key_map: HashMap<String, String>,
}

type SharedState = Arc<AppState>;

// --- CLI ---

#[derive(Parser)]
#[command(name = "stream0")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    /// Path to YAML config file
    #[arg(short, long, global = true)]
    config: Option<String>,
}

#[derive(clap::Subcommand)]
enum Command {
    /// Start the Stream0 server (default if no subcommand)
    Serve,
    /// Agent management
    Agent {
        #[command(subcommand)]
        action: AgentAction,
    },
    /// Set up a runtime to listen for tasks (e.g. stream0 init claude)
    Init {
        #[command(subcommand)]
        runtime: InitRuntime,
    },
    /// Show server status and registered agents
    Status {
        /// Stream0 server URL
        #[arg(long, default_value = "http://localhost:8080")]
        url: String,
    },
}

#[derive(clap::Subcommand)]
enum AgentAction {
    /// Register an agent on Stream0
    Start {
        /// Agent name
        #[arg(long)]
        name: String,
        /// What this agent does
        #[arg(long, default_value = "")]
        description: String,
        /// Stream0 server URL
        #[arg(long, default_value = "http://localhost:8080")]
        url: String,
    },
}

#[derive(clap::Subcommand)]
enum InitRuntime {
    /// Set up Claude Code to listen for tasks via Stream0 channel
    Claude {
        /// Agent name for this Claude Code instance
        #[arg(long)]
        name: String,
        /// What this agent does
        #[arg(long, default_value = "")]
        description: String,
        /// Stream0 server URL
        #[arg(long, default_value = "http://localhost:8080")]
        url: String,
    },
}

// --- Request/Response types ---

#[derive(Deserialize)]
struct RegisterAgentRequest {
    id: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    aliases: Option<Vec<String>>,
    #[serde(default)]
    webhook: Option<String>,
}

#[derive(Serialize)]
struct RegisterAgentResponse {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    aliases: Vec<String>,
    agent_token: String,
    created_at: chrono::DateTime<chrono::Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_seen: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    webhook: Option<String>,
}

#[derive(Deserialize)]
struct SendInboxRequest {
    thread_id: String,
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    content: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct InboxQuery {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    thread_id: Option<String>,
    #[serde(default)]
    timeout: Option<f64>,
}

// --- Auth Middleware: Group-level (X-API-Key) ---

async fn group_auth_middleware(
    State(state): State<SharedState>,
    headers: HeaderMap,
    mut request: axum::extract::Request,
    next: Next,
) -> impl IntoResponse {
    if state.key_map.is_empty() {
        request.extensions_mut().insert(Group("default".to_string()));
        return next.run(request).await;
    }

    let key = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if key.is_empty() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "missing X-API-Key header"})),
        )
            .into_response();
    }

    let key_bytes = key.as_bytes();
    let group = state
        .key_map
        .iter()
        .find(|(k, _)| key_bytes.ct_eq(k.as_bytes()).into())
        .map(|(_, group)| group.clone());

    match group {
        Some(g) => {
            request.extensions_mut().insert(Group(g));
            next.run(request).await
        }
        None => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid API key"})),
        )
            .into_response(),
    }
}

// --- Auth Middleware: Agent-level (X-Agent-Token) ---

async fn agent_auth_middleware(
    State(state): State<SharedState>,
    headers: HeaderMap,
    mut request: axum::extract::Request,
    next: Next,
) -> impl IntoResponse {
    let token = headers
        .get("x-agent-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if token.is_empty() {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "missing X-Agent-Token header"})),
        )
            .into_response();
    }

    match state.db.resolve_agent_by_token(token) {
        Ok(Some((group, agent_id))) => {
            request.extensions_mut().insert(AgentIdentity { group, agent_id });
            next.run(request).await
        }
        Ok(None) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "invalid agent token"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "authentication error"})),
        )
            .into_response(),
    }
}

// --- Handlers: Health ---

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "version": "0.4.0"
    }))
}

// --- Handlers: Agents (Group-auth) ---

async fn list_agents_handler(
    State(state): State<SharedState>,
    Extension(Group(group)): Extension<Group>,
) -> impl IntoResponse {
    match state.db.list_agents(&group) {
        Ok(agents) => (StatusCode::OK, Json(serde_json::json!({"agents": agents}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn register_agent_handler(
    State(state): State<SharedState>,
    Extension(Group(group)): Extension<Group>,
    Json(req): Json<RegisterAgentRequest>,
) -> impl IntoResponse {
    match state.db.register_agent(&group, &req.id, req.aliases.as_deref(), req.webhook.as_deref(), req.description.as_deref()) {
        Ok(agent) => {
            let resp = RegisterAgentResponse {
                id: agent.id,
                description: agent.description,
                aliases: agent.aliases,
                agent_token: agent.agent_token.unwrap_or_default(),
                created_at: agent.created_at,
                last_seen: agent.last_seen,
                webhook: agent.webhook,
            };
            (StatusCode::CREATED, Json(serde_json::to_value(resp).unwrap())).into_response()
        }
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn delete_agent_handler(
    State(state): State<SharedState>,
    Extension(Group(group)): Extension<Group>,
    Path(agent_id): Path<String>,
) -> impl IntoResponse {
    match state.db.delete_agent(&group, &agent_id) {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({"status": "deleted", "agent_id": agent_id})),
        )
            .into_response(),
        Err(e) => error_response(StatusCode::NOT_FOUND, &e.to_string()),
    }
}

async fn get_thread_messages_handler(
    State(state): State<SharedState>,
    Extension(Group(group)): Extension<Group>,
    Path(thread_id): Path<String>,
) -> impl IntoResponse {
    match state.db.get_thread_messages(&group, &thread_id) {
        Ok(messages) => (StatusCode::OK, Json(serde_json::json!({"messages": messages}))).into_response(),
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

// --- Handlers: Inbox (Agent-auth) ---

async fn send_inbox_message_handler(
    State(state): State<SharedState>,
    Extension(identity): Extension<AgentIdentity>,
    Path(agent_id): Path<String>,
    Json(req): Json<SendInboxRequest>,
) -> impl IntoResponse {
    let resolved_id = match state.db.resolve_agent(&identity.group, &agent_id) {
        Ok(Some(id)) => id,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "agent not found"),
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    let valid_types = ["request", "question", "answer", "done", "failed", "message"];
    if !valid_types.contains(&req.msg_type.as_str()) {
        return error_response(
            StatusCode::BAD_REQUEST,
            "type must be one of: request, question, answer, done, failed, message",
        );
    }

    match state.db.send_inbox_message(
        &identity.group,
        &req.thread_id,
        &identity.agent_id,
        &resolved_id,
        &req.msg_type,
        req.content.as_ref(),
    ) {
        Ok(msg) => {
            if let Ok(Some(webhook_url)) = state.db.get_agent_webhook(&identity.group, &resolved_id) {
                let payload = serde_json::json!({
                    "event": "new_message",
                    "agent_id": resolved_id,
                    "message_id": msg.id,
                    "thread_id": req.thread_id,
                    "from": identity.agent_id,
                    "type": req.msg_type,
                });
                tokio::spawn(async move {
                    let client = reqwest::Client::builder()
                        .timeout(std::time::Duration::from_secs(10))
                        .build()
                        .unwrap();
                    let _ = client.post(&webhook_url).json(&payload).send().await;
                });
            }

            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "message_id": msg.id,
                    "created_at": msg.created_at,
                })),
            )
                .into_response()
        }
        Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

async fn get_inbox_messages_handler(
    State(state): State<SharedState>,
    Extension(identity): Extension<AgentIdentity>,
    Path(agent_id): Path<String>,
    Query(params): Query<InboxQuery>,
) -> impl IntoResponse {
    let resolved_id = match state.db.resolve_agent(&identity.group, &agent_id) {
        Ok(Some(id)) => id,
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "agent not found"),
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    if resolved_id != identity.agent_id {
        return error_response(StatusCode::FORBIDDEN, "cannot read another agent's inbox");
    }

    let _ = state.db.update_last_seen(&identity.group, &resolved_id);

    let timeout = params.timeout.unwrap_or(0.0).clamp(0.0, 30.0);
    let start = std::time::Instant::now();

    loop {
        match state.db.get_inbox_messages(
            &identity.group,
            &resolved_id,
            params.status.as_deref(),
            params.thread_id.as_deref(),
        ) {
            Ok(messages) if !messages.is_empty() || timeout <= 0.0 => {
                return (StatusCode::OK, Json(serde_json::json!({"messages": messages}))).into_response();
            }
            Ok(_) => {}
            Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
        }

        if start.elapsed().as_secs_f64() >= timeout {
            let empty: Vec<db::InboxMessage> = vec![];
            return (StatusCode::OK, Json(serde_json::json!({"messages": empty}))).into_response();
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
}

async fn ack_inbox_message_handler(
    State(state): State<SharedState>,
    Extension(identity): Extension<AgentIdentity>,
    Path(message_id): Path<String>,
) -> impl IntoResponse {
    match state.db.ack_inbox_message(&identity.group, &message_id) {
        Ok(()) => (
            StatusCode::OK,
            Json(serde_json::json!({"status": "acked", "message_id": message_id})),
        )
            .into_response(),
        Err(e) => error_response(StatusCode::NOT_FOUND, &e.to_string()),
    }
}

// --- Helpers ---

fn error_response(status: StatusCode, message: &str) -> axum::response::Response {
    (status, Json(serde_json::json!({"error": message}))).into_response()
}

// --- CLI subcommands ---

async fn cmd_agent_start(name: &str, description: &str, url: &str) {
    let api_key = std::env::var("STREAM0_API_KEY").unwrap_or_default();

    let health_url = format!("{}/health", url);
    if reqwest::get(&health_url).await.is_err() {
        eprintln!("Error: Stream0 server not reachable at {}", url);
        eprintln!("Start the server first: stream0");
        std::process::exit(1);
    }

    let client = reqwest::Client::new();
    let mut body = serde_json::json!({"id": name});
    if !description.is_empty() {
        body["description"] = serde_json::Value::String(description.to_string());
    }
    let mut req = client.post(format!("{}/agents", url)).json(&body);
    if !api_key.is_empty() {
        req = req.header("X-API-Key", &api_key);
    }
    let agent_token = match req.send().await {
        Ok(resp) if resp.status().is_success() => {
            let data: serde_json::Value = resp.json().await.unwrap_or_default();
            data["agent_token"].as_str().unwrap_or("").to_string()
        }
        Ok(resp) => {
            let text = resp.text().await.unwrap_or_default();
            eprintln!("Failed to register agent: {}", text);
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("Failed to register agent: {}", e);
            std::process::exit(1);
        }
    };

    println!("Agent \"{}\" registered on {}", name, url);
    if !agent_token.is_empty() {
        println!("Agent token: {}", agent_token);
    }
    println!();
    println!("To set up a listener, run:");
    println!("  stream0 init claude --name {} --url {}", name, url);
}

async fn cmd_init_claude(name: &str, description: &str, url: &str) {
    let api_key = std::env::var("STREAM0_API_KEY").unwrap_or_default();

    // Register agent on Stream0
    let client = reqwest::Client::new();
    let mut body = serde_json::json!({"id": name});
    if !description.is_empty() {
        body["description"] = serde_json::Value::String(description.to_string());
    }
    let mut req = client.post(format!("{}/agents", url)).json(&body);
    if !api_key.is_empty() {
        req = req.header("X-API-Key", &api_key);
    }
    let agent_token = match req.send().await {
        Ok(resp) if resp.status().is_success() => {
            let data: serde_json::Value = resp.json().await.unwrap_or_default();
            let token = data["agent_token"].as_str().unwrap_or("").to_string();
            println!("Agent \"{}\" registered on {}", name, url);
            token
        }
        Ok(_) | Err(_) => {
            eprintln!("Warning: could not register agent on {} (is the server running?)", url);
            String::new()
        }
    };

    // Write .mcp.json
    let mcp_file = std::path::Path::new(".mcp.json");
    let mcp_config = serde_json::json!({
        "mcpServers": {
            "stream0-channel": {
                "command": "npx",
                "args": ["stream0-channel"],
                "env": {
                    "STREAM0_URL": url,
                    "STREAM0_API_KEY": api_key,
                    "STREAM0_AGENT_ID": name,
                    "STREAM0_AGENT_TOKEN": agent_token
                }
            }
        }
    });

    // Always write .mcp.json to ensure token is current
    std::fs::write(mcp_file, serde_json::to_string_pretty(&mcp_config).unwrap())
        .expect("failed to write .mcp.json");
    println!("Wrote .mcp.json");

    println!();
    println!("Now run:");
    println!("  claude --dangerously-load-development-channels server:stream0-channel");
}

async fn cmd_status(url: &str) {
    let api_key = std::env::var("STREAM0_API_KEY").unwrap_or_default();

    let health_url = format!("{}/health", url);
    match reqwest::get(&health_url).await {
        Ok(resp) => {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let version = data["version"].as_str().unwrap_or("?");
                println!("Stream0 running at {} ({})", url, version);
            }
        }
        Err(_) => {
            eprintln!("Stream0 server not reachable at {}", url);
            std::process::exit(1);
        }
    }

    let client = reqwest::Client::new();
    let mut req = client.get(format!("{}/agents", url));
    if !api_key.is_empty() {
        req = req.header("X-API-Key", &api_key);
    }

    println!("\nRegistered agents:");
    if let Ok(resp) = req.send().await {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            if let Some(agents) = data["agents"].as_array() {
                if agents.is_empty() {
                    println!("  (none)");
                    return;
                }
                let now = chrono::Utc::now();
                for a in agents {
                    let id = a["id"].as_str().unwrap_or("?");
                    let desc = a["description"].as_str().unwrap_or("(no description)");
                    let status = match a["last_seen"].as_str() {
                        Some(ls) => {
                            if let Ok(seen) = chrono::DateTime::parse_from_rfc3339(ls) {
                                let diff = (now - seen.with_timezone(&chrono::Utc)).num_seconds();
                                if diff < 300 { "online " } else { "offline" }
                            } else {
                                "offline"
                            }
                        }
                        None => "offline",
                    };
                    println!("  {} {}: {}", status, id, desc);
                }
            }
        }
    }
}

// --- Main ---

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Some(Command::Agent { action: AgentAction::Start { name, description, url } }) => {
            cmd_agent_start(&name, &description, &url).await;
        }
        Some(Command::Init { runtime: InitRuntime::Claude { name, description, url } }) => {
            cmd_init_claude(&name, &description, &url).await;
        }
        Some(Command::Status { url }) => {
            cmd_status(&url).await;
        }
        Some(Command::Serve) | None => {
            run_server(cli.config.as_deref()).await;
        }
    }
}

async fn run_server(config_path: Option<&str>) {
    let cfg = Config::load(config_path);

    if cfg.log.format == "json" {
        tracing_subscriber::fmt().json().with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&cfg.log.level)),
        ).init();
    } else {
        tracing_subscriber::fmt().with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&cfg.log.level)),
        ).init();
    }

    tracing::info!("Stream0 starting");

    let db = Database::new(&cfg.database.path).expect("failed to initialize database");
    let key_map = cfg.auth.build_key_map();

    if cfg.auth.has_keys() {
        tracing::info!(keys = cfg.auth.total_keys(), "API key authentication enabled");
    } else {
        tracing::warn!("No API keys configured - all endpoints are unauthenticated");
    }

    let state = Arc::new(AppState { db, key_map });

    let public = Router::new().route("/health", get(health_handler));

    let group_routes = Router::new()
        .route("/agents", get(list_agents_handler).post(register_agent_handler))
        .route("/agents/{agent_id}", delete(delete_agent_handler))
        .route("/threads/{thread_id}/messages", get(get_thread_messages_handler))
        .layer(middleware::from_fn_with_state(state.clone(), group_auth_middleware));

    let agent_routes = Router::new()
        .route("/agents/{agent_id}/inbox", get(get_inbox_messages_handler).post(send_inbox_message_handler))
        .route("/inbox/messages/{message_id}/ack", post(ack_inbox_message_handler))
        .layer(middleware::from_fn_with_state(state.clone(), agent_auth_middleware));

    let app = Router::new()
        .merge(public)
        .merge(group_routes)
        .merge(agent_routes)
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = cfg.address();
    tracing::info!(address = %addr, "Server starting");

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Error: could not bind to {} ({})", addr, e);
            if e.kind() == std::io::ErrorKind::AddrInUse {
                eprintln!("Another process is already using that port. Kill it or use a different port:");
                eprintln!("  STREAM0_SERVER_PORT=8081 stream0");
            }
            std::process::exit(1);
        }
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");

    tracing::info!("Stream0 stopped");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c().await.expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}
