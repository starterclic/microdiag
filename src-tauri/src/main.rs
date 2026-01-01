// ============================================
// MICRODIAG SENTINEL AGENT - v2.5.0
// Production Ready - Local-First Architecture
// Tauri v2 Migration
// ============================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod metrics;
mod security;
mod database;
mod sync;
mod godmode;

use config::*;
use metrics::*;
use security::*;
use database::{Database, LocalScript, LocalMetrics, ChatMessage};
use sync::*;

use serde::{Deserialize, Serialize};
use sysinfo::System;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::path::PathBuf;
use std::fs;
use tauri::{
    Manager, AppHandle, Emitter,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
};
use tauri_plugin_notification::NotificationExt;
use tokio::time::interval;

// ============================================
// DEVICE TOKEN PERSISTENCE
// ============================================
fn get_device_token_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("Microdiag");
    let _ = fs::create_dir_all(&path);
    path.push("device_token.txt");
    path
}

fn load_or_create_device_token() -> String {
    let path = get_device_token_path();

    // Try to load existing token
    if let Ok(token) = fs::read_to_string(&path) {
        let token = token.trim().to_string();
        if !token.is_empty() && token.starts_with("mdiag_") {
            println!("[Device] Token loaded: {}", &token[..20]);
            return token;
        }
    }

    // Generate new persistent token
    let new_token = format!("mdiag_{}", uuid::Uuid::new_v4());
    if let Err(e) = fs::write(&path, &new_token) {
        println!("[Device] Warning: Could not save token: {}", e);
    } else {
        println!("[Device] New token created: {}", &new_token[..20]);
    }
    new_token
}

// ============================================
// STATE
// ============================================
struct AppState {
    system: Mutex<System>,
    device_token: Mutex<String>,
    heartbeat_running: Mutex<bool>,
    db: Arc<Database>,
}

// ============================================
// PAYLOADS
// ============================================
#[derive(Serialize, Debug)]
struct HeartbeatPayload {
    device_token: String,
    hostname: String,
    os_type: String,
    os_version: String,
    status: String,
    metrics: serde_json::Value,
    specs: serde_json::Value,
    security: serde_json::Value,
    deep_health: serde_json::Value,
    agent_version: String,
}

#[derive(Deserialize, Debug)]
struct AgentCommand {
    id: String,
    command_type: String,
    script_id: Option<String>,
    parameters: Option<serde_json::Value>,
}

// ============================================
// TAURI COMMANDS
// ============================================
#[tauri::command]
fn get_system_metrics(state: tauri::State<Arc<AppState>>) -> Result<SystemMetrics, String> {
    // Try to get real metrics, fallback to test values
    match state.system.lock() {
        Ok(mut sys) => {
            sys.refresh_cpu();
            sys.refresh_memory();

            let cpu_usage = {
                let cpus = sys.cpus();
                if cpus.is_empty() { 25.0 } else {
                    cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
                }
            };

            let memory_total = sys.total_memory();
            let memory_used = sys.used_memory();
            let memory_percent = if memory_total > 0 {
                (memory_used as f64 / memory_total as f64 * 100.0) as f32
            } else { 50.0 };

            // Get disk info
            let disks = sysinfo::Disks::new_with_refreshed_list();
            let disk_infos: Vec<DiskInfo> = disks.iter().map(|disk| {
                let total = disk.total_space() as f64;
                let available = disk.available_space() as f64;
                let used = total - available;
                DiskInfo {
                    name: disk.name().to_string_lossy().to_string(),
                    mount_point: disk.mount_point().to_string_lossy().to_string(),
                    total_gb: total / 1_073_741_824.0,
                    used_gb: used / 1_073_741_824.0,
                    free_gb: available / 1_073_741_824.0,
                    percent: if total > 0.0 { (used / total * 100.0) as f32 } else { 0.0 },
                }
            }).collect();

            Ok(SystemMetrics {
                cpu_usage,
                memory_total,
                memory_used,
                memory_percent,
                disks: disk_infos,
                hostname: sysinfo::System::host_name().unwrap_or_else(|| "PC".to_string()),
                os_version: sysinfo::System::os_version().unwrap_or_default(),
            })
        },
        Err(_) => {
            // Fallback test values
            Ok(SystemMetrics {
                cpu_usage: 30.0,
                memory_total: 16_000_000_000,
                memory_used: 8_000_000_000,
                memory_percent: 50.0,
                disks: vec![],
                hostname: "PC".to_string(),
                os_version: "Windows".to_string(),
            })
        }
    }
}

