use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub health: AppHealth,
    pub models: Vec<ModelOption>,
    pub projects: Vec<ProjectRecord>,
    pub selected_project_id: Option<String>,
    pub selected_thread_id: Option<String>,
    pub settings: AppSettings,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub projects: Vec<ProjectRecord>,
    pub selected_project_id: Option<String>,
    pub selected_thread_id: Option<String>,
    pub settings: AppSettings,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealth {
    pub bridge_status: String,
    pub configured_provider_count: usize,
    pub model_count: usize,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub features: FeatureSettings,
    pub providers: Vec<ProviderStatus>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureSettings {
    pub docparser_enabled: bool,
}

impl Default for FeatureSettings {
    fn default() -> Self {
        Self {
            docparser_enabled: true,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub configured: bool,
    pub label: String,
    pub provider: String,
    pub source: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelOption {
    pub configured: bool,
    pub id: String,
    pub key: String,
    pub label: String,
    pub provider: String,
    pub supports_images: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub branch: String,
    pub id: String,
    pub name: String,
    pub path: String,
    pub threads: Vec<ThreadRecord>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadRecord {
    pub activities: Vec<ActivityRecord>,
    pub attachments: Vec<AttachmentRecord>,
    pub branch: String,
    pub id: String,
    pub last_error: Option<String>,
    pub messages: Vec<MessageRecord>,
    pub model_key: Option<String>,
    pub queue: Vec<QueueEntry>,
    pub status: ThreadStatus,
    pub title: String,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRecord {
    pub id: String,
    pub role: MessageRole,
    pub status: MessageStatus,
    pub text: String,
    pub timestamp_ms: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MessageRole {
    Assistant,
    #[default]
    System,
    Tool,
    User,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MessageStatus {
    Failed,
    #[default]
    Ready,
    Streaming,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRecord {
    pub detail: String,
    pub id: String,
    pub timestamp_ms: u64,
    pub title: String,
    pub tone: ActivityTone,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ActivityTone {
    Assistant,
    #[default]
    System,
    Tool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueEntry {
    pub id: String,
    pub mode: QueueMode,
    pub status: QueueStatus,
    pub text: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum QueueMode {
    #[default]
    FollowUp,
    Steer,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum QueueStatus {
    Failed,
    #[default]
    Pending,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentRecord {
    pub id: String,
    pub kind: AttachmentKind,
    pub mime_type: String,
    pub name: String,
    pub parse_status: AttachmentParseStatus,
    pub path: String,
    pub preview_text: Option<String>,
    pub size_bytes: u64,
    pub stage: AttachmentStage,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AttachmentKind {
    Binary,
    Code,
    Data,
    Document,
    Image,
    #[default]
    Text,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AttachmentParseStatus {
    Failed,
    #[default]
    Idle,
    Parsing,
    Ready,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AttachmentStage {
    #[default]
    Sent,
    Staged,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThreadStatus {
    Completed,
    Failed,
    #[default]
    Idle,
    Running,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddProjectInput {
    pub path: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateThreadInput {
    pub project_id: String,
    pub title: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderKeyInput {
    pub key: String,
    pub provider: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleFeatureInput {
    pub enabled: bool,
    pub feature: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageAttachmentInput {
    pub bytes: Vec<u8>,
    pub mime_type: String,
    pub name: String,
    pub thread_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveAttachmentInput {
    pub attachment_id: String,
    pub thread_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub mode: PromptMode,
    pub text: String,
    pub thread_id: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptMode {
    #[default]
    Prompt,
    FollowUp,
    Steer,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectModelInput {
    pub model_key: String,
    pub thread_id: String,
}
