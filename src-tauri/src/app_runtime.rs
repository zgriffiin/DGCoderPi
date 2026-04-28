use std::{
    collections::HashSet,
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::{
    model::{
        ActivityRecord, AddProjectInput, AppEvent, AppHealth, AppIntegrations, AppSnapshot,
        AppUpdate, AttachmentParseStatus, AttachmentStage, CreateThreadInput, MessageRecord,
        MessageRole, MessageStatus, ModelOption, MoveProjectInput, PersistedState,
        ProjectDiffSnapshot, PromptMode, ProviderKeyInput, RemoveAttachmentInput, SelectModelInput,
        SelectReasoningInput, SendPromptInput, StageAttachmentInput, ThreadRecord, ThreadStatus,
        ToggleFeatureInput,
    },
    pi_bridge::{
        attachment_status_from_bridge, BridgeActivity, BridgeEnvironment, BridgeEvent,
        BridgePromptAttachment, BridgeThreadSnapshot, PiBridge,
    },
    state_store::{
        append_update, attachment_directory, build_snapshot, infer_mime_type, load_state,
        make_attachment, new_project, new_thread, now_ms, project_diff, read_codex_openai_key,
        read_codex_status, replace_state,
    },
};

const UPDATE_EVENT: &str = "app://update";
const MAX_ACTIVITY_ENTRIES: usize = 48;

#[derive(Clone)]
pub struct AppRuntime {
    inner: Arc<AppRuntimeInner>,
}

struct AppRuntimeInner {
    app: AppHandle,
    bridge: Mutex<Option<Arc<PiBridge>>>,
    data_dir: PathBuf,
    models: Mutex<Vec<ModelOption>>,
    state: Mutex<PersistedState>,
}

impl AppRuntime {
    pub fn new(app: AppHandle, repo_root: &Path, data_dir: PathBuf) -> Result<Self, String> {
        let mut state = load_state(&data_dir)?;
        if normalize_state(&mut state) {
            replace_state(&data_dir, &state)?;
        }
        let runtime = Self {
            inner: Arc::new(AppRuntimeInner {
                app,
                bridge: Mutex::new(None),
                data_dir,
                models: Mutex::new(Vec::new()),
                state: Mutex::new(state),
            }),
        };

        let callback_runtime = runtime.clone();
        let features = {
            let state = callback_runtime
                .inner
                .state
                .lock()
                .map_err(|_| "State lock was poisoned.".to_string())?;
            state.settings.features.clone()
        };
        let bridge = PiBridge::start(
            repo_root,
            &runtime.inner.data_dir,
            &features,
            Arc::new(move |event| callback_runtime.handle_bridge_event(event)),
        )?;

        runtime
            .inner
            .bridge
            .lock()
            .map_err(|_| "Bridge slot lock was poisoned.".to_string())?
            .replace(Arc::new(bridge));

        runtime.refresh_environment()?;
        Ok(runtime)
    }

    pub fn load_snapshot(&self) -> Result<AppSnapshot, String> {
        self.refresh_environment()?;
        self.snapshot()
    }

    pub fn health_snapshot(&self) -> Result<AppHealth, String> {
        self.build_health()
    }

    pub fn load_project_diff(&self, project_id: &str) -> Result<ProjectDiffSnapshot, String> {
        let (path, branch) = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| "State lock was poisoned.".to_string())?;
            let project = state
                .projects
                .iter()
                .find(|project| project.id == project_id)
                .ok_or_else(|| "Project not found.".to_string())?;
            (project.path.clone(), project.branch.clone())
        };

        Ok(project_diff(&path, &branch))
    }

    pub fn add_project(&self, input: AddProjectInput) -> Result<AppUpdate, String> {
        let default_model = self.default_model_key();
        let project_id = self.mutate_state(|state| {
            let mut project = new_project(&input.path);
            let thread = new_thread("Explore repository", &project.branch, default_model.clone());
            let project_id = project.id.clone();
            let thread_id = thread.id.clone();
            project.threads.push(thread);
            state.projects.push(project);
            state.selected_project_id = Some(project_id.clone());
            state.selected_thread_id = Some(thread_id);
            Ok(project_id)
        })?;
        self.persist_and_return(self.project_update(&project_id)?)
    }

    pub fn create_thread(&self, input: CreateThreadInput) -> Result<AppUpdate, String> {
        let default_model = self.default_model_key();
        let thread_id = self.mutate_state(|state| {
            let project = state
                .projects
                .iter_mut()
                .find(|project| project.id == input.project_id)
                .ok_or_else(|| "Project not found.".to_string())?;
            let thread = new_thread(&input.title, &project.branch, default_model.clone());
            let thread_id = thread.id.clone();
            state.selected_project_id = Some(project.id.clone());
            state.selected_thread_id = Some(thread_id.clone());
            project.threads.push(thread);
            Ok(thread_id)
        })?;
        self.persist_and_return(self.thread_update(&thread_id)?)
    }

    pub fn move_project(&self, input: MoveProjectInput) -> Result<AppUpdate, String> {
        self.mutate_state(|state| {
            let current_index = state
                .projects
                .iter()
                .position(|project| project.id == input.project_id)
                .ok_or_else(|| "Project not found.".to_string())?;
            if state.projects.len() < 2 {
                return Ok(());
            }

            let project = state.projects.remove(current_index);
            let target_index =
                project_insert_index(current_index, input.target_index, state.projects.len());
            state.projects.insert(target_index, project);
            Ok(())
        })?;
        self.persist_and_return(self.project_order_update()?)
    }

    pub fn select_model(&self, input: SelectModelInput) -> Result<AppUpdate, String> {
        let update = self.mutate_thread(&input.thread_id, |thread| {
            thread.model_key = Some(input.model_key.clone());
            Ok(())
        })?;
        self.persist_and_return(update)
    }

    pub fn select_reasoning(&self, input: SelectReasoningInput) -> Result<AppUpdate, String> {
        let update = self.mutate_thread(&input.thread_id, |thread| {
            thread.reasoning_level = input.reasoning_level.clone();
            Ok(())
        })?;
        self.persist_and_return(update)
    }

    pub fn set_provider_key(&self, input: ProviderKeyInput) -> Result<AppUpdate, String> {
        let environment = self
            .bridge()?
            .set_provider_key(&input.provider, &input.key)?;
        self.persist_and_return(self.sync_environment(environment)?)
    }

    pub fn import_codex_openai_key(&self) -> Result<AppUpdate, String> {
        let key = read_codex_openai_key()?;
        let environment = self.bridge()?.set_provider_key("openai", &key)?;
        self.persist_and_return(self.sync_environment(environment)?)
    }

    pub fn start_codex_login(&self) -> Result<AppUpdate, String> {
        launch_codex_login()?;
        self.persist_and_return(self.system_update()?)
    }

    pub fn set_feature_toggle(&self, input: ToggleFeatureInput) -> Result<AppUpdate, String> {
        self.mutate_state(|state| {
            if input.feature == "docparser" {
                state.settings.features.docparser_enabled = input.enabled;
                return Ok(());
            }

            Err(format!("Unknown feature toggle: {}", input.feature))
        })?;

        let features = {
            let state = self
                .inner
                .state
                .lock()
                .map_err(|_| "State lock was poisoned.".to_string())?;
            state.settings.features.clone()
        };

        let environment = self.bridge()?.set_feature_settings(&features)?;
        self.persist_and_return(self.sync_environment(environment)?)
    }

    pub fn stage_attachment(&self, input: StageAttachmentInput) -> Result<AppUpdate, String> {
        let attachment_id = Uuid::new_v4().to_string();
        self.ensure_thread_exists(&input.thread_id)?;
        let attachment_dir = attachment_directory(&self.inner.data_dir).join(&input.thread_id);
        let source_path = PathBuf::from(&input.source_path);
        let source_name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(str::to_string)
            .ok_or_else(|| "Attachment path did not contain a valid file name.".to_string())?;
        let source_metadata = fs::metadata(&source_path).map_err(|error| error.to_string())?;
        if !source_metadata.is_file() {
            return Err("Attachments must be regular files.".to_string());
        }

        fs::create_dir_all(&attachment_dir).map_err(|error| error.to_string())?;

        let file_name = format!("{}-{}", &attachment_id[..8], source_name);
        let file_path = attachment_dir.join(file_name);
        fs::copy(&source_path, &file_path).map_err(|error| error.to_string())?;
        let mime_type = infer_mime_type(&source_path);
        let size_bytes = source_metadata.len();

        let update = self.mutate_thread(&input.thread_id, |thread| {
            let mut attachment = make_attachment(
                attachment_id.clone(),
                source_name.clone(),
                mime_type.clone(),
                file_path.to_string_lossy().to_string(),
                size_bytes,
            );

            if attachment.kind == crate::model::AttachmentKind::Binary {
                attachment.parse_status = AttachmentParseStatus::Idle;
            } else {
                attachment.parse_status = AttachmentParseStatus::Parsing;
            }

            thread.attachments.push(attachment);
            append_activity(
                thread,
                "Attachment staged",
                format!("{} is ready for the next turn.", source_name),
                crate::model::ActivityTone::System,
            );
            Ok(())
        })?;
        self.persist_update(&update)?;

        self.spawn_attachment_parse(&input.thread_id, &attachment_id, file_path);
        Ok(update)
    }

    pub fn remove_attachment(&self, input: RemoveAttachmentInput) -> Result<AppUpdate, String> {
        let attachment_path = self.attachment_path(&input.thread_id, &input.attachment_id)?;
        match fs::remove_file(&attachment_path) {
            Ok(()) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "Failed to delete attachment file `{}`: {error}",
                    attachment_path.display()
                ));
            }
        }

        let update = self.mutate_thread(&input.thread_id, |thread| {
            thread
                .attachments
                .retain(|attachment| attachment.id != input.attachment_id);
            Ok(())
        })?;
        self.persist_and_return(update)
    }

    pub fn send_prompt(&self, input: SendPromptInput) -> Result<AppUpdate, String> {
        let (cwd, model_key, thinking_level, attachments, thread_status) =
            self.prepare_prompt(&input.thread_id)?;
        let effective_mode = if matches!(input.mode, PromptMode::Prompt)
            && matches!(thread_status, ThreadStatus::Running)
        {
            PromptMode::FollowUp
        } else {
            input.mode.clone()
        };
        let command_name = match effective_mode {
            PromptMode::Prompt => "send-prompt",
            PromptMode::FollowUp => "follow-up",
            PromptMode::Steer => "steer",
        };
        let staged_attachment_paths = attachments
            .iter()
            .map(|attachment| attachment.path.clone())
            .collect::<Vec<_>>();
        let pending_message = matches!(effective_mode, PromptMode::Prompt).then(|| MessageRecord {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::User,
            status: MessageStatus::Ready,
            text: input.text.clone(),
            timestamp_ms: now_ms(),
        });
        let pending_queue_entry =
            (!matches!(effective_mode, PromptMode::Prompt)).then(|| crate::model::QueueEntry {
                id: Uuid::new_v4().to_string(),
                mode: if matches!(effective_mode, PromptMode::Steer) {
                    crate::model::QueueMode::Steer
                } else {
                    crate::model::QueueMode::FollowUp
                },
                status: crate::model::QueueStatus::Pending,
                text: input.text.clone(),
            });

        let update = self.mutate_thread(&input.thread_id, |thread| {
            if matches!(effective_mode, PromptMode::Prompt) {
                update_thread_title(thread, &input.text);
                if let Some(message) = &pending_message {
                    thread.last_user_message_at_ms = message.timestamp_ms;
                    thread.messages.push(message.clone());
                    mark_staged_attachments_sent(thread);
                }
            } else if let Some(queue_entry) = &pending_queue_entry {
                thread.queue.push(queue_entry.clone());
                mark_staged_attachments_sent(thread);
            }
            thread.status = ThreadStatus::Running;
            thread.last_error = None;
            Ok(())
        })?;
        self.persist_update(&update)?;

        let bridge_input = crate::pi_bridge::BridgePromptRequest {
            attachments: &attachments,
            command_name,
            cwd: &cwd,
            model_key: &model_key,
            text: &input.text,
            thinking_level: &thinking_level,
            thread_id: &input.thread_id,
        };

        if let Err(error) = self.bridge()?.send_prompt(bridge_input) {
            let bridge_error = error.clone();
            if let Err(rollback_error) = self.rollback_failed_prompt(
                &input.thread_id,
                error,
                &pending_message,
                &pending_queue_entry,
                &staged_attachment_paths,
                &thread_status,
            ) {
                eprintln!(
                    "Failed to roll back prompt state after bridge error `{bridge_error}`: {rollback_error}"
                );
            }
            return Err(bridge_error);
        }

        Ok(update)
    }

    pub fn abort_thread(&self, thread_id: &str) -> Result<AppUpdate, String> {
        self.bridge()?.abort(thread_id)?;
        let update = self.mutate_thread(thread_id, |thread| {
            thread.status = ThreadStatus::Idle;
            append_activity(
                thread,
                "Run stopped",
                "Pi was asked to stop the current run.".to_string(),
                crate::model::ActivityTone::System,
            );
            Ok(())
        })?;
        self.persist_and_return(update)
    }

    fn snapshot(&self) -> Result<AppSnapshot, String> {
        let models = self
            .inner
            .models
            .lock()
            .map_err(|_| "Model cache lock was poisoned.".to_string())?
            .clone();
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?
            .clone();
        let bridge_status = self.bridge()?.status();
        let codex_status = read_codex_status();
        Ok(build_snapshot(&state, models, &bridge_status, codex_status))
    }

    fn refresh_environment(&self) -> Result<AppUpdate, String> {
        let environment = self.bridge()?.refresh_environment()?;
        let update = self.sync_environment(environment)?;
        self.persist_update(&update)?;
        Ok(update)
    }

    fn sync_environment(&self, environment: BridgeEnvironment) -> Result<AppUpdate, String> {
        let default_model_key = environment.models.first().map(|model| model.key.clone());
        let available_model_keys = environment
            .models
            .iter()
            .map(|model| model.key.clone())
            .collect::<HashSet<_>>();
        {
            let mut models = self
                .inner
                .models
                .lock()
                .map_err(|_| "Model cache lock was poisoned.".to_string())?;
            *models = environment.models;
        }

        let changed_thread_ids = self.mutate_state(|state| {
            state.settings.providers = environment.providers;
            let mut changed_thread_ids = Vec::new();
            for project in &mut state.projects {
                for thread in &mut project.threads {
                    if sync_thread_model_selection(
                        thread,
                        &available_model_keys,
                        default_model_key.as_deref(),
                    ) {
                        changed_thread_ids.push(thread.id.clone());
                    }
                }
            }
            Ok(changed_thread_ids)
        })?;

        let mut events = self.system_update()?.events;
        for thread_id in changed_thread_ids {
            events.extend(self.thread_update(&thread_id)?.events);
        }

        Ok(AppUpdate { events })
    }

    fn mutate_state<F, T>(&self, mutator: F) -> Result<T, String>
    where
        F: FnOnce(&mut PersistedState) -> Result<T, String>,
    {
        let output = {
            let mut state = self
                .inner
                .state
                .lock()
                .map_err(|_| "State lock was poisoned.".to_string())?;
            mutator(&mut state)?
        };
        Ok(output)
    }

    fn mutate_thread<F>(&self, thread_id: &str, mutator: F) -> Result<AppUpdate, String>
    where
        F: FnOnce(&mut ThreadRecord) -> Result<(), String>,
    {
        self.mutate_state(|state| {
            let (project_index, thread_index) =
                locate_thread(state, thread_id).ok_or_else(|| "Thread not found.".to_string())?;
            let thread = &mut state.projects[project_index].threads[thread_index];
            mutator(thread)?;
            thread.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.thread_update(thread_id)
    }

    fn emit_update(&self, update: &AppUpdate) -> Result<(), String> {
        self.inner
            .app
            .emit(UPDATE_EVENT, update)
            .map_err(|error| error.to_string())
    }

    fn persist_update(&self, update: &AppUpdate) -> Result<(), String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?
            .clone();
        append_update(&self.inner.data_dir, update, &state)
    }

    fn persist_and_return(&self, update: AppUpdate) -> Result<AppUpdate, String> {
        self.persist_update(&update)?;
        Ok(update)
    }

    fn rollback_failed_prompt(
        &self,
        thread_id: &str,
        error: String,
        pending_message: &Option<MessageRecord>,
        pending_queue_entry: &Option<crate::model::QueueEntry>,
        staged_attachment_paths: &[String],
        thread_status: &ThreadStatus,
    ) -> Result<(), String> {
        let update = self.mutate_thread(thread_id, |thread| {
            for attachment in &mut thread.attachments {
                if staged_attachment_paths.contains(&attachment.path)
                    && attachment.stage == AttachmentStage::Sent
                {
                    attachment.stage = AttachmentStage::Staged;
                }
            }
            if let Some(message) = pending_message {
                thread.messages.retain(|entry| entry.id != message.id);
            }
            if let Some(queue_entry) = pending_queue_entry {
                thread.queue.retain(|entry| entry.id != queue_entry.id);
            }
            thread.last_user_message_at_ms =
                latest_user_message_timestamp(thread.messages.iter(), 0);
            thread.last_error = Some(error.clone());
            thread.status = thread_status.clone();
            Ok(())
        })?;
        self.persist_update(&update)?;
        self.emit_update(&update)
    }

    fn build_health(&self) -> Result<AppHealth, String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        let configured_provider_count = state
            .settings
            .providers
            .iter()
            .filter(|provider| provider.configured)
            .count();
        let model_count = self
            .inner
            .models
            .lock()
            .map_err(|_| "Model cache lock was poisoned.".to_string())?
            .len();
        let bridge_status = self.bridge()?.status();

        Ok(AppHealth {
            bridge_status,
            configured_provider_count,
            model_count,
        })
    }

    fn build_integrations(&self) -> AppIntegrations {
        AppIntegrations {
            codex: read_codex_status(),
        }
    }

    fn ensure_thread_exists(&self, thread_id: &str) -> Result<(), String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        locate_thread(&state, thread_id)
            .ok_or_else(|| "Thread not found.".to_string())
            .map(|_| ())
    }

    fn attachment_path(&self, thread_id: &str, attachment_id: &str) -> Result<PathBuf, String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        let (project_index, thread_index) =
            locate_thread(&state, thread_id).ok_or_else(|| "Thread not found.".to_string())?;
        let thread = &state.projects[project_index].threads[thread_index];
        let attachment = thread
            .attachments
            .iter()
            .find(|attachment| attachment.id == attachment_id)
            .ok_or_else(|| "Attachment not found.".to_string())?;
        Ok(PathBuf::from(&attachment.path))
    }

    fn system_update(&self) -> Result<AppUpdate, String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        let settings = state.settings.clone();
        drop(state);
        let models = self
            .inner
            .models
            .lock()
            .map_err(|_| "Model cache lock was poisoned.".to_string())?
            .clone();

        Ok(AppUpdate {
            events: vec![
                AppEvent::SettingsUpdated { settings },
                AppEvent::ModelsUpdated { models },
                AppEvent::HealthUpdated {
                    health: self.build_health()?,
                },
                AppEvent::IntegrationsUpdated {
                    integrations: self.build_integrations(),
                },
            ],
        })
    }

    fn project_update(&self, project_id: &str) -> Result<AppUpdate, String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        let project = state
            .projects
            .iter()
            .find(|project| project.id == project_id)
            .cloned()
            .ok_or_else(|| "Project not found.".to_string())?;

        Ok(AppUpdate {
            events: vec![AppEvent::ProjectUpserted {
                project,
                selected_project_id: state.selected_project_id.clone(),
                selected_thread_id: state.selected_thread_id.clone(),
            }],
        })
    }

    fn project_order_update(&self) -> Result<AppUpdate, String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;

        Ok(AppUpdate {
            events: vec![AppEvent::ProjectOrderChanged {
                project_ids: state
                    .projects
                    .iter()
                    .map(|project| project.id.clone())
                    .collect(),
                selected_project_id: state.selected_project_id.clone(),
                selected_thread_id: state.selected_thread_id.clone(),
            }],
        })
    }

    fn thread_update(&self, thread_id: &str) -> Result<AppUpdate, String> {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        let (project_index, thread_index) =
            locate_thread(&state, thread_id).ok_or_else(|| "Thread not found.".to_string())?;
        let project_id = state.projects[project_index].id.clone();
        let thread = state.projects[project_index].threads[thread_index].clone();

        Ok(AppUpdate {
            events: vec![AppEvent::ThreadUpserted {
                project_id,
                selected_project_id: state.selected_project_id.clone(),
                selected_thread_id: state.selected_thread_id.clone(),
                thread,
            }],
        })
    }

    fn default_model_key(&self) -> Option<String> {
        self.inner
            .models
            .lock()
            .ok()
            .and_then(|models| models.first().map(|model| model.key.clone()))
    }

    fn prepare_prompt(
        &self,
        thread_id: &str,
    ) -> Result<
        (
            String,
            String,
            String,
            Vec<BridgePromptAttachment>,
            ThreadStatus,
        ),
        String,
    > {
        let state = self
            .inner
            .state
            .lock()
            .map_err(|_| "State lock was poisoned.".to_string())?;
        let (project_index, thread_index) =
            locate_thread(&state, thread_id).ok_or_else(|| "Thread not found.".to_string())?;
        let project = &state.projects[project_index];
        let thread = &project.threads[thread_index];
        let project_path = project.path.clone();
        let model_key = thread
            .model_key
            .clone()
            .ok_or_else(|| "Select a configured model before sending a prompt.".to_string())?;
        let reasoning_level = thread.reasoning_level.clone();
        let attachments = thread
            .attachments
            .iter()
            .filter(|attachment| attachment.stage == AttachmentStage::Staged)
            .map(|attachment| BridgePromptAttachment {
                kind: format!("{:?}", attachment.kind).to_ascii_lowercase(),
                mime_type: attachment.mime_type.clone(),
                name: attachment.name.clone(),
                path: attachment.path.clone(),
                preview_text: attachment.preview_text.clone(),
            })
            .collect::<Vec<_>>();
        let thread_status = thread.status.clone();
        drop(state);

        let model_supports_reasoning = self
            .inner
            .models
            .lock()
            .map_err(|_| "Model cache lock was poisoned.".to_string())?
            .iter()
            .find(|model| model.key == model_key)
            .map(|model| {
                model.supports_reasoning
                    && model.available_thinking_levels.contains(&reasoning_level)
            })
            .unwrap_or(false);
        let thinking_level = if model_supports_reasoning {
            reasoning_level.as_str().to_string()
        } else {
            "off".to_string()
        };

        Ok((
            project_path,
            model_key,
            thinking_level,
            attachments,
            thread_status,
        ))
    }

    fn spawn_attachment_parse(&self, thread_id: &str, attachment_id: &str, path: PathBuf) {
        let runtime = self.clone();
        let thread_id = thread_id.to_string();
        let attachment_id = attachment_id.to_string();

        tauri::async_runtime::spawn(async move {
            let preview = runtime
                .bridge()
                .and_then(|bridge| bridge.parse_attachment(path.to_string_lossy().as_ref()));
            let _ = runtime.apply_attachment_parse_result(&thread_id, &attachment_id, preview);
        });
    }

    fn apply_attachment_parse_result(
        &self,
        thread_id: &str,
        attachment_id: &str,
        result: Result<crate::pi_bridge::BridgeAttachmentResult, String>,
    ) -> Result<(), String> {
        let update = self.mutate_thread(thread_id, |thread| {
            let attachment = thread
                .attachments
                .iter_mut()
                .find(|attachment| attachment.id == attachment_id)
                .ok_or_else(|| "Attachment not found.".to_string())?;

            match result {
                Ok(parsed) => {
                    attachment.parse_status = attachment_status_from_bridge(parsed.status);
                    attachment.preview_text = parsed.preview_text;
                    attachment.warnings = parsed.warnings;
                }
                Err(error) => {
                    attachment.parse_status = AttachmentParseStatus::Failed;
                    attachment.warnings = vec![error];
                }
            }

            Ok(())
        })?;
        self.persist_update(&update)?;
        self.emit_update(&update)?;
        Ok(())
    }

    fn handle_bridge_event(&self, event: BridgeEvent) {
        match event {
            BridgeEvent::ThreadUpdate {
                thread_id,
                snapshot,
                activity,
            } => {
                if let Err(error) = self.apply_thread_snapshot(&thread_id, snapshot, activity) {
                    eprintln!("Failed to apply thread snapshot for `{thread_id}`: {error}");
                }
            }
            BridgeEvent::BridgeOffline { error } => {
                if let Err(bridge_error) = self.handle_bridge_offline(error.clone()) {
                    eprintln!(
                        "Failed to handle bridge offline event after `{error}`: {bridge_error}"
                    );
                }
            }
        }
    }

    fn handle_bridge_offline(&self, error: String) -> Result<(), String> {
        let affected_thread_ids = self.mutate_state(|state| {
            let mut affected_thread_ids = Vec::new();
            for project in &mut state.projects {
                for thread in &mut project.threads {
                    let had_queue = !thread.queue.is_empty();
                    let was_running = matches!(thread.status, ThreadStatus::Running);
                    if !was_running && !had_queue {
                        continue;
                    }

                    for attachment in &mut thread.attachments {
                        if attachment.stage == AttachmentStage::Sent {
                            attachment.stage = AttachmentStage::Staged;
                        }
                    }
                    thread.queue.clear();
                    if was_running {
                        thread.status = ThreadStatus::Failed;
                    }
                    thread.last_error = Some(error.clone());
                    append_activity(
                        thread,
                        "Bridge offline",
                        "Pi bridge disconnected before the current run completed.".to_string(),
                        crate::model::ActivityTone::System,
                    );
                    affected_thread_ids.push(thread.id.clone());
                }
            }

            Ok(affected_thread_ids)
        })?;

        let mut events = vec![AppEvent::HealthUpdated {
            health: self.build_health()?,
        }];
        for thread_id in affected_thread_ids {
            events.extend(self.thread_update(&thread_id)?.events);
        }
        let update = AppUpdate { events };
        self.persist_update(&update)?;
        self.emit_update(&update)?;
        Ok(())
    }

    fn apply_thread_snapshot(
        &self,
        thread_id: &str,
        snapshot: BridgeThreadSnapshot,
        activity: Option<BridgeActivity>,
    ) -> Result<(), String> {
        let update = self.mutate_thread(thread_id, |thread| {
            thread.last_error = snapshot.last_error;
            thread.messages = snapshot
                .messages
                .into_iter()
                .map(|message| MessageRecord {
                    id: message.id,
                    role: message.role,
                    status: message.status,
                    text: message.text,
                    timestamp_ms: message.timestamp_ms,
                })
                .collect();
            thread.queue = snapshot
                .queue
                .into_iter()
                .map(|entry| crate::model::QueueEntry {
                    id: entry.id,
                    mode: entry.mode,
                    status: entry.status,
                    text: entry.text,
                })
                .collect();
            thread.status = snapshot.status;
            thread.last_user_message_at_ms = latest_user_message_timestamp(
                thread.messages.iter(),
                thread.last_user_message_at_ms,
            );
            sync_thread_title_from_messages(thread);

            if let Some(detail) = activity {
                append_activity(thread, &detail.title, detail.detail, detail.tone);
            }

            Ok(())
        })?;
        self.persist_update(&update)?;
        self.emit_update(&update)?;
        Ok(())
    }

    fn bridge(&self) -> Result<Arc<PiBridge>, String> {
        self.inner
            .bridge
            .lock()
            .map_err(|_| "Bridge slot lock was poisoned.".to_string())?
            .clone()
            .ok_or_else(|| "Pi bridge is not initialized.".to_string())
    }
}

