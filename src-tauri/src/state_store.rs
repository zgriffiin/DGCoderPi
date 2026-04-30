use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::model::{
    AppEvent, AppHealth, AppIntegrations, AppSettings, AppSnapshot, AppUpdate, AttachmentKind,
    AttachmentRecord, AttachmentStage, CodexStatus, FeatureSettings, ModelOption, PersistedState,
    ProjectRecord, ProviderStatus, ThreadRecord, ThreadStatus,
};

const LEGACY_STATE_FILE_NAME: &str = "app-state.json";
const STATE_DB_FILE_NAME: &str = "app-state.sqlite";
const CURRENT_STATE_KEY: i64 = 1;

pub fn load_state(data_dir: &Path) -> Result<PersistedState, String> {
    let connection = open_state_db(data_dir)?;
    if let Some(state) = load_current_state(&connection)? {
        return Ok(state);
    }

    let file_path = legacy_state_file_path(data_dir);
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
        let mut state =
            serde_json::from_str::<PersistedState>(&content).map_err(|error| error.to_string())?;
        if state.settings.providers.is_empty() {
            state.settings.providers = default_providers();
        }
        replace_state(data_dir, &state)?;
        return Ok(state);
    }

    Ok(default_state())
}

pub fn append_update(
    data_dir: &Path,
    update: &AppUpdate,
    state: &PersistedState,
) -> Result<(), String> {
    let persisted_events = update
        .events
        .iter()
        .filter(|event| is_persisted_event(event))
        .collect::<Vec<_>>();
    if persisted_events.is_empty() {
        return Ok(());
    }

    let mut connection = open_state_db(data_dir)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    for event in persisted_events {
        transaction
            .execute(
                "INSERT INTO event_log (created_at_ms, event_type, payload_json) VALUES (?1, ?2, ?3)",
                params![now_ms() as i64, event_type(event), serde_json::to_string(event).map_err(|error| error.to_string())?],
            )
            .map_err(|error| error.to_string())?;
    }
    write_current_state(&transaction, state)?;
    transaction.commit().map_err(|error| error.to_string())
}

pub fn replace_state(data_dir: &Path, state: &PersistedState) -> Result<(), String> {
    let mut connection = open_state_db(data_dir)?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    write_current_state(&transaction, state)?;
    transaction.commit().map_err(|error| error.to_string())
}

pub fn state_db_path(data_dir: &Path) -> PathBuf {
    data_dir.join(STATE_DB_FILE_NAME)
}

pub fn attachment_directory(data_dir: &Path) -> PathBuf {
    data_dir.join("attachments")
}

pub fn new_project(path: &str) -> ProjectRecord {
    let name = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path)
        .to_string();

    ProjectRecord {
        branch: git_branch(path),
        id: Uuid::new_v4().to_string(),
        name,
        path: path.to_string(),
        threads: Vec::new(),
    }
}

pub fn new_thread(title: &str, branch: &str, model_key: Option<String>) -> ThreadRecord {
    ThreadRecord {
        branch: branch.to_string(),
        id: Uuid::new_v4().to_string(),
        model_key,
        reasoning_level: crate::model::ThinkingLevel::Medium,
        status: ThreadStatus::Idle,
        title: title.to_string(),
        updated_at_ms: now_ms(),
        ..ThreadRecord::default()
    }
}

pub fn build_snapshot(
    state: &PersistedState,
    models: Vec<ModelOption>,
    bridge_status: &str,
    codex_status: CodexStatus,
) -> AppSnapshot {
    let configured_provider_count = state
        .settings
        .providers
        .iter()
        .filter(|provider| provider.configured)
        .count();

    AppSnapshot {
        health: AppHealth {
            bridge_status: bridge_status.to_string(),
            configured_provider_count,
            model_count: models.len(),
        },
        integrations: AppIntegrations {
            codex: codex_status,
        },
        models,
        projects: state.projects.clone(),
        selected_project_id: state.selected_project_id.clone(),
        selected_thread_id: state.selected_thread_id.clone(),
        settings: state.settings.clone(),
    }
}

