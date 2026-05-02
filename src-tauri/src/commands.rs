use tauri::State;

use crate::{
    app_runtime::AppRuntime,
    diff_model::{DiffAnalysis, DiffAnalysisInput, LoadProjectDiffInput, ProjectDiffSnapshot},
    model::{
        AddProjectInput, AppHealth, AppSnapshot, AppUpdate, CreateThreadInput, MoveProjectInput,
        ProviderKeyInput, RemoveAttachmentInput, RemoveProjectInput, RemoveThreadInput,
        RenameProjectInput, RenameThreadInput, SelectIntentInput, SelectModelInput,
        SelectReasoningInput, SendPromptInput, SetDiffAnalysisModelInput, StageAttachmentDataInput,
        StageAttachmentInput, ToggleFeatureInput,
    },
};

pub type SnapshotCommandResult = Result<AppSnapshot, String>;
pub type UpdateCommandResult = Result<AppUpdate, String>;
pub type DiffCommandResult = Result<ProjectDiffSnapshot, String>;
pub type DiffAnalysisCommandResult = Result<DiffAnalysis, String>;
pub type HealthCommandResult = Result<AppHealth, String>;

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
