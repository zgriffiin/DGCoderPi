use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
};

use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[cfg(target_os = "linux")]
use std::io::ErrorKind;

use crate::{
    model::{
        ActivityRecord, AddProjectInput, AppSnapshot, AttachmentParseStatus, AttachmentStage,
        CreateThreadInput, MessageRecord, MessageRole, MessageStatus, ModelOption,
        MoveProjectInput, PersistedState, ProjectDiffSnapshot, PromptMode, ProviderKeyInput,
        RemoveAttachmentInput, SelectModelInput, SelectReasoningInput, SendPromptInput,
        StageAttachmentInput, ThreadRecord, ThreadStatus, ToggleFeatureInput,
    },
    pi_bridge::{
        attachment_status_from_bridge, BridgeActivity, BridgeEnvironment, BridgeEvent,
        BridgePromptAttachment, BridgeThreadSnapshot, PiBridge,
    },
    state_store::{
        attachment_directory, build_snapshot, load_state, make_attachment, new_project, new_thread,
        now_ms, project_diff, read_codex_openai_key, read_codex_status, save_state,
    },
};

const SNAPSHOT_EVENT: &str = "app://snapshot";
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
            save_state(&data_dir, &state)?;
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

    pub fn snapshot_state(&self) -> Result<AppSnapshot, String> {
        self.snapshot()
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

    pub fn add_project(&self, input: AddProjectInput) -> Result<AppSnapshot, String> {
        let default_model = self.default_model_key();
        self.mutate_state(|state| {
            let mut project = new_project(&input.path);
            let thread = new_thread("Explore repository", &project.branch, default_model.clone());
            let project_id = project.id.clone();
            let thread_id = thread.id.clone();
            project.threads.push(thread);
            state.projects.push(project);
            state.selected_project_id = Some(project_id);
            state.selected_thread_id = Some(thread_id);
            Ok(())
        })
    }

    pub fn create_thread(&self, input: CreateThreadInput) -> Result<AppSnapshot, String> {
        let default_model = self.default_model_key();
        self.mutate_state(|state| {
            let project = state
                .projects
                .iter_mut()
                .find(|project| project.id == input.project_id)
                .ok_or_else(|| "Project not found.".to_string())?;
            let thread = new_thread(&input.title, &project.branch, default_model.clone());
            state.selected_project_id = Some(project.id.clone());
            state.selected_thread_id = Some(thread.id.clone());
            project.threads.push(thread);
            Ok(())
        })
    }

    pub fn move_project(&self, input: MoveProjectInput) -> Result<AppSnapshot, String> {
        self.mutate_state(|state| {
            let current_index = state
                .projects
                .iter()
                .position(|project| project.id == input.project_id)
                .ok_or_else(|| "Project not found.".to_string())?;
            if state.projects.len() < 2 {
                return Ok(());
            }

            let mut target_index = input.target_index;
            if current_index < input.target_index && target_index > 0 {
                target_index -= 1;
            }
            target_index = target_index.min(state.projects.len());

            let project = state.projects.remove(current_index);
            state
                .projects
                .insert(target_index.min(state.projects.len()), project);
            Ok(())
        })
    }

    pub fn select_model(&self, input: SelectModelInput) -> Result<AppSnapshot, String> {
        self.mutate_thread(&input.thread_id, |thread| {
            thread.model_key = Some(input.model_key.clone());
            Ok(())
        })
    }

    pub fn select_reasoning(&self, input: SelectReasoningInput) -> Result<AppSnapshot, String> {
        self.mutate_thread(&input.thread_id, |thread| {
            thread.reasoning_level = input.reasoning_level.clone();
            Ok(())
        })
    }

    pub fn set_provider_key(&self, input: ProviderKeyInput) -> Result<AppSnapshot, String> {
        let environment = self
            .bridge()?
            .set_provider_key(&input.provider, &input.key)?;
        self.sync_environment(environment)?;
        self.snapshot()
    }

    pub fn import_codex_openai_key(&self) -> Result<AppSnapshot, String> {
        let key = read_codex_openai_key()?;
        let environment = self.bridge()?.set_provider_key("openai", &key)?;
        self.sync_environment(environment)?;
        self.snapshot()
    }

    pub fn start_codex_login(&self) -> Result<AppSnapshot, String> {
        launch_codex_login()?;
        self.snapshot()
    }

    pub fn set_feature_toggle(&self, input: ToggleFeatureInput) -> Result<AppSnapshot, String> {
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
        self.sync_environment(environment)?;
        self.snapshot()
    }

    pub fn stage_attachment(&self, input: StageAttachmentInput) -> Result<AppSnapshot, String> {
        let attachment_id = Uuid::new_v4().to_string();
        let attachment_dir = attachment_directory(&self.inner.data_dir).join(&input.thread_id);
        fs::create_dir_all(&attachment_dir).map_err(|error| error.to_string())?;

        let file_name = format!("{}-{}", &attachment_id[..8], input.name);
        let file_path = attachment_dir.join(file_name);
        fs::write(&file_path, &input.bytes).map_err(|error| error.to_string())?;

        self.mutate_thread(&input.thread_id, |thread| {
            let mut attachment = make_attachment(
                attachment_id.clone(),
                input.name.clone(),
                input.mime_type.clone(),
                file_path.to_string_lossy().to_string(),
                input.bytes.len() as u64,
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
                format!("{} is ready for the next turn.", input.name),
                crate::model::ActivityTone::System,
            );
            Ok(())
        })?;

        self.spawn_attachment_parse(&input.thread_id, &attachment_id, file_path);
        self.snapshot()
    }

    pub fn remove_attachment(&self, input: RemoveAttachmentInput) -> Result<AppSnapshot, String> {
        self.mutate_thread(&input.thread_id, |thread| {
            thread
                .attachments
                .retain(|attachment| attachment.id != input.attachment_id);
            Ok(())
        })
    }

    pub fn send_prompt(&self, input: SendPromptInput) -> Result<AppSnapshot, String> {
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

        self.mutate_thread(&input.thread_id, |thread| {
            if matches!(effective_mode, PromptMode::Prompt) {
                mark_staged_attachments_sent(thread);
                update_thread_title(thread, &input.text);
                if let Some(message) = &pending_message {
                    thread.messages.push(message.clone());
                }
            } else if let Some(queue_entry) = &pending_queue_entry {
                thread.queue.push(queue_entry.clone());
            }
            thread.status = ThreadStatus::Running;
            thread.last_error = None;
            Ok(())
        })?;

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
            self.mutate_thread(&input.thread_id, |thread| {
                for attachment in &mut thread.attachments {
                    if staged_attachment_paths.contains(&attachment.path)
                        && attachment.stage == AttachmentStage::Sent
                    {
                        attachment.stage = AttachmentStage::Staged;
                    }
                }
                if let Some(message) = &pending_message {
                    thread.messages.retain(|entry| entry.id != message.id);
                }
                if let Some(queue_entry) = &pending_queue_entry {
                    thread.queue.retain(|entry| entry.id != queue_entry.id);
                }
                thread.last_error = Some(error.clone());
                thread.status = thread_status.clone();
                Ok(())
            })?;
            return Err(error);
        }

        self.snapshot()
    }

    pub fn abort_thread(&self, thread_id: &str) -> Result<AppSnapshot, String> {
        self.bridge()?.abort(thread_id)?;
        self.mutate_thread(thread_id, |thread| {
            thread.status = ThreadStatus::Idle;
            append_activity(
                thread,
                "Run stopped",
                "Pi was asked to stop the current run.".to_string(),
                crate::model::ActivityTone::System,
            );
            Ok(())
        })
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
            .map_err(|_| "State lock was poisoned.".to_string())?;
        Ok(build_snapshot(
            &state,
            models,
            &self.bridge()?.status(),
            read_codex_status(),
        ))
    }

    fn refresh_environment(&self) -> Result<(), String> {
        let environment = self.bridge()?.refresh_environment()?;
        self.sync_environment(environment)
    }

    fn sync_environment(&self, environment: BridgeEnvironment) -> Result<(), String> {
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

        self.mutate_state(|state| {
            state.settings.providers = environment.providers;
            if let Some(model_key) = &default_model_key {
                for project in &mut state.projects {
                    for thread in &mut project.threads {
                        let model_is_unavailable = thread
                            .model_key
                            .as_ref()
                            .map(|current| !available_model_keys.contains(current))
                            .unwrap_or(true);

                        if model_is_unavailable {
                            thread.model_key = Some(model_key.clone());
                        }
                    }
                }
            }
            Ok(())
        })?;
        Ok(())
    }

    fn mutate_state<F>(&self, mutator: F) -> Result<AppSnapshot, String>
    where
        F: FnOnce(&mut PersistedState) -> Result<(), String>,
    {
        {
            let mut state = self
                .inner
                .state
                .lock()
                .map_err(|_| "State lock was poisoned.".to_string())?;
            mutator(&mut state)?;
            save_state(&self.inner.data_dir, &state)?;
        }
        self.emit_snapshot()?;
        self.snapshot()
    }

    fn mutate_thread<F>(&self, thread_id: &str, mutator: F) -> Result<AppSnapshot, String>
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
        })
    }

    fn emit_snapshot(&self) -> Result<(), String> {
        let snapshot = self.snapshot()?;
        self.inner
            .app
            .emit(SNAPSHOT_EVENT, snapshot)
            .map_err(|error| error.to_string())
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
        let model_key = thread
            .model_key
            .clone()
            .ok_or_else(|| "Select a configured model before sending a prompt.".to_string())?;
        let thinking_level = format!("{:?}", thread.reasoning_level).to_ascii_lowercase();

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
            .collect();

        Ok((
            project.path.clone(),
            model_key,
            thinking_level,
            attachments,
            thread.status.clone(),
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
        self.mutate_thread(thread_id, |thread| {
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
        Ok(())
    }

    fn handle_bridge_event(&self, event: BridgeEvent) {
        let BridgeEvent::ThreadUpdate {
            thread_id,
            snapshot,
            activity,
        } = event;
        let _ = self.apply_thread_snapshot(&thread_id, snapshot, activity);
    }

    fn apply_thread_snapshot(
        &self,
        thread_id: &str,
        snapshot: BridgeThreadSnapshot,
        activity: Option<BridgeActivity>,
    ) -> Result<(), String> {
        self.mutate_thread(thread_id, |thread| {
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
            sync_thread_title_from_messages(thread);

            if let Some(detail) = activity {
                append_activity(thread, &detail.title, detail.detail, detail.tone);
            }

            Ok(())
        })?;
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

fn normalize_state(state: &mut PersistedState) -> bool {
    let mut changed = false;

    for project in &mut state.projects {
        for thread in &mut project.threads {
            if matches!(thread.status, ThreadStatus::Running) {
                thread.status = ThreadStatus::Idle;
                changed = true;
            }

            if !thread.queue.is_empty() {
                thread.queue.clear();
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

fn update_thread_title(thread: &mut ThreadRecord, text: &str) {
    if should_derive_thread_title(&thread.title) {
        thread.title = derive_thread_title(text);
    }
}

fn should_derive_thread_title(title: &str) -> bool {
    let trimmed = title.trim();
    trimmed.is_empty() || trimmed.eq_ignore_ascii_case("new thread")
}

fn derive_thread_title(text: &str) -> String {
    const MAX_TITLE_CHARS: usize = 48;

    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return "New thread".to_string();
    }

    let mut title = normalized.chars().take(MAX_TITLE_CHARS).collect::<String>();
    if normalized.chars().count() > MAX_TITLE_CHARS {
        title.push_str("...");
    }

    title
}

#[cfg(target_os = "windows")]
fn launch_codex_login() -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", "cmd", "/K", "codex login"])
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
    const TERMINAL_CANDIDATES: [(&str, &[&str]); 5] = [
        ("gnome-terminal", &["--", "bash", "-lc", "codex login"]),
        ("konsole", &["-e", "bash", "-lc", "codex login"]),
        ("xterm", &["-e", "bash", "-lc", "codex login"]),
        ("alacritty", &["-e", "bash", "-lc", "codex login"]),
        ("kitty", &["sh", "-lc", "codex login"]),
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
