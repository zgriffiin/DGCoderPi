use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadProjectDiffInput {
    pub hide_whitespace: bool,
    pub project_id: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisInput {
    pub hide_whitespace: bool,
    pub project_id: String,
    pub thread_id: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiffSnapshot {
    pub branch: String,
    pub files: Vec<ProjectDiffFile>,
    pub fingerprint: String,
    pub generated_at_ms: u64,
    pub git_available: bool,
    pub stats: ProjectDiffStats,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiffStats {
    pub additions: u32,
    pub deletions: u32,
    pub files_changed: u32,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiffFile {
    pub additions: u32,
    pub deletions: u32,
    pub hunks: Vec<ProjectDiffHunk>,
    pub id: String,
    pub is_binary: bool,
    pub is_generated: bool,
    pub is_too_large: bool,
    pub original_path: Option<String>,
    pub path: String,
    pub status: String,
    pub status_code: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiffHunk {
    pub header: String,
    pub id: String,
    pub lines: Vec<ProjectDiffLine>,
    pub new_lines: u32,
    pub new_start: u32,
    pub old_lines: u32,
    pub old_start: u32,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiffLine {
    pub kind: DiffLineKind,
    pub new_line: Option<u32>,
    pub old_line: Option<u32>,
    pub text: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiffLineKind {
    Added,
    Context,
    #[default]
    Meta,
    Removed,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum DiffAnalysisStatus {
    Complete,
    Failed,
    InProgress,
    #[default]
    Pending,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysis {
    pub change_brief: Vec<DiffAnalysisBriefItem>,
    pub continuation_token: Option<String>,
    pub error: Option<String>,
    pub fingerprint: String,
    pub focus_queue: Vec<DiffAnalysisFocusItem>,
    pub impact: Vec<DiffAnalysisImpactItem>,
    pub model_key: String,
    pub partial: bool,
    pub progress: u32,
    pub risks: Vec<DiffAnalysisRiskItem>,
    pub status: DiffAnalysisStatus,
    pub suggested_follow_ups: Vec<DiffAnalysisFollowUpItem>,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisBriefItem {
    pub detail: String,
    pub evidence: Vec<DiffEvidence>,
    pub title: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisImpactItem {
    pub area: String,
    pub detail: String,
    pub evidence: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisRiskItem {
    pub confidence: DiffPriority,
    pub detail: String,
    pub evidence: Vec<DiffEvidence>,
    pub level: DiffPriority,
    pub title: String,
    pub why_it_matters: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisFocusItem {
    pub file: String,
    pub hunk_id: String,
    pub priority: DiffPriority,
    pub reason: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisFollowUpItem {
    pub prompt: String,
    pub reason: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffEvidence {
    pub end_line: Option<u32>,
    pub file: String,
    pub hunk_id: String,
    pub start_line: Option<u32>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum DiffPriority {
    High,
    #[default]
    Low,
    Medium,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffThreadContext {
    pub latest_assistant_summary: Option<String>,
    pub latest_completed_turn_id: Option<String>,
    pub latest_user_request: Option<String>,
    pub thread_title: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffAnalysisRequest {
    pub batch_count: u32,
    pub batch_index: u32,
    pub diff: ProjectDiffSnapshot,
    pub model_key: String,
    pub project_name: String,
    pub thread_context: Option<DiffThreadContext>,
}