fn locate_thread(state: &PersistedState, thread_id: &str) -> Option<(usize, usize)> {
    state
        .projects
        .iter()
        .enumerate()
        .find_map(|(project_index, project)| {
            project
                .threads
                .iter()
                .enumerate()
                .find(|(_, thread)| thread.id == thread_id)
                .map(|(thread_index, _)| (project_index, thread_index))
        })
}

fn append_activity(
    thread: &mut ThreadRecord,
    title: &str,
    detail: String,
    tone: crate::model::ActivityTone,
) {
    thread.activities.push(ActivityRecord {
        detail,
        id: Uuid::new_v4().to_string(),
        timestamp_ms: now_ms(),
        title: title.to_string(),
        tone,
    });

    if thread.activities.len() > MAX_ACTIVITY_ENTRIES {
        let overflow = thread.activities.len() - MAX_ACTIVITY_ENTRIES;
        thread.activities.drain(0..overflow);
    }
}

fn mark_staged_attachments_sent(thread: &mut ThreadRecord) {
    for attachment in &mut thread.attachments {
        if attachment.stage == AttachmentStage::Staged {
            attachment.stage = AttachmentStage::Sent;
        }
    }
}

fn sync_thread_model_selection(
    thread: &mut ThreadRecord,
    available_model_keys: &HashSet<String>,
    default_model_key: Option<&str>,
) -> bool {
    let model_is_unavailable = thread
        .model_key
        .as_ref()
        .map(|current| !available_model_keys.contains(current))
        .unwrap_or(true);

    if !model_is_unavailable {
        return false;
    }

    let next_model_key = default_model_key.map(str::to_string);
    if thread.model_key == next_model_key {
        return false;
    }

    thread.model_key = next_model_key;
    true
}

