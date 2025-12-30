// ============================================
// SUPABASE SYNC MODULE
// Synchronise les données locales avec le cloud
// ============================================

use crate::config::*;
use crate::database::{Database, LocalScript};
use std::sync::Arc;
use tokio::time::{interval, Duration};

// ============================================
// SYNC STATUS
// ============================================
#[derive(Debug, Clone, serde::Serialize)]
pub enum SyncStatus {
    Synced,
    Syncing,
    Pending(usize),
    Offline,
    Error(String),
}

// ============================================
// SCRIPTS SYNC
// ============================================
pub async fn sync_scripts_from_supabase(db: &Arc<Database>) -> Result<usize, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/rest/v1/scripts?is_active=eq.true&select=*", SUPABASE_URL))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let scripts: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("JSON error: {}", e))?;

    let mut count = 0;
    for script in scripts {
        let local_script = LocalScript {
            id: script["id"].as_str().unwrap_or_default().to_string(),
            slug: script["slug"].as_str().unwrap_or_default().to_string(),
            name: script["name"].as_str().unwrap_or_default().to_string(),
            description: script["description"].as_str().map(|s| s.to_string()),
            category: script["category"].as_str().unwrap_or("general").to_string(),
            language: script["language"].as_str().unwrap_or("powershell").to_string(),
            code: script["code"].as_str().unwrap_or_default().to_string(),
            icon: script["icon"].as_str().map(|s| s.to_string()),
            is_active: script["is_active"].as_bool().unwrap_or(true),
            requires_admin: script["requires_admin"].as_bool().unwrap_or(false),
            estimated_time: script["estimated_time"].as_str().map(|s| s.to_string()),
            success_message: script["success_message"].as_str().map(|s| s.to_string()),
        };

        if !local_script.slug.is_empty() && !local_script.code.is_empty() {
            if let Err(e) = db.upsert_script(&local_script) {
                println!("[Sync] Error saving script {}: {}", local_script.slug, e);
            } else {
                count += 1;
            }
        }
    }

    println!("[Sync] Synced {} scripts from Supabase", count);
    Ok(count)
}

// ============================================
// DEVICE ID CACHE
// ============================================
pub async fn get_or_fetch_device_id(db: &Arc<Database>, device_token: &str) -> Result<String, String> {
    // Check cache first
    if let Ok(Some(cached_id)) = db.get_cache("device_id") {
        return Ok(cached_id);
    }

    // Fetch from Supabase
    let client = reqwest::Client::new();
    let response = client
        .get(format!(
            "{}/rest/v1/devices?device_token=eq.{}&select=id",
            SUPABASE_URL, device_token
        ))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let devices: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("JSON error: {}", e))?;

    if let Some(device) = devices.first() {
        if let Some(id) = device["id"].as_str() {
            // Cache for 1 hour
            let _ = db.set_cache("device_id", id, Some(60));
            return Ok(id.to_string());
        }
    }

    Err("Device not found".to_string())
}

// ============================================
// REMOTE EXECUTION CHECK (Optimized)
// ============================================
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct RemoteExecution {
    pub id: String,
    pub script_id: String,
    pub script_name: Option<String>,
    pub script_code: Option<String>,
    pub script_language: Option<String>,
    pub requested_by: Option<String>,
    pub status: String,
}

pub async fn check_remote_executions(db: &Arc<Database>, device_token: &str) -> Result<Vec<RemoteExecution>, String> {
    // Get cached device ID
    let device_id = match get_or_fetch_device_id(db, device_token).await {
        Ok(id) => id,
        Err(_) => return Ok(vec![]), // No device registered yet
    };

    let client = reqwest::Client::new();
    let response = client
        .get(format!(
            "{}/rest/v1/remote_executions?device_id=eq.{}&status=eq.authorized&select=id,script_id,status,scripts(name,code,language),requested_by",
            SUPABASE_URL, device_id
        ))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Ok(vec![]);
    }

    let executions: Vec<serde_json::Value> = response
        .json()
        .await
        .unwrap_or_default();

    let result: Vec<RemoteExecution> = executions
        .into_iter()
        .filter_map(|e| {
            let scripts = e.get("scripts")?;
            Some(RemoteExecution {
                id: e["id"].as_str()?.to_string(),
                script_id: e["script_id"].as_str()?.to_string(),
                script_name: scripts["name"].as_str().map(|s| s.to_string()),
                script_code: scripts["code"].as_str().map(|s| s.to_string()),
                script_language: scripts["language"].as_str().map(|s| s.to_string()),
                requested_by: e["requested_by"].as_str().map(|s| s.to_string()),
                status: e["status"].as_str()?.to_string(),
            })
        })
        .collect();

    Ok(result)
}

// ============================================
// UPDATE REMOTE EXECUTION STATUS
// ============================================
pub async fn update_remote_execution(
    execution_id: &str,
    status: &str,
    output: Option<&str>,
    error: Option<&str>,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let mut payload = serde_json::json!({
        "status": status,
    });

    if let Some(out) = output {
        payload["output"] = serde_json::Value::String(out.chars().take(10000).collect());
    }
    if let Some(err) = error {
        payload["error"] = serde_json::Value::String(err.chars().take(5000).collect());
    }
    if status == "completed" || status == "failed" {
        payload["executed_at"] = serde_json::Value::String(chrono::Utc::now().to_rfc3339());
    }

    let response = client
        .patch(format!("{}/rest/v1/remote_executions?id=eq.{}", SUPABASE_URL, execution_id))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("API error: {}", response.status()))
    }
}

// ============================================
// BACKGROUND SYNC LOOP
// ============================================
pub fn start_sync_loop(db: Arc<Database>) {
    tauri::async_runtime::spawn(async move {
        // Initial sync after 5 seconds
        tokio::time::sleep(Duration::from_secs(5)).await;

        // Sync scripts on startup
        if let Err(e) = sync_scripts_from_supabase(&db).await {
            println!("[Sync] Initial scripts sync failed: {}", e);
        }

        // Periodic sync every 5 minutes
        let mut ticker = interval(Duration::from_secs(300));

        loop {
            ticker.tick().await;

            // Sync scripts
            if let Err(e) = sync_scripts_from_supabase(&db).await {
                println!("[Sync] Scripts sync failed: {}", e);
            }

            // Cleanup old data
            if let Err(e) = db.cleanup_old_metrics() {
                println!("[Sync] Metrics cleanup failed: {}", e);
            }
            if let Err(e) = db.cleanup_expired_cache() {
                println!("[Sync] Cache cleanup failed: {}", e);
            }
        }
    });
}

// ============================================
// ONLINE STATUS CHECK
// ============================================
pub async fn check_online_status() -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    match client.get(format!("{}/rest/v1/", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success() || resp.status().as_u16() == 400,
        Err(_) => false,
    }
}
