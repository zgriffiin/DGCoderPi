use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use uuid::Uuid;

use crate::model::{
    AppHealth, AppIntegrations, AppSettings, AppSnapshot, AttachmentKind, AttachmentRecord,
    AttachmentStage, CodexStatus, FeatureSettings, ModelOption, PersistedState, ProjectDiffEntry,
    ProjectDiffSnapshot, ProjectRecord, ProviderStatus, ThreadRecord, ThreadStatus,
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

pub fn project_diff(path: &str, branch: &str) -> ProjectDiffSnapshot {
    let output = Command::new("git")
        .args(["-C", path, "status", "--porcelain"])
        .output();

    match output {
        Ok(result) if result.status.success() => ProjectDiffSnapshot {
            branch: branch.to_string(),
            files: String::from_utf8_lossy(&result.stdout)
                .lines()
                .filter_map(parse_git_status_line)
                .collect(),
            git_available: true,
        },
        _ => ProjectDiffSnapshot {
            branch: branch.to_string(),
            files: Vec::new(),
            git_available: false,
        },
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
    let has_tokens = auth
        .as_ref()
        .and_then(|value| value.get("tokens"))
        .map(|value| !value.is_null())
        .unwrap_or(false);

    CodexStatus {
        authenticated: has_openai_api_key || has_tokens || auth_mode.is_some(),
        display_status: if has_openai_api_key || has_tokens || auth_mode.is_some() {
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

fn parse_git_status_line(line: &str) -> Option<ProjectDiffEntry> {
    let trimmed = line.trim_end();
    if trimmed.len() < 3 {
        return None;
    }

    let code = trimmed.get(..2)?.to_string();
    let mut path = trimmed.get(3..)?.trim().to_string();
    if code.chars().all(char::is_whitespace) || path.is_empty() {
        return None;
    }

    if matches!(code.chars().next(), Some('R' | 'C')) {
        if let Some((_, target_path)) = path.rsplit_once(" -> ") {
            path = target_path.trim().to_string();
        }
    }

    path = decode_git_path(&path);
    if path.is_empty() {
        return None;
    }

    Some(ProjectDiffEntry { code, path })
}

fn decode_git_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.len() < 2 || !trimmed.starts_with('"') || !trimmed.ends_with('"') {
        return trimmed.to_string();
    }

    let inner = &trimmed[1..trimmed.len() - 1];
    let bytes = inner.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'\\' {
            decoded.push(bytes[index]);
            index += 1;
            continue;
        }

        if index + 1 >= bytes.len() {
            decoded.push(b'\\');
            break;
        }

        match bytes[index + 1] {
            b'"' => {
                decoded.push(b'"');
                index += 2;
            }
            b'\\' => {
                decoded.push(b'\\');
                index += 2;
            }
            b'n' => {
                decoded.push(b'\n');
                index += 2;
            }
            b'r' => {
                decoded.push(b'\r');
                index += 2;
            }
            b't' => {
                decoded.push(b'\t');
                index += 2;
            }
            b'0'..=b'7' => {
                let mut value: u16 = 0;
                let mut octal_length = 0;
                while index + 1 + octal_length < bytes.len() && octal_length < 3 {
                    let digit = bytes[index + 1 + octal_length];
                    if !(b'0'..=b'7').contains(&digit) {
                        break;
                    }
                    value = value * 8 + u16::from(digit - b'0');
                    octal_length += 1;
                }

                if octal_length == 0 {
                    decoded.push(b'\\');
                    index += 1;
                    continue;
                }

                decoded.push(value.min(0xFF) as u8);
                index += 1 + octal_length;
            }
            other => {
                decoded.push(other);
                index += 2;
            }
        }
    }

    String::from_utf8_lossy(&decoded).trim().to_string()
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
