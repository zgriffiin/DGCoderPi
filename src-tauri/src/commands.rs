use tauri::State;

use crate::{
    app_runtime::AppRuntime,
    model::{
        AddProjectInput, AppSnapshot, CreateThreadInput, ProviderKeyInput, RemoveAttachmentInput,
        SelectModelInput, SendPromptInput, StageAttachmentInput, ToggleFeatureInput,
    },
};

pub type CommandResult = Result<AppSnapshot, String>;

#[tauri::command]
pub fn load_app_state(runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.load_snapshot()
}

#[tauri::command]
pub fn add_project(input: AddProjectInput, runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.add_project(input)
}

#[tauri::command]
pub fn create_thread(input: CreateThreadInput, runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.create_thread(input)
}

#[tauri::command]
pub fn select_model(input: SelectModelInput, runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.select_model(input)
}

#[tauri::command]
pub fn set_provider_key(input: ProviderKeyInput, runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.set_provider_key(input)
}

#[tauri::command]
pub fn set_feature_toggle(
    input: ToggleFeatureInput,
    runtime: State<'_, AppRuntime>,
) -> CommandResult {
    runtime.set_feature_toggle(input)
}

#[tauri::command]
pub fn stage_attachment(
    input: StageAttachmentInput,
    runtime: State<'_, AppRuntime>,
) -> CommandResult {
    runtime.stage_attachment(input)
}

#[tauri::command]
pub fn remove_attachment(
    input: RemoveAttachmentInput,
    runtime: State<'_, AppRuntime>,
) -> CommandResult {
    runtime.remove_attachment(input)
}

#[tauri::command]
pub fn send_prompt(input: SendPromptInput, runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.send_prompt(input)
}

#[tauri::command]
pub fn abort_thread(thread_id: String, runtime: State<'_, AppRuntime>) -> CommandResult {
    runtime.abort_thread(&thread_id)
}