#[tauri::command]
fn get_health_score(state: tauri::State<Arc<AppState>>) -> Result<HealthScore, String> {
    // Simple health score based on metrics
    let metrics = get_system_metrics(state)?;
    Ok(metrics.calculate_health())
}

#[tauri::command]
fn get_security_status() -> Result<SecurityStatus, String> {
    Ok(SecurityStatus::check())
}

#[tauri::command]
fn get_device_token(state: tauri::State<Arc<AppState>>) -> String {
    state.device_token.lock().unwrap().clone()
}

// Hide console window on Windows
#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
async fn run_script(_script_id: String, code: String, language: String) -> Result<String, String> {
    use std::process::Command;
    use std::fs;
    use std::env;

    // Create temp file with script in system temp directory
    let ext = match language.as_str() {
        "powershell" => ".ps1",
        "python" => ".py",
        "batch" => ".bat",
        _ => return Err("Langage non supporté".to_string()),
    };

    // Use system temp dir with simple filename (avoids encoding issues)
    let temp_dir = env::temp_dir();
    let filename = format!("mdiag_script_{}{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..8].to_string(), ext);
    let path = temp_dir.join(&filename);
    let path_str = path.to_string_lossy().to_string();

    // Write script content
    fs::write(&path, code.as_bytes()).map_err(|e| format!("Erreur écriture: {}", e))?;

    #[cfg(windows)]
    let output = match language.as_str() {
        "powershell" => Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &path_str])
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        "python" => Command::new("python")
            .arg(&path_str)
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        "batch" => Command::new("cmd")
            .args(["/C", &path_str])
            .creation_flags(CREATE_NO_WINDOW)
            .output(),
        _ => return Err("Langage non supporté".to_string()),
    }.map_err(|e| format!("Erreur: {}", e))?;

    #[cfg(not(windows))]
    let output = match language.as_str() {
        "powershell" => Command::new("pwsh")
            .args(["-NoProfile", "-File", &path_str])
            .output(),
        "python" => Command::new("python3").arg(&path_str).output(),
        "batch" => Command::new("bash").arg(&path_str).output(),
        _ => return Err("Langage non supporté".to_string()),
    }.map_err(|e| format!("Erreur: {}", e))?;

    // Clean up temp file
    let _ = fs::remove_file(&path);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn send_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_security_scan() -> Result<serde_json::Value, String> {
    use std::process::Command;

    let scan_script = include_str!("../../scripts/full_security_scan.ps1");

    // Write script to temp and execute
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("mdiag_security_scan.ps1");
    std::fs::write(&script_path, scan_script).map_err(|e| format!("Erreur ecriture: {}", e))?;

    #[cfg(windows)]
    let output = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &script_path.to_string_lossy()])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Erreur execution: {}", e))?;

    #[cfg(not(windows))]
    let output = Command::new("pwsh")
        .args(["-NoProfile", "-File", &script_path.to_string_lossy()])
        .output()
        .map_err(|e| format!("Erreur execution: {}", e))?;

    let _ = std::fs::remove_file(&script_path);

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Find JSON line (starts with '{' and ends with '}')
    let json_str = stdout
        .lines()
        .find(|line| line.trim().starts_with('{') && line.trim().ends_with('}'))
        .or_else(|| stdout.lines().last())
        .unwrap_or("{}");

    // Try to parse JSON
    match serde_json::from_str::<serde_json::Value>(json_str) {
        Ok(json) => Ok(json),
        Err(e) => {
            // Return debug info if parsing fails
            Err(format!("Parse error: {}. Exit: {}. Stderr: {}", e, output.status, stderr))
        }
    }
}

