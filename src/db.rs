use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

pub struct Database {
    conn: Mutex<Connection>,
}

// --- Models ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    #[serde(default)]
    pub aliases: Vec<String>,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook: Option<String>,
    /// Only included in registration response, never in list/get
    #[serde(skip_serializing)]
    pub agent_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxMessage {
    pub id: String,
    pub thread_id: String,
    #[serde(rename = "from")]
    pub from_agent: String,
    #[serde(rename = "to")]
    pub to_agent: String,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub content: Option<serde_json::Value>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)
            .with_context(|| format!("failed to open database: {}", path))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS agents (
                group_id TEXT NOT NULL DEFAULT 'default',
                id TEXT NOT NULL,
                description TEXT,
                agent_token TEXT,
                created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                last_seen TEXT,
                webhook TEXT,
                PRIMARY KEY (group_id, id)
            );

            CREATE TABLE IF NOT EXISTS agent_aliases (
                group_id TEXT NOT NULL DEFAULT 'default',
                alias TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                PRIMARY KEY (group_id, alias),
                FOREIGN KEY (group_id, agent_id) REFERENCES agents(group_id, id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS inbox_messages (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL DEFAULT 'default',
                thread_id TEXT NOT NULL,
                from_agent TEXT NOT NULL,
                to_agent TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT,
                status TEXT NOT NULL DEFAULT 'unread',
                created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_inbox_group_to_status ON inbox_messages(group_id, to_agent, status);
            CREATE INDEX IF NOT EXISTS idx_inbox_group_thread ON inbox_messages(group_id, thread_id);
            CREATE INDEX IF NOT EXISTS idx_inbox_group_to_thread ON inbox_messages(group_id, to_agent, thread_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_token ON agents(agent_token);
            ",
        )?;

        Ok(())
    }

    fn parse_ts(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.with_timezone(&Utc))
            .or_else(|_| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%SZ")
                    .map(|ndt| ndt.and_utc())
            })
            .or_else(|_| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                    .map(|ndt| ndt.and_utc())
            })
            .unwrap_or_else(|_| Utc::now())
    }

    // --- Agents ---

    pub fn list_agents(&self, group: &str) -> Result<Vec<Agent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, description, created_at, last_seen, webhook FROM agents WHERE group_id = ?1 ORDER BY created_at ASC",
        )?;
        let agents: Vec<Agent> = stmt
            .query_map(params![group], |row| {
                let id: String = row.get(0)?;
                let desc: Option<String> = row.get(1)?;
                let ts: String = row.get(2)?;
                let ls: Option<String> = row.get(3)?;
                let wh: Option<String> = row.get(4)?;
                Ok((id, desc, ts, ls, wh))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?
            .into_iter()
            .map(|(id, desc, ts, ls, wh)| {
                let aliases = self.get_aliases_inner(&conn, group, &id);
                Agent {
                    id,
                    description: desc,
                    aliases,
                    created_at: Database::parse_ts(&ts),
                    last_seen: ls.map(|s| Database::parse_ts(&s)),
                    webhook: wh,
                    agent_token: None, // never expose in list
                }
            })
            .collect();
        Ok(agents)
    }

    pub fn register_agent(&self, group: &str, id: &str, aliases: Option<&[String]>, webhook: Option<&str>, description: Option<&str>) -> Result<Agent> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;

        // Generate token for new agents, preserve existing token
        let token = format!("atok-{}", Uuid::new_v4());

        tx.execute(
            "INSERT INTO agents (group_id, id, agent_token) VALUES (?1, ?2, ?3)
             ON CONFLICT(group_id, id) DO NOTHING",
            params![group, id, token],
        )?;

        if let Some(desc) = description {
            tx.execute(
                "UPDATE agents SET description = ?1 WHERE group_id = ?2 AND id = ?3",
                params![desc, group, id],
            )?;
        }

        if let Some(wh) = webhook {
            tx.execute(
                "UPDATE agents SET webhook = ?1 WHERE group_id = ?2 AND id = ?3",
                params![wh, group, id],
            )?;
        }

        if let Some(alias_list) = aliases {
            tx.execute("DELETE FROM agent_aliases WHERE group_id = ?1 AND agent_id = ?2", params![group, id])?;
            for alias in alias_list {
                tx.execute(
                    "INSERT OR REPLACE INTO agent_aliases (group_id, alias, agent_id) VALUES (?1, ?2, ?3)",
                    params![group, alias, id],
                )?;
            }
        }

        let (desc, ts, ls, wh, stored_token): (Option<String>, String, Option<String>, Option<String>, Option<String>) = tx.query_row(
            "SELECT description, created_at, last_seen, webhook, agent_token FROM agents WHERE group_id = ?1 AND id = ?2",
            params![group, id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )?;

        let agent_aliases = self.get_aliases_inner(&tx, group, id);

        tx.commit()?;

        Ok(Agent {
            id: id.to_string(),
            description: desc,
            aliases: agent_aliases,
            created_at: Database::parse_ts(&ts),
            last_seen: ls.map(|s| Database::parse_ts(&s)),
            webhook: wh,
            agent_token: stored_token, // include in registration response
        })
    }

    fn get_aliases_inner(&self, conn: &Connection, group: &str, agent_id: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT alias FROM agent_aliases WHERE group_id = ?1 AND agent_id = ?2")
            .unwrap();
        stmt.query_map(params![group, agent_id], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    }

    /// Resolve an agent ID or alias to the canonical agent ID
    pub fn resolve_agent(&self, group: &str, id_or_alias: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM agents WHERE group_id = ?1 AND id = ?2",
                params![group, id_or_alias],
                |row| row.get::<_, i64>(0),
            )
            .map(|c| c > 0)?;

        if exists {
            return Ok(Some(id_or_alias.to_string()));
        }

        conn.query_row(
            "SELECT agent_id FROM agent_aliases WHERE group_id = ?1 AND alias = ?2",
            params![group, id_or_alias],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(Into::into)
    }

    /// Resolve an agent token to (group, agent_id)
    pub fn resolve_agent_by_token(&self, token: &str) -> Result<Option<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT group_id, id FROM agents WHERE agent_token = ?1",
            params![token],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn get_agent(&self, group: &str, id: &str) -> Result<Option<Agent>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, description, created_at, last_seen, webhook FROM agents WHERE group_id = ?1 AND id = ?2",
            params![group, id],
            |row| {
                let id: String = row.get(0)?;
                let desc: Option<String> = row.get(1)?;
                let ts: String = row.get(2)?;
                let ls: Option<String> = row.get(3)?;
                let wh: Option<String> = row.get(4)?;
                Ok((id, desc, ts, ls, wh))
            },
        )
        .optional()?
        .map(|(id, desc, ts, ls, wh)| {
            let aliases = self.get_aliases_inner(&conn, group, &id);
            Ok(Agent {
                id,
                description: desc,
                aliases,
                created_at: Database::parse_ts(&ts),
                last_seen: ls.map(|s| Database::parse_ts(&s)),
                webhook: wh,
                agent_token: None, // never expose in get
            })
        })
        .transpose()
    }

    pub fn get_agent_webhook(&self, group: &str, agent_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT webhook FROM agents WHERE group_id = ?1 AND id = ?2",
            params![group, agent_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map(|o| o.flatten())
        .map_err(Into::into)
    }

    pub fn update_last_seen(&self, group: &str, agent_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE agents SET last_seen = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE group_id = ?1 AND id = ?2",
            params![group, agent_id],
        )?;
        Ok(())
    }

    pub fn delete_agent(&self, group: &str, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM agent_aliases WHERE group_id = ?1 AND agent_id = ?2", params![group, id])?;
        let deleted = conn.execute("DELETE FROM agents WHERE group_id = ?1 AND id = ?2", params![group, id])?;
        if deleted == 0 {
            anyhow::bail!("agent not found");
        }
        Ok(())
    }

    // --- Inbox ---

    pub fn send_inbox_message(
        &self,
        group: &str,
        thread_id: &str,
        from: &str,
        to: &str,
        msg_type: &str,
        content: Option<&serde_json::Value>,
    ) -> Result<InboxMessage> {
        let conn = self.conn.lock().unwrap();
        let msg_id = format!("imsg-{}", &Uuid::new_v4().to_string()[..16]);
        let content_str = content.map(|c| serde_json::to_string(c).unwrap_or_default());

        conn.execute(
            "INSERT INTO inbox_messages (id, group_id, thread_id, from_agent, to_agent, type, content) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![msg_id, group, thread_id, from, to, msg_type, content_str],
        )?;

        let ts: String = conn.query_row(
            "SELECT created_at FROM inbox_messages WHERE id = ?1",
            params![msg_id],
            |row| row.get(0),
        )?;

        Ok(InboxMessage {
            id: msg_id,
            thread_id: thread_id.to_string(),
            from_agent: from.to_string(),
            to_agent: to.to_string(),
            msg_type: msg_type.to_string(),
            content: content.cloned(),
            status: "unread".to_string(),
            created_at: Self::parse_ts(&ts),
        })
    }

    pub fn get_inbox_messages(
        &self,
        group: &str,
        agent_id: &str,
        status: Option<&str>,
        thread_id: Option<&str>,
    ) -> Result<Vec<InboxMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut query =
            "SELECT id, thread_id, from_agent, to_agent, type, content, status, created_at FROM inbox_messages WHERE group_id = ?1 AND to_agent = ?2"
                .to_string();
        let mut param_idx = 3;
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(group.to_string()), Box::new(agent_id.to_string())];

        if let Some(s) = status {
            query += &format!(" AND status = ?{}", param_idx);
            param_values.push(Box::new(s.to_string()));
            param_idx += 1;
        }
        if let Some(t) = thread_id {
            query += &format!(" AND thread_id = ?{}", param_idx);
            param_values.push(Box::new(t.to_string()));
        }
        query += " ORDER BY created_at ASC";

        let mut stmt = conn.prepare(&query)?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        let messages = stmt
            .query_map(params_ref.as_slice(), |row| {
                let content_str: Option<String> = row.get(5)?;
                let ts: String = row.get(7)?;
                Ok(InboxMessage {
                    id: row.get(0)?,
                    thread_id: row.get(1)?,
                    from_agent: row.get(2)?,
                    to_agent: row.get(3)?,
                    msg_type: row.get(4)?,
                    content: content_str
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    status: row.get(6)?,
                    created_at: Database::parse_ts(&ts),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(messages)
    }

    pub fn ack_inbox_message(&self, group: &str, message_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let updated = conn.execute(
            "UPDATE inbox_messages SET status = 'acked' WHERE id = ?1 AND group_id = ?2 AND status = 'unread'",
            params![message_id, group],
        )?;
        if updated == 0 {
            anyhow::bail!("message not found or already acked");
        }
        Ok(())
    }

    pub fn get_thread_messages(&self, group: &str, thread_id: &str) -> Result<Vec<InboxMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, thread_id, from_agent, to_agent, type, content, status, created_at
             FROM inbox_messages WHERE group_id = ?1 AND thread_id = ?2 ORDER BY created_at ASC",
        )?;
        let messages = stmt
            .query_map(params![group, thread_id], |row| {
                let content_str: Option<String> = row.get(5)?;
                let ts: String = row.get(7)?;
                Ok(InboxMessage {
                    id: row.get(0)?,
                    thread_id: row.get(1)?,
                    from_agent: row.get(2)?,
                    to_agent: row.get(3)?,
                    msg_type: row.get(4)?,
                    content: content_str
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    status: row.get(6)?,
                    created_at: Database::parse_ts(&ts),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(messages)
    }
}
