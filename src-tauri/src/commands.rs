use tauri::State;

use crate::{
    app_runtime::AppRuntime,
    diff_model::{DiffAnalysis, DiffAnalysisInput, LoadProjectDiffInput, ProjectDiffSnapshot},
    model::{
        AddProjectInput, AppHealth, AppSnapshot, AppUpdate, CompactThreadInput, CreateThreadInput,
        LoadSpecArtifactInput, MoveProjectInput, ProviderKeyInput, RemoveAttachmentInput,
        RemoveProjectInput, RemoveThreadInput, RenameProjectInput, RenameThreadInput,
        SelectIntentInput, SelectModelInput, SelectReasoningInput, SendPromptInput,
        SetCavemanLevelInput, SetDiffAnalysisModelInput, SpecArtifactDocument,
        StageAttachmentDataInput, StageAttachmentInput, ToggleFeatureInput,
    },
};

pub type SnapshotCommandResult = Result<AppSnapshot, String>;
pub type UpdateCommandResult = Result<AppUpdate, String>;
pub type DiffCommandResult = Result<ProjectDiffSnapshot, String>;
pub type DiffAnalysisCommandResult = Result<DiffAnalysis, String>;
pub type HealthCommandResult = Result<AppHealth, String>;
pub type SpecArtifactCommandResult = Result<SpecArtifactDocument, String>;

#[tauri::command]
pub fn load_app_state(runtime: State<'_, AppRuntime>) -> SnapshotCommandResult {
    runtime.load_snapshot()
}

#[tauri::command]
pub fn load_runtime_health(runtime: State<'_, AppRuntime>) -> HealthCommandResult {
    runtime.health_snapshot()
}

#[tauri::command]
pub fn add_project(input: AddProjectInput, runtime: State<'_, AppRuntime>) -> UpdateCommandResult {
    runtime.add_project(input)
}

#[tauri::command]
pub fn create_thread(
    input: CreateThreadInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.create_thread(input)
}

#[tauri::command]
pub fn move_project(
    input: MoveProjectInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.move_project(input)
}

#[tauri::command]
pub fn rename_project(
    input: RenameProjectInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.rename_project(input)
}

#[tauri::command]
pub fn remove_project(
    input: RemoveProjectInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.remove_project(input)
}

#[tauri::command]
pub fn remove_thread(
    input: RemoveThreadInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.remove_thread(input)
}

#[tauri::command]
pub fn rename_thread(
    input: RenameThreadInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.rename_thread(input)
}

#[tauri::command]
pub fn select_model(
    input: SelectModelInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.select_model(input)
}

#[tauri::command]
pub fn select_reasoning(
    input: SelectReasoningInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.select_reasoning(input)
}

#[tauri::command]
pub fn select_intent(
    input: SelectIntentInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.select_intent(input)
}

#[tauri::command]
pub fn set_provider_key(
    input: ProviderKeyInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.set_provider_key(input)
}

#[tauri::command]
pub fn import_codex_openai_key(runtime: State<'_, AppRuntime>) -> UpdateCommandResult {
    runtime.import_codex_openai_key()
}

#[tauri::command]
pub fn start_codex_login(runtime: State<'_, AppRuntime>) -> UpdateCommandResult {
    runtime.start_codex_login()
}

#[tauri::command]
pub fn set_feature_toggle(
    input: ToggleFeatureInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.set_feature_toggle(input)
}

#[tauri::command]
pub fn set_caveman_level(
    input: SetCavemanLevelInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.set_caveman_level(input)
}

#[tauri::command]
pub fn stage_attachment(
    input: StageAttachmentInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.stage_attachment(input)
}

#[tauri::command]
pub fn stage_attachment_data(
    input: StageAttachmentDataInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.stage_attachment_data(input)
}

#[tauri::command]
pub fn remove_attachment(
    input: RemoveAttachmentInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.remove_attachment(input)
}

#[tauri::command]
pub fn send_prompt(input: SendPromptInput, runtime: State<'_, AppRuntime>) -> UpdateCommandResult {
    runtime.send_prompt(input)
}