fn normalize_state(state: &mut PersistedState) -> bool {
    let mut changed = false;

    for project in &mut state.projects {
        for thread in &mut project.threads {
            let last_user_message_at_ms = latest_user_message_timestamp(
                thread.messages.iter(),
                thread.last_user_message_at_ms,
            );
            if last_user_message_at_ms != thread.last_user_message_at_ms {
                thread.last_user_message_at_ms = last_user_message_at_ms;
                changed = true;
            }
            if matches!(thread.status, ThreadStatus::Running) {
                thread.status = ThreadStatus::Idle;
                if !thread.queue.is_empty() {
                    thread.queue.clear();
                }
                changed = true;
            }
        }
    }

    changed
}

fn sync_thread_title_from_messages(thread: &mut ThreadRecord) {
    if !should_derive_thread_title(&thread.title) {
        return;
    }

    let Some(message) = thread
        .messages
        .iter()
        .find(|message| matches!(message.role, MessageRole::User))
    else {
        return;
    };

    thread.title = derive_thread_title(&message.text);
}

fn latest_user_message_timestamp<'a>(
    messages: impl DoubleEndedIterator<Item = &'a MessageRecord>,
    fallback: u64,
) -> u64 {
    messages
        .rev()
        .find(|message| matches!(message.role, MessageRole::User))
        .map(|message| message.timestamp_ms)
        .unwrap_or(fallback)
}

