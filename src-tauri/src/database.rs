// ============================================
// LOCAL-FIRST SQLITE DATABASE
// ============================================

use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

// ============================================
// DATABASE PATH
// ============================================
pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("Microdiag");
    let _ = std::fs::create_dir_all(&path);
    path.push("microdiag.db");
    path
}

// ============================================
// DATABASE STATE
// ============================================
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> SqlResult<Self> {
        let path = get_db_path();
        println!("[DB] Opening database at: {:?}", path);
        let conn = Connection::open(&path)?;

        let db = Database {
            conn: Mutex::new(conn),
        };

        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();

        // Scripts table - local cache of Supabase scripts
        conn.execute(
            "CREATE TABLE IF NOT EXISTS scripts (
                id TEXT PRIMARY KEY,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'powershell',
                code TEXT NOT NULL,
                icon TEXT,
                is_active INTEGER DEFAULT 1,
                requires_admin INTEGER DEFAULT 0,
                estimated_time TEXT,
                success_message TEXT,
                created_at TEXT,
                updated_at TEXT,
                synced_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Metrics history - local storage for offline
        conn.execute(
            "CREATE TABLE IF NOT EXISTS metrics_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                cpu_usage REAL,
                memory_percent REAL,
                disk_percent REAL,
                health_score INTEGER,
                health_status TEXT,
                synced INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Sync queue - pending operations for Supabase
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                operation TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                retry_count INTEGER DEFAULT 0,
                last_error TEXT
            )",
            [],
        )?;

        // Settings - local app settings
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Device cache - cached device info from Supabase
        conn.execute(
            "CREATE TABLE IF NOT EXISTS device_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at TEXT
            )",
            [],
        )?;

        // Chat history - local chat messages
        conn.execute(
            "CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create indexes for performance
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scripts_active ON scripts(is_active)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_synced ON metrics_history(synced)", [])?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name)", [])?;

        println!("[DB] Schema initialized");
        Ok(())
    }
}

// ============================================
// SCRIPT MODELS
// ============================================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalScript {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub language: String,
    pub code: String,
    pub icon: Option<String>,
    pub is_active: bool,
    pub requires_admin: bool,
    pub estimated_time: Option<String>,
    pub success_message: Option<String>,
}

// ============================================
// SCRIPT OPERATIONS
// ============================================
impl Database {
    pub fn get_all_scripts(&self) -> SqlResult<Vec<LocalScript>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, slug, name, description, category, language, code, icon,
                    is_active, requires_admin, estimated_time, success_message
             FROM scripts WHERE is_active = 1 ORDER BY category, name"
        )?;

        let scripts = stmt.query_map([], |row| {
            Ok(LocalScript {
                id: row.get(0)?,
                slug: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                language: row.get(5)?,
                code: row.get(6)?,
                icon: row.get(7)?,
                is_active: row.get::<_, i32>(8)? == 1,
                requires_admin: row.get::<_, i32>(9)? == 1,
                estimated_time: row.get(10)?,
                success_message: row.get(11)?,
            })
        })?;

        scripts.collect()
    }

    pub fn get_scripts_by_category(&self, category: &str) -> SqlResult<Vec<LocalScript>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, slug, name, description, category, language, code, icon,
                    is_active, requires_admin, estimated_time, success_message
             FROM scripts WHERE is_active = 1 AND category = ?1 ORDER BY name"
        )?;

        let scripts = stmt.query_map([category], |row| {
            Ok(LocalScript {
                id: row.get(0)?,
                slug: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                language: row.get(5)?,
                code: row.get(6)?,
                icon: row.get(7)?,
                is_active: row.get::<_, i32>(8)? == 1,
                requires_admin: row.get::<_, i32>(9)? == 1,
                estimated_time: row.get(10)?,
                success_message: row.get(11)?,
            })
        })?;

        scripts.collect()
    }

    pub fn upsert_script(&self, script: &LocalScript) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO scripts
             (id, slug, name, description, category, language, code, icon,
              is_active, requires_admin, estimated_time, success_message, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CURRENT_TIMESTAMP)",
            params![
                script.id,
                script.slug,
                script.name,
                script.description,
                script.category,
                script.language,
                script.code,
                script.icon,
                script.is_active as i32,
                script.requires_admin as i32,
                script.estimated_time,
                script.success_message,
            ],
        )?;
        Ok(())
    }

    pub fn get_scripts_count(&self) -> SqlResult<i32> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT COUNT(*) FROM scripts WHERE is_active = 1", [], |row| row.get(0))
    }
}

// ============================================
// METRICS OPERATIONS
// ============================================
#[derive(Debug, Serialize, Deserialize)]
pub struct LocalMetrics {
    pub id: Option<i64>,
    pub timestamp: String,
    pub cpu_usage: f32,
    pub memory_percent: f32,
    pub disk_percent: f32,
    pub health_score: i32,
    pub health_status: String,
    pub synced: bool,
}