pub fn default_providers() -> Vec<ProviderStatus> {
    [
        ("anthropic", "Anthropic"),
        ("openai-codex", "ChatGPT Codex"),
        ("openai", "OpenAI"),
        ("google", "Google Gemini"),
        ("deepseek", "DeepSeek"),
        ("openrouter", "OpenRouter"),
    ]
    .into_iter()
    .map(|(provider, label)| ProviderStatus {
        configured: false,
        label: label.to_string(),
        provider: provider.to_string(),
        source: None,
    })
    .collect()
}

pub fn classify_attachment(name: &str, mime_type: &str) -> AttachmentKind {
    let extension = Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if mime_type.starts_with("image/") {
        return AttachmentKind::Image;
    }

    match extension.as_str() {
        "md" | "txt" | "log" => AttachmentKind::Text,
        "json" | "yaml" | "yml" | "toml" | "xml" | "ini" | "sql" | "csv" | "tsv" => {
            AttachmentKind::Data
        }
        "js" | "jsx" | "ts" | "tsx" | "svelte" | "go" | "rs" | "py" | "sh" | "ps1" | "bat"
        | "html" | "css" => AttachmentKind::Code,
        "pdf" | "doc" | "docx" | "rtf" | "odt" => AttachmentKind::Document,
        "ppt" | "pptx" | "xls" | "xlsx" | "xlsm" => AttachmentKind::Document,
        _ if mime_type.starts_with("text/") => AttachmentKind::Text,
        _ => AttachmentKind::Binary,
    }
}

pub fn make_attachment(
    id: String,
    name: String,
    mime_type: String,
    path: String,
    size_bytes: u64,
) -> AttachmentRecord {
    AttachmentRecord {
        id,
        kind: classify_attachment(&name, &mime_type),
        mime_type,
        name,
        path,
        size_bytes,
        stage: AttachmentStage::Staged,
        ..AttachmentRecord::default()
    }
}

pub fn infer_mime_type(path: &Path) -> String {
    mime_guess::from_path(path)
        .first_or_octet_stream()
        .essence_str()
        .to_string()
}

pub fn git_branch(path: &str) -> String {
    let output = Command::new("git")
        .args(["-C", path, "rev-parse", "--abbrev-ref", "HEAD"])
        .output();

    match output {
        Ok(result) if result.status.success() => {
            String::from_utf8_lossy(&result.stdout).trim().to_string()
        }
        _ => "unknown".to_string(),
    }
}

pub fn read_codex_status() -> CodexStatus {
    let cli_path = command_path("codex");
    let auth = read_codex_auth();
    let auth_mode = auth
        .as_ref()
        .and_then(|value| value.get("auth_mode"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let has_openai_api_key = auth
        .as_ref()
        .and_then(|value| value.get("OPENAI_API_KEY"))
        .and_then(serde_json::Value::as_str)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let has_valid_tokens = auth
        .as_ref()
        .and_then(|value| value.get("tokens"))
        .map(has_valid_codex_tokens)
        .unwrap_or(false);

    let authenticated = has_openai_api_key || has_valid_tokens;

    CodexStatus {
        authenticated,
        display_status: if authenticated {
            match auth_mode.as_deref() {
                Some("chatgpt") => "Signed in with ChatGPT".to_string(),
                Some("api_key") => "Using OpenAI API key".to_string(),
                Some(mode) => format!("Signed in ({mode})"),
                None => "Authenticated".to_string(),
            }
        } else if cli_path.is_some() {
            "Installed but not signed in".to_string()
        } else {
            "Codex CLI not installed".to_string()
        },
        auth_mode,
        available: cli_path.is_some(),
        can_import_openai_key: has_openai_api_key,
        cli_path,
    }
}

pub fn read_codex_openai_key() -> Result<String, String> {
    let auth = read_codex_auth().ok_or_else(|| "Codex auth.json was not found.".to_string())?;
    let key = auth
        .get("OPENAI_API_KEY")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Codex does not have an OpenAI API key available to import.".to_string())?;
    Ok(key.to_string())
}

fn has_valid_codex_tokens(tokens: &serde_json::Value) -> bool {
    let Some(tokens) = tokens.as_object() else {
        return false;
    };

    ["id_token", "access_token", "refresh_token", "account_id"]
        .iter()
        .all(|key| {
            tokens
                .get(*key)
                .and_then(serde_json::Value::as_str)
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false)
        })
}

fn read_codex_auth() -> Option<serde_json::Value> {
    let path = codex_auth_path()?;
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn codex_auth_path() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(home).join(".codex").join("auth.json"))
}