// ============================================
// LOCAL-FIRST DATABASE COMMANDS
// ============================================

#[tauri::command]
fn db_get_scripts(state: tauri::State<Arc<AppState>>) -> Result<Vec<LocalScript>, String> {
    state.db.get_all_scripts().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_scripts_by_category(state: tauri::State<Arc<AppState>>, category: String) -> Result<Vec<LocalScript>, String> {
    state.db.get_scripts_by_category(&category).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_scripts_count(state: tauri::State<Arc<AppState>>) -> Result<i32, String> {
    state.db.get_scripts_count().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save_metrics(state: tauri::State<Arc<AppState>>, metrics: LocalMetrics) -> Result<i64, String> {
    state.db.save_metrics(&metrics).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_recent_metrics(state: tauri::State<Arc<AppState>>, limit: i32) -> Result<Vec<LocalMetrics>, String> {
    state.db.get_recent_metrics(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_chat_history(state: tauri::State<Arc<AppState>>, limit: i32) -> Result<Vec<ChatMessage>, String> {
    state.db.get_chat_history(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_add_chat_message(state: tauri::State<Arc<AppState>>, role: String, content: String) -> Result<i64, String> {
    state.db.add_chat_message(&role, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_clear_chat(state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    state.db.clear_chat_history().map_err(|e| e.to_string())
}

#[tauri::command]
fn db_get_setting(state: tauri::State<Arc<AppState>>, key: String) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_set_setting(state: tauri::State<Arc<AppState>>, key: String, value: String) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
async fn db_sync_scripts(state: tauri::State<'_, Arc<AppState>>) -> Result<usize, String> {
    sync_scripts_from_supabase(&state.db).await
}

#[tauri::command]
async fn db_check_online() -> Result<bool, String> {
    Ok(check_online_status().await)
}

#[tauri::command]
async fn db_check_remote_executions(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<RemoteExecution>, String> {
    let device_token = state.device_token.lock().unwrap().clone();
    check_remote_executions(&state.db, &device_token).await
}

#[tauri::command]
async fn db_update_remote_execution(
    id: String,
    status: String,
    output: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    update_remote_execution(&id, &status, output.as_deref(), error.as_deref()).await
}

// ============================================
// GOD MODE COMMANDS (Native Performance)
// ============================================

#[tauri::command]
fn gm_get_installed_apps() -> Vec<godmode::InstalledApp> {
    godmode::get_installed_apps_native()
}

#[tauri::command]
fn gm_get_deep_health() -> godmode::DeepHealth {
    godmode::get_deep_health()
}

#[tauri::command]
fn gm_get_startup_items() -> Vec<godmode::StartupItem> {
    godmode::get_startup_items()
}

#[tauri::command]
fn gm_disable_startup_item(name: String, location: String) -> godmode::TweakResult {
    godmode::disable_startup_item(&name, &location)
}

#[tauri::command]
async fn gm_check_updates() -> Vec<godmode::OutdatedApp> {
    godmode::check_winget_updates().await
}

#[tauri::command]
async fn gm_install_apps(app_ids: Vec<String>) -> godmode::TweakResult {
    godmode::install_winget_apps(app_ids).await
}

#[tauri::command]
async fn gm_update_all() -> godmode::TweakResult {
    godmode::update_all_winget().await
}

#[tauri::command]
fn gm_apply_tweak(tweak_id: String, enable: bool) -> godmode::TweakResult {
    godmode::apply_privacy_tweak(&tweak_id, enable)
}

#[tauri::command]
async fn gm_ghost_mode() -> godmode::TweakResult {
    godmode::activate_ghost_mode().await
}

#[tauri::command]
fn gm_list_backups() -> Vec<godmode::RegBackup> {
    godmode::list_backups()
}

#[tauri::command]
fn gm_restore_backup(backup_path: String) -> godmode::TweakResult {
    godmode::restore_backup(&backup_path)
}

// ============================================
// HEARTBEAT
// ============================================
async fn send_heartbeat(device_token: &str, metrics: &SystemMetrics, health: &HealthScore, security: &SecurityStatus, deep_health: &godmode::DeepHealth) -> Result<(), String> {
    let client = reqwest::Client::new();

    let payload = HeartbeatPayload {
        device_token: device_token.to_string(),
        hostname: metrics.hostname.clone(),
        os_type: "windows".to_string(),
        os_version: metrics.os_version.clone(),
        status: health.status.clone(),
        metrics: serde_json::json!({
            "cpu_usage": metrics.cpu_usage,
            "ram_usage": metrics.memory_percent,
            "disk_usage": metrics.disks.first().map(|d| d.percent).unwrap_or(0.0),
        }),
        specs: serde_json::json!({
            "cpu": "Auto-detected",
            "ram_total": format!("{} GB", metrics.memory_total / 1_073_741_824),
            "disk_total": format!("{:.0} GB", metrics.disks.first().map(|d| d.total_gb).unwrap_or(0.0)),
        }),
        security: serde_json::json!({
            "antivirus": security.antivirus_enabled,
            "realtime": security.realtime_protection,
            "firewall": security.firewall_enabled,
            "issues": security.issues,
        }),
        deep_health: serde_json::json!({
            "disk_model": deep_health.disk_model,
            "disk_smart_status": deep_health.disk_smart_status,
            "bios_serial": deep_health.bios_serial,
            "bios_manufacturer": deep_health.bios_manufacturer,
            "computer_name": deep_health.computer_name,
            "battery": {
                "is_present": deep_health.battery.is_present,
                "charge_percent": deep_health.battery.charge_percent,
                "health_percent": deep_health.battery.health_percent,
                "status": deep_health.battery.status,
            }
        }),
        agent_version: AGENT_VERSION.to_string(),
    };

    let response = client
        .post(format!("{}/functions/v1/heartbeat", SUPABASE_URL))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status().is_success() {
        println!("[Heartbeat] OK");
        Ok(())
    } else {
        let err = response.text().await.unwrap_or_default();
        println!("[Heartbeat] Error: {}", err);
        Err(err)
    }
}

async fn send_security_log(device_token: &str, log: &SecurityLog) -> Result<(), String> {
    let client = reqwest::Client::new();

    let payload = serde_json::json!({
        "device_token": device_token,
        "severity": log.severity,
        "category": log.category,
        "message": log.message,
        "details": log.details,
    });

    client
        .post(format!("{}/rest/v1/security_logs", SUPABASE_URL))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error: {}", e))?;

    Ok(())
}

async fn check_pending_commands(device_token: &str) -> Vec<AgentCommand> {
    let client = reqwest::Client::new();

    let result = client
        .get(format!(
            "{}/rest/v1/agent_commands?device_id=eq.{}&status=eq.pending&select=id,command_type,script_id,parameters",
            SUPABASE_URL, device_token
        ))
        .header("Authorization", format!("Bearer {}", SUPABASE_ANON_KEY))
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await;

    match result {
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

// ============================================
// BACKGROUND LOOPS
// ============================================
fn start_heartbeat_loop(app_handle: AppHandle, state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));

        loop {
            ticker.tick().await;

            let running = *state.heartbeat_running.lock().unwrap();
            if !running { continue; }

            // Collect metrics
            let metrics = {
                let mut sys = state.system.lock().unwrap();
                SystemMetrics::collect(&mut sys)
            };
            let health = metrics.calculate_health();
            let security = SecurityStatus::check();
            let deep_health = godmode::get_deep_health();
            let device_token = state.device_token.lock().unwrap().clone();

            // Send heartbeat with deep health info
            let _ = send_heartbeat(&device_token, &metrics, &health, &security, &deep_health).await;

            // Log security issues
            if let Some(log) = SecurityLog::from_status(&security) {
                let _ = send_security_log(&device_token, &log).await;
            }

            // Emit critical events
            if health.status == "critical" || security.is_critical() {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit("health-critical", serde_json::json!({
                        "health": health,
                        "security": security
                    }));
                }
            }
        }
    });
}

fn start_command_loop(state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_secs(COMMAND_POLL_INTERVAL_SECS));

        loop {
            ticker.tick().await;

            let device_token = state.device_token.lock().unwrap().clone();
            let commands = check_pending_commands(&device_token).await;

            for cmd in commands {
                println!("[Command] Received: {:?}", cmd);
                // TODO: Execute command and update status
            }
        }
    });
}

// ============================================
// MAIN
// ============================================
fn main() {
    // Initialize Local-First SQLite database
    let db = Arc::new(Database::new().expect("Failed to initialize database"));
    println!("[Microdiag] SQLite database initialized");

    // Load or create persistent device token (ONCE)
    let device_token = load_or_create_device_token();

    // Initialize sysinfo - fast startup, metrics refresh on first call
    let system = System::new();
    println!("[Microdiag] System info initialized");

    // Create SINGLE shared state
    let state = Arc::new(AppState {
        system: Mutex::new(system),
        device_token: Mutex::new(device_token),
        heartbeat_running: Mutex::new(true),
        db: Arc::clone(&db),
    });

    let state_for_manage = Arc::clone(&state);
    let state_heartbeat = Arc::clone(&state);
    let state_commands = Arc::clone(&state);
    let db_for_sync = Arc::clone(&db);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let handle = app.handle().clone();

            // Build tray menu
            let menu = Menu::with_items(app, &[
                &MenuItem::with_id(app, "dashboard", "Ouvrir Dashboard", true, None::<&str>)?,
                &MenuItem::with_id(app, "scan", "Lancer Scan", true, None::<&str>)?,
                &MenuItem::with_id(app, "status", "Status: En ligne", false, None::<&str>)?,
                &MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?,
            ])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "dashboard" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "scan" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.emit("run-scan", ());
                            }
                        }
                        "quit" => std::process::exit(0),
                        _ => {}
                    }
                })
                .build(app)?;

            // Start background loops with shared state
            start_heartbeat_loop(handle.clone(), Arc::clone(&state_heartbeat));
            start_command_loop(Arc::clone(&state_commands));

            // Start background sync with Supabase (delayed)
            start_sync_loop(Arc::clone(&db_for_sync));
            println!("[Microdiag] Background sync started");

            // Force window to front after startup
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    let _ = window.show();
                    let _ = window.set_focus();
                });
            }

            println!("[Microdiag] Agent v{} started (Local-First + Tauri v2)", AGENT_VERSION);
            Ok(())
        })
        .manage(state_for_manage)
        .invoke_handler(tauri::generate_handler![
            // System commands
            get_system_metrics,
            get_health_score,
            get_security_status,
            get_device_token,
            run_script,
            send_notification,
            run_security_scan,
            // Local-First database commands
            db_get_scripts,
            db_get_scripts_by_category,
            db_get_scripts_count,
            db_save_metrics,
            db_get_recent_metrics,
            db_get_chat_history,
            db_add_chat_message,
            db_clear_chat,
            db_get_setting,
            db_set_setting,
            db_sync_scripts,
            db_check_online,
            db_check_remote_executions,
            db_update_remote_execution,
            // God Mode commands (Native Performance)
            gm_get_installed_apps,
            gm_get_deep_health,
            gm_get_startup_items,
            gm_disable_startup_item,
            gm_check_updates,
            gm_install_apps,
            gm_update_all,
            gm_apply_tweak,
            gm_ghost_mode,
            gm_list_backups,
            gm_restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("Error starting application");
}