impl Database {
    pub fn save_metrics(&self, metrics: &LocalMetrics) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO metrics_history (cpu_usage, memory_percent, disk_percent, health_score, health_status)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                metrics.cpu_usage,
                metrics.memory_percent,
                metrics.disk_percent,
                metrics.health_score,
                metrics.health_status,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_recent_metrics(&self, limit: i32) -> SqlResult<Vec<LocalMetrics>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, cpu_usage, memory_percent, disk_percent, health_score, health_status, synced
             FROM metrics_history ORDER BY timestamp DESC LIMIT ?1"
        )?;

        let metrics = stmt.query_map([limit], |row| {
            Ok(LocalMetrics {
                id: Some(row.get(0)?),
                timestamp: row.get(1)?,
                cpu_usage: row.get(2)?,
                memory_percent: row.get(3)?,
                disk_percent: row.get(4)?,
                health_score: row.get(5)?,
                health_status: row.get(6)?,
                synced: row.get::<_, i32>(7)? == 1,
            })
        })?;

        metrics.collect()
    }

    pub fn get_unsynced_metrics(&self) -> SqlResult<Vec<LocalMetrics>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, cpu_usage, memory_percent, disk_percent, health_score, health_status, synced
             FROM metrics_history WHERE synced = 0 ORDER BY timestamp ASC LIMIT 100"
        )?;

        let metrics = stmt.query_map([], |row| {
            Ok(LocalMetrics {
                id: Some(row.get(0)?),
                timestamp: row.get(1)?,
                cpu_usage: row.get(2)?,
                memory_percent: row.get(3)?,
                disk_percent: row.get(4)?,
                health_score: row.get(5)?,
                health_status: row.get(6)?,
                synced: row.get::<_, i32>(7)? == 1,
            })
        })?;

        metrics.collect()
    }

    pub fn mark_metrics_synced(&self, ids: &[i64]) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute("UPDATE metrics_history SET synced = 1 WHERE id = ?1", [id])?;
        }
        Ok(())
    }

    // Cleanup old metrics (keep last 7 days)
    pub fn cleanup_old_metrics(&self) -> SqlResult<usize> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM metrics_history WHERE timestamp < datetime('now', '-7 days') AND synced = 1",
            [],
        )
    }
}

// ============================================
// CACHE OPERATIONS
// ============================================
impl Database {
    pub fn set_cache(&self, key: &str, value: &str, ttl_minutes: Option<i32>) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let expires = ttl_minutes.map(|m| format!("datetime('now', '+{} minutes')", m));

        conn.execute(
            "INSERT OR REPLACE INTO device_cache (key, value, expires_at) VALUES (?1, ?2, ?3)",
            params![key, value, expires],
        )?;
        Ok(())
    }

    pub fn get_cache(&self, key: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM device_cache WHERE key = ?1 AND (expires_at IS NULL OR expires_at > datetime('now'))",
            [key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_cache(&self, key: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM device_cache WHERE key = ?1", [key])?;
        Ok(())
    }

    pub fn cleanup_expired_cache(&self) -> SqlResult<usize> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM device_cache WHERE expires_at < datetime('now')", [])
    }
}

// ============================================
// SETTINGS OPERATIONS
// ============================================
impl Database {
    pub fn set_setting(&self, key: &str, value: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

// ============================================
// SYNC QUEUE OPERATIONS
// ============================================
#[derive(Debug, Serialize, Deserialize)]
pub struct SyncQueueItem {
    pub id: i64,
    pub table_name: String,
    pub operation: String,
    pub data: String,
    pub created_at: String,
    pub retry_count: i32,
    pub last_error: Option<String>,
}

impl Database {
    pub fn add_to_sync_queue(&self, table_name: &str, operation: &str, data: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sync_queue (table_name, operation, data) VALUES (?1, ?2, ?3)",
            params![table_name, operation, data],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_pending_sync_items(&self, limit: i32) -> SqlResult<Vec<SyncQueueItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, table_name, operation, data, created_at, retry_count, last_error
             FROM sync_queue WHERE retry_count < 5 ORDER BY created_at ASC LIMIT ?1"
        )?;

        let items = stmt.query_map([limit], |row| {
            Ok(SyncQueueItem {
                id: row.get(0)?,
                table_name: row.get(1)?,
                operation: row.get(2)?,
                data: row.get(3)?,
                created_at: row.get(4)?,
                retry_count: row.get(5)?,
                last_error: row.get(6)?,
            })
        })?;

        items.collect()
    }

    pub fn mark_sync_success(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM sync_queue WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn mark_sync_failed(&self, id: i64, error: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ?2 WHERE id = ?1",
            params![id, error],
        )?;
        Ok(())
    }
}

// ============================================
// CHAT HISTORY OPERATIONS
// ============================================
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: Option<i64>,
    pub role: String,
    pub content: String,
    pub timestamp: Option<String>,
}

impl Database {
    pub fn add_chat_message(&self, role: &str, content: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chat_history (role, content) VALUES (?1, ?2)",
            params![role, content],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_chat_history(&self, limit: i32) -> SqlResult<Vec<ChatMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, role, content, timestamp FROM chat_history ORDER BY timestamp DESC LIMIT ?1"
        )?;

        let messages = stmt.query_map([limit], |row| {
            Ok(ChatMessage {
                id: Some(row.get(0)?),
                role: row.get(1)?,
                content: row.get(2)?,
                timestamp: Some(row.get(3)?),
            })
        })?;

        // Reverse to get chronological order
        let mut result: Vec<ChatMessage> = messages.collect::<SqlResult<Vec<_>>>()?;
        result.reverse();
        Ok(result)
    }

    pub fn clear_chat_history(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM chat_history", [])?;
        Ok(())
    }
}