fn update_thread_title(thread: &mut ThreadRecord, text: &str) {
    if should_derive_thread_title(&thread.title) {
        thread.title = derive_thread_title(text);
    }
}

fn should_derive_thread_title(title: &str) -> bool {
    let trimmed = title.trim();
    trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case("new thread")
        || trimmed.eq_ignore_ascii_case("explore repository")
}

fn derive_thread_title(text: &str) -> String {
    const MAX_TITLE_CHARS: usize = 48;

    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return "New thread".to_string();
    }

    let mut chars = normalized.chars();
    let mut title = chars.by_ref().take(MAX_TITLE_CHARS).collect::<String>();
    if chars.next().is_some() {
        title.push_str("...");
    }

    title
}

fn project_insert_index(
    current_index: usize,
    requested_target_index: usize,
    project_count: usize,
) -> usize {
    let mut target_index = requested_target_index;
    if current_index < requested_target_index {
        target_index = target_index.saturating_sub(1);
    }
    target_index.min(project_count)
}

#[cfg(target_os = "windows")]
fn launch_codex_login() -> Result<(), String> {
    Command::new("cmd")
        .args(["/C"])
        .raw_arg(r#"start "" cmd /K codex login"#)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_codex_login() -> Result<(), String> {
    launch_macos_codex_login()
}

#[cfg(target_os = "linux")]
fn launch_codex_login() -> Result<(), String> {
    launch_linux_codex_login()
}

#[cfg(test)]
mod tests {
    use super::{
        latest_user_message_timestamp, normalize_state, project_insert_index,
        sync_thread_model_selection,
    };
    use crate::model::{
        MessageRecord, MessageRole, MessageStatus, PersistedState, ProjectRecord, QueueEntry,
        QueueMode, QueueStatus, ThreadRecord, ThreadStatus,
    };
    use std::collections::HashSet;

    #[test]
    fn move_project_index_handles_start() {
        assert_eq!(project_insert_index(2, 0, 3), 0);
    }

    #[test]
    fn move_project_index_handles_end() {
        assert_eq!(project_insert_index(1, 4, 3), 3);
    }

    #[test]
    fn move_project_index_handles_backward_move() {
        assert_eq!(project_insert_index(3, 1, 3), 1);
    }

    #[test]
    fn move_project_index_handles_forward_move() {
        assert_eq!(project_insert_index(1, 3, 3), 2);
    }

    #[test]
    fn sync_thread_model_selection_clears_stale_key_without_default() {
        let mut thread = ThreadRecord {
            model_key: Some("openai::missing".to_string()),
            ..ThreadRecord::default()
        };

        sync_thread_model_selection(&mut thread, &HashSet::new(), None);

        assert_eq!(thread.model_key, None);
    }

    #[test]
    fn sync_thread_model_selection_replaces_stale_key_with_default() {
        let mut thread = ThreadRecord {
            model_key: Some("openai::missing".to_string()),
            ..ThreadRecord::default()
        };
        let available_model_keys = HashSet::from(["openai::gpt-5.4".to_string()]);

        sync_thread_model_selection(&mut thread, &available_model_keys, Some("openai::gpt-5.4"));

        assert_eq!(thread.model_key.as_deref(), Some("openai::gpt-5.4"));
    }

    #[test]
    fn normalize_state_clears_orphaned_queue_on_recovery() {
        let mut state = PersistedState {
            projects: vec![ProjectRecord {
                threads: vec![ThreadRecord {
                    messages: vec![MessageRecord {
                        id: "user-1".to_string(),
                        role: MessageRole::User,
                        status: MessageStatus::Ready,
                        text: "resume me".to_string(),
                        timestamp_ms: 42,
                    }],
                    queue: vec![QueueEntry {
                        id: "queued-1".to_string(),
                        mode: QueueMode::FollowUp,
                        status: QueueStatus::Pending,
                        text: "resume me".to_string(),
                    }],
                    status: ThreadStatus::Running,
                    ..ThreadRecord::default()
                }],
                ..ProjectRecord::default()
            }],
            ..PersistedState::default()
        };

        let changed = normalize_state(&mut state);
        let thread = &state.projects[0].threads[0];

        assert!(changed);
        assert_eq!(thread.last_user_message_at_ms, 42);
        assert!(matches!(thread.status, ThreadStatus::Idle));
        assert!(thread.queue.is_empty());
    }

    #[test]
    fn latest_user_message_timestamp_prefers_most_recent_user_message() {
        let messages = [
            MessageRecord {
                id: "assistant-1".to_string(),
                role: MessageRole::Assistant,
                status: MessageStatus::Ready,
                text: "done".to_string(),
                timestamp_ms: 30,
            },
            MessageRecord {
                id: "user-1".to_string(),
                role: MessageRole::User,
                status: MessageStatus::Ready,
                text: "first".to_string(),
                timestamp_ms: 40,
            },
            MessageRecord {
                id: "user-2".to_string(),
                role: MessageRole::User,
                status: MessageStatus::Ready,
                text: "latest".to_string(),
                timestamp_ms: 55,
            },
        ];

        let timestamp = latest_user_message_timestamp(messages.iter(), 10);

        assert_eq!(timestamp, 55);
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn launch_codex_login() -> Result<(), String> {
    Command::new("codex")
        .arg("login")
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_macos_codex_login() -> Result<(), String> {
    Command::new("osascript")
        .args([
            "-e",
            "tell application \"Terminal\" to activate",
            "-e",
            "tell application \"Terminal\" to do script \"codex login\"",
        ])
        .spawn()
        .map_err(|error| format!("Failed to launch Terminal for `codex login`: {error}"))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_linux_codex_login() -> Result<(), String> {
    const TERMINAL_CANDIDATES: [(&str, &[&str]); 8] = [
        ("gnome-terminal", &["--", "bash", "-lc", "codex login"]),
        ("konsole", &["-e", "bash", "-lc", "codex login"]),
        ("xterm", &["-e", "bash", "-lc", "codex login"]),
        ("alacritty", &["-e", "bash", "-lc", "codex login"]),
        ("kitty", &["--", "bash", "-lc", "codex login"]),
        ("wezterm", &["start", "--", "bash", "-lc", "codex login"]),
        ("tilix", &["-e", "bash", "-lc", "codex login"]),
        ("terminator", &["-x", "bash", "-lc", "codex login"]),
    ];

    for (terminal, args) in TERMINAL_CANDIDATES {
        match Command::new(terminal).args(args).spawn() {
            Ok(_) => return Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(format!(
                    "Failed to launch `{terminal}` for `codex login`: {error}"
                ));
            }
        }
    }

    Err(
        "Failed to launch `codex login`. No supported terminal emulator was found. Run `codex login` manually in a terminal."
            .to_string(),
    )
}
