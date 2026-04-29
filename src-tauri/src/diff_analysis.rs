use std::collections::{HashMap, HashSet};

use crate::{
    diff_model::{
        DiffAnalysis, DiffAnalysisBriefItem, DiffAnalysisFocusItem, DiffAnalysisFollowUpItem,
        DiffAnalysisImpactItem, DiffAnalysisRequest, DiffAnalysisRiskItem, DiffAnalysisStatus,
        DiffEvidence, DiffPriority, ProjectDiffFile, ProjectDiffSnapshot,
    },
    model::ThreadRecord,
    pi_bridge::PiBridge,
    state_store::now_ms,
};

const MAX_CHUNK_TEXT_BYTES: usize = 18_000;
const MAX_CHANGE_BRIEF_ITEMS: usize = 5;
const MAX_IMPACT_ITEMS: usize = 5;
const MAX_RISK_ITEMS: usize = 6;
const MAX_FOCUS_ITEMS: usize = 6;
const MAX_FOLLOW_UP_ITEMS: usize = 4;

pub fn pending_analysis(snapshot: &ProjectDiffSnapshot, model_key: &str) -> DiffAnalysis {
    DiffAnalysis {
        fingerprint: snapshot.fingerprint.clone(),
        model_key: model_key.to_string(),
        progress: 0,
        status: DiffAnalysisStatus::Pending,
        updated_at_ms: now_ms(),
        ..DiffAnalysis::default()
    }
}

pub fn build_thread_context(thread: Option<&ThreadRecord>) -> crate::diff_model::DiffThreadContext {
    let latest_user_request = thread.and_then(|thread| {
        thread
            .messages
            .iter()
            .rev()
            .find(|message| matches!(message.role, crate::model::MessageRole::User))
            .map(|message| truncate_text(&message.text, 1_200))
    });
    let latest_assistant_summary = thread.and_then(|thread| {
        thread
            .messages
            .iter()
            .rev()
            .find(|message| matches!(message.role, crate::model::MessageRole::Assistant))
            .map(|message| truncate_text(&message.text, 1_200))
    });

    crate::diff_model::DiffThreadContext {
        latest_assistant_summary,
        latest_completed_turn_id: thread.map(|thread| thread.updated_at_ms.to_string()),
        latest_user_request,
        thread_title: thread.map(|thread| thread.title.clone()),
    }
}

pub fn analyze_diff<F>(
    bridge: &PiBridge,
    request: DiffAnalysisRequest,
    mut on_progress: F,
) -> Result<DiffAnalysis, String>
where
    F: FnMut(&DiffAnalysis) -> Result<(), String>,
{
    let chunks = chunk_diff(&request.diff);
    if chunks.is_empty() {
        let mut analysis = pending_analysis(&request.diff, &request.model_key);
        analysis.status = DiffAnalysisStatus::Complete;
        analysis.progress = 100;
        analysis.updated_at_ms = now_ms();
        return Ok(analysis);
    }

    let mut aggregate = pending_analysis(&request.diff, &request.model_key);
    aggregate.status = DiffAnalysisStatus::InProgress;
    on_progress(&aggregate)?;

    let total_chunks = chunks.len();
    for (index, chunk_files) in chunks.into_iter().enumerate() {
        let chunk_request = DiffAnalysisRequest {
            diff: ProjectDiffSnapshot {
                files: chunk_files,
                ..request.diff.clone()
            },
            model_key: request.model_key.clone(),
            project_name: request.project_name.clone(),
            thread_context: request.thread_context.clone(),
        };
        let chunk_analysis = bridge.analyze_diff(&chunk_request)?;
        merge_analysis(&mut aggregate, &chunk_analysis);
        aggregate.partial = index + 1 != total_chunks;
        aggregate.progress = (((index + 1) * 100) / total_chunks.max(1)) as u32;
        aggregate.status = DiffAnalysisStatus::InProgress;
        aggregate.updated_at_ms = now_ms();
        on_progress(&aggregate)?;
    }

    finalize_analysis(&mut aggregate);
    Ok(aggregate)
}

pub fn failed_analysis(
    snapshot: &ProjectDiffSnapshot,
    model_key: &str,
    error: String,
) -> DiffAnalysis {
    DiffAnalysis {
        error: Some(error),
        fingerprint: snapshot.fingerprint.clone(),
        model_key: model_key.to_string(),
        progress: 100,
        status: DiffAnalysisStatus::Failed,
        updated_at_ms: now_ms(),
        ..DiffAnalysis::default()
    }
}