fn command_path(command: &str) -> Option<String> {
    let resolver = if cfg!(target_os = "windows") {
        ("where", vec![command])
    } else {
        ("which", vec![command])
    };

    let output = Command::new(resolver.0).args(resolver.1).output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn default_state() -> PersistedState {
    PersistedState {
        settings: AppSettings {
            diff_analysis_model_key: None,
            features: FeatureSettings::default(),
            providers: default_providers(),
        },
        ..PersistedState::default()
    }
}

fn legacy_state_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join(LEGACY_STATE_FILE_NAME)
}

fn open_state_db(data_dir: &Path) -> Result<Connection, String> {
    fs::create_dir_all(data_dir).map_err(|error| error.to_string())?;
    let connection =
        Connection::open(state_db_path(data_dir)).map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS event_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at_ms INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS current_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload_json TEXT NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn load_current_state(connection: &Connection) -> Result<Option<PersistedState>, String> {
    let mut statement = connection
        .prepare("SELECT payload_json FROM current_state WHERE id = ?1")
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query(params![CURRENT_STATE_KEY])
        .map_err(|error| error.to_string())?;
    let Some(row) = rows.next().map_err(|error| error.to_string())? else {
        return Ok(None);
    };

    let payload: String = row.get(0).map_err(|error| error.to_string())?;
    let mut state =
        serde_json::from_str::<PersistedState>(&payload).map_err(|error| error.to_string())?;
    if state.settings.providers.is_empty() {
        state.settings.providers = default_providers();
    }
    Ok(Some(state))
}

fn write_current_state(connection: &Connection, state: &PersistedState) -> Result<(), String> {
    let payload_json = serde_json::to_string(state).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
            INSERT INTO current_state (id, payload_json, updated_at_ms)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
                payload_json = excluded.payload_json,
                updated_at_ms = excluded.updated_at_ms
            ",
            params![CURRENT_STATE_KEY, payload_json, now_ms() as i64],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn is_persisted_event(event: &AppEvent) -> bool {
    matches!(
        event,
        AppEvent::ProjectUpserted { .. }
            | AppEvent::ProjectRemoved { .. }
            | AppEvent::ProjectOrderChanged { .. }
            | AppEvent::ThreadUpserted { .. }
            | AppEvent::SettingsUpdated { .. }
    )
}

fn event_type(event: &AppEvent) -> &'static str {
    match event {
        AppEvent::ProjectUpserted { .. } => "project-upserted",
        AppEvent::ProjectRemoved { .. } => "project-removed",
        AppEvent::ProjectOrderChanged { .. } => "project-order-changed",
        AppEvent::ThreadUpserted { .. } => "thread-upserted",
        AppEvent::SettingsUpdated { .. } => "settings-updated",
        AppEvent::ModelsUpdated { .. } => "models-updated",
        AppEvent::HealthUpdated { .. } => "health-updated",
        AppEvent::IntegrationsUpdated { .. } => "integrations-updated",
    }
}