#[tauri::command]
pub fn compact_thread(
    input: CompactThreadInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.compact_thread(input)
}

#[tauri::command]
pub async fn load_spec_artifact(
    input: LoadSpecArtifactInput,
    runtime: State<'_, AppRuntime>,
) -> SpecArtifactCommandResult {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.load_spec_artifact(input))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn load_project_diff(
    input: LoadProjectDiffInput,
    runtime: State<'_, AppRuntime>,
) -> DiffCommandResult {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.load_project_diff(input))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn load_diff_analysis(
    input: DiffAnalysisInput,
    runtime: State<'_, AppRuntime>,
) -> DiffAnalysisCommandResult {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.load_diff_analysis(input))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn refresh_diff_analysis(
    input: DiffAnalysisInput,
    runtime: State<'_, AppRuntime>,
) -> DiffAnalysisCommandResult {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.refresh_diff_analysis(input))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn abort_thread(thread_id: String, runtime: State<'_, AppRuntime>) -> UpdateCommandResult {
    runtime.abort_thread(&thread_id)
}

#[tauri::command]
pub fn set_diff_analysis_model(
    input: SetDiffAnalysisModelInput,
    runtime: State<'_, AppRuntime>,
) -> UpdateCommandResult {
    runtime.set_diff_analysis_model(input)
}

// --- File Explorer Commands ---

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDirectoryInput {
    pub path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
}

#[tauri::command]
pub async fn read_directory(input: ReadDirectoryInput) -> Result<Vec<DirectoryEntry>, String> {
    let path = std::path::Path::new(&input.path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", input.path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", input.path));
    }

    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path().to_string_lossy().to_string();

        entries.push(DirectoryEntry {
            name,
            path: entry_path,
            is_directory: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    entries.sort_by(|a, b| {
        if a.is_directory == b.is_directory {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_directory {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileInput {
    pub path: String,
}

#[tauri::command]
pub async fn read_file_content(input: ReadFileInput) -> Result<String, String> {
    let path = std::path::Path::new(&input.path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", input.path));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", input.path));
    }

    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileInput {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub async fn write_file_content(input: WriteFileInput) -> Result<(), String> {
    let path = std::path::Path::new(&input.path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    std::fs::write(path, &input.content).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyEntryInput {
    pub source: String,
    pub destination: String,
}

#[tauri::command]
pub async fn copy_entry(input: CopyEntryInput) -> Result<(), String> {
    let source = std::path::Path::new(&input.source);
    if !source.exists() {
        return Err(format!("Source does not exist: {}", input.source));
    }

    let dest = std::path::Path::new(&input.destination);
    if dest.exists() {
        return Err(format!("Destination already exists: {}", input.destination));
    }

    if source.is_dir() {
        copy_dir_recursive(source, dest).map_err(|e| e.to_string())
    } else {
        std::fs::copy(source, dest).map(|_| ()).map_err(|e| e.to_string())
    }
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameEntryInput {
    pub source: String,
    pub destination: String,
}

#[tauri::command]
pub async fn rename_entry(input: RenameEntryInput) -> Result<(), String> {
    let source = std::path::Path::new(&input.source);
    if !source.exists() {
        return Err(format!("Source does not exist: {}", input.source));
    }

    let dest = std::path::Path::new(&input.destination);
    if dest.exists() {
        return Err(format!("Destination already exists: {}", input.destination));
    }

    std::fs::rename(source, dest).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntryInput {
    pub path: String,
}

#[tauri::command]
pub async fn delete_entry(input: DeleteEntryInput) -> Result<(), String> {
    let path = std::path::Path::new(&input.path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", input.path));
    }

    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDirectoryInput {
    pub path: String,
}

#[tauri::command]
pub async fn create_directory(input: CreateDirectoryInput) -> Result<(), String> {
    let path = std::path::Path::new(&input.path);
    if path.exists() {
        return Err(format!("Path already exists: {}", input.path));
    }
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}
