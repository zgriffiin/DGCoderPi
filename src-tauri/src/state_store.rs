use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use uuid::Uuid;

use crate::model::{
    AppHealth, AppSettings, AppSnapshot, AttachmentKind, AttachmentRecord, AttachmentStage,
    FeatureSettings, MessageRecord, ModelOption, PersistedState, ProjectRecord, ProviderStatus,
    ThreadRecord, ThreadStatus,
};

const STATE_FILE_NAME: &str = "app-state.json";

pub fn load_state(data_dir: &Path) -> Result<PersistedState, String> {
    let file_path = state_file_path(data_dir);
    if !file_path.exists() {
        return Ok(PersistedState {
            settings: AppSettings {
                features: FeatureSettings::default(),
                providers: default_providers(),
            },
            ..PersistedState::default()
        });
    }

    let content = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
    let mut state =
        serde_json::from_str::<PersistedState>(&content).map_err(|error| error.to_string())?;
    if state.settings.providers.is_empty() {
        state.settings.providers = default_providers();
    }
    Ok(state)
}

pub fn save_state(data_dir: &Path, state: &PersistedState) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|error| error.to_string())?;
    let content = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    fs::write(state_file_path(data_dir), content).map_err(|error| error.to_string())
}

pub fn state_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join(STATE_FILE_NAME)
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
        messages: vec![MessageRecord {
            id: Uuid::new_v4().to_string(),
            role: crate::model::MessageRole::System,
            status: crate::model::MessageStatus::Ready,
            text: "Thread created. Configure a provider key to start Pi-backed runs.".to_string(),
            timestamp_ms: now_ms(),
        }],
        model_key,
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

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}