fn chunk_diff(snapshot: &ProjectDiffSnapshot) -> Vec<Vec<ProjectDiffFile>> {
    let mut chunks = Vec::new();
    let mut current_chunk = Vec::new();
    let mut current_bytes = 0;

    for file in &snapshot.files {
        let file_bytes = estimate_file_bytes(file);
        if !current_chunk.is_empty() && current_bytes + file_bytes > MAX_CHUNK_TEXT_BYTES {
            chunks.push(current_chunk);
            current_chunk = Vec::new();
            current_bytes = 0;
        }

        current_bytes += file_bytes;
        current_chunk.push(file.clone());
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    chunks
}

fn estimate_file_bytes(file: &ProjectDiffFile) -> usize {
    file.hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .map(|line| line.text.len() + 24)
        .sum::<usize>()
        .max(file.path.len() + 32)
}

fn merge_analysis(target: &mut DiffAnalysis, source: &DiffAnalysis) {
    merge_change_brief(&mut target.change_brief, &source.change_brief);
    merge_impact(&mut target.impact, &source.impact);
    merge_risks(&mut target.risks, &source.risks);
    merge_focus_queue(&mut target.focus_queue, &source.focus_queue);
    merge_follow_ups(
        &mut target.suggested_follow_ups,
        &source.suggested_follow_ups,
    );
}

fn merge_change_brief(target: &mut Vec<DiffAnalysisBriefItem>, source: &[DiffAnalysisBriefItem]) {
    let mut seen = target
        .iter()
        .map(|item| format!("{}::{}", item.title, item.detail))
        .collect::<HashSet<_>>();
    for item in source {
        let key = format!("{}::{}", item.title, item.detail);
        if seen.insert(key) {
            target.push(item.clone());
        }
    }
    target.truncate(MAX_CHANGE_BRIEF_ITEMS);
}

fn merge_impact(target: &mut Vec<DiffAnalysisImpactItem>, source: &[DiffAnalysisImpactItem]) {
    let mut seen = target
        .iter()
        .map(|item| format!("{}::{}", item.area, item.detail))
        .collect::<HashSet<_>>();
    for item in source {
        let key = format!("{}::{}", item.area, item.detail);
        if seen.insert(key) {
            target.push(item.clone());
        }
    }
    target.truncate(MAX_IMPACT_ITEMS);
}

fn merge_risks(target: &mut Vec<DiffAnalysisRiskItem>, source: &[DiffAnalysisRiskItem]) {
    let mut best = target
        .drain(..)
        .map(|item| (risk_key(&item), item))
        .collect::<HashMap<_, _>>();

    for item in source {
        let key = risk_key(item);
        match best.get(&key) {
            Some(existing) if priority_rank(&existing.level) > priority_rank(&item.level) => {}
            Some(existing)
                if priority_rank(&existing.level) == priority_rank(&item.level)
                    && priority_rank(&existing.confidence) >= priority_rank(&item.confidence) => {}
            _ => {
                best.insert(key, item.clone());
            }
        }
    }

    let mut merged = best.into_values().collect::<Vec<_>>();
    merged.sort_by(|left, right| {
        priority_rank(&right.level)
            .cmp(&priority_rank(&left.level))
            .then(priority_rank(&right.confidence).cmp(&priority_rank(&left.confidence)))
    });
    merged.truncate(MAX_RISK_ITEMS);
    *target = merged;
}

fn merge_focus_queue(target: &mut Vec<DiffAnalysisFocusItem>, source: &[DiffAnalysisFocusItem]) {
    let mut seen = target
        .iter()
        .map(|item| format!("{}::{}", item.file, item.hunk_id))
        .collect::<HashSet<_>>();
    for item in source {
        let key = format!("{}::{}", item.file, item.hunk_id);
        if seen.insert(key) {
            target.push(item.clone());
        }
    }
    target.sort_by_key(|item| std::cmp::Reverse(priority_rank(&item.priority)));
    target.truncate(MAX_FOCUS_ITEMS);
}

fn merge_follow_ups(
    target: &mut Vec<DiffAnalysisFollowUpItem>,
    source: &[DiffAnalysisFollowUpItem],
) {
    let mut seen = target
        .iter()
        .map(|item| format!("{}::{}", item.prompt, item.reason))
        .collect::<HashSet<_>>();
    for item in source {
        let key = format!("{}::{}", item.prompt, item.reason);
        if seen.insert(key) {
            target.push(item.clone());
        }
    }
    target.truncate(MAX_FOLLOW_UP_ITEMS);
}

fn finalize_analysis(analysis: &mut DiffAnalysis) {
    analysis.partial = false;
    analysis.progress = 100;
    analysis.status = DiffAnalysisStatus::Complete;
    analysis.updated_at_ms = now_ms();

    if analysis.change_brief.is_empty() {
        analysis.change_brief.push(DiffAnalysisBriefItem {
            detail: "The diff is small or mechanical, so the review did not identify a stronger summary theme.".to_string(),
            evidence: best_available_evidence(analysis),
            title: "Small change set".to_string(),
        });
    }

    if analysis.focus_queue.is_empty() {
        if let Some(evidence) = best_available_evidence(analysis).into_iter().next() {
            analysis.focus_queue.push(DiffAnalysisFocusItem {
                file: evidence.file,
                hunk_id: evidence.hunk_id,
                priority: DiffPriority::Low,
                reason:
                    "Inspect the changed hunk directly to confirm the diff matches the summary."
                        .to_string(),
            });
        }
    }
}

fn best_available_evidence(analysis: &DiffAnalysis) -> Vec<DiffEvidence> {
    analysis
        .change_brief
        .iter()
        .flat_map(|item| item.evidence.iter().cloned())
        .chain(
            analysis
                .risks
                .iter()
                .flat_map(|item| item.evidence.iter().cloned()),
        )
        .take(1)
        .collect()
}

fn risk_key(item: &DiffAnalysisRiskItem) -> String {
    format!("{}::{}::{}", item.title, item.detail, item.why_it_matters)
}

fn priority_rank(priority: &DiffPriority) -> usize {
    match priority {
        DiffPriority::Low => 1,
        DiffPriority::Medium => 2,
        DiffPriority::High => 3,
    }
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    let mut chars = text.chars();
    let mut output = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() {
        output.push_str("...");
    }
    output
}
