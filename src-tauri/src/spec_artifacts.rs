use crate::model::{MessageRecord, MessageRole, ThreadRecord};

pub struct ResolvedSpecArtifact {
    pub artifact: &'static str,
    pub text: String,
}

struct SpecArtifactDefinition {
    artifact: &'static str,
    gate_label: &'static str,
    headings: &'static [&'static str],
}

const SPEC_ARTIFACT_DEFINITIONS: [SpecArtifactDefinition; 8] = [
    SpecArtifactDefinition {
        artifact: "intent.md",
        gate_label: "Intent Gate",
        headings: &["# Intent"],
    },
    SpecArtifactDefinition {
        artifact: "context.md",
        gate_label: "Understand Gate",
        headings: &["# Context Map"],
    },
    SpecArtifactDefinition {
        artifact: "requirements.md",
        gate_label: "Requirements Gate",
        headings: &["# Requirements"],
    },
    SpecArtifactDefinition {
        artifact: "design.md",
        gate_label: "Design Gate",
        headings: &["# Design"],
    },
    SpecArtifactDefinition {
        artifact: "tasks.md",
        gate_label: "Tasks Gate",
        headings: &["# Tasks"],
    },
    SpecArtifactDefinition {
        artifact: "implementation-log.md",
        gate_label: "Implementation Gate",
        headings: &["# Implementation Run", "# Implementation Result"],
    },
    SpecArtifactDefinition {
        artifact: "review.md",
        gate_label: "Review Gate",
        headings: &["# Review"],
    },
    SpecArtifactDefinition {
        artifact: "ship.md",
        gate_label: "Ship Gate",
        headings: &["# Ship"],
    },
];

pub fn extract_thread_spec_artifacts(thread: &ThreadRecord) -> Vec<ResolvedSpecArtifact> {
    SPEC_ARTIFACT_DEFINITIONS
        .iter()
        .filter_map(|definition| {
            let message =
                latest_assistant_message_for_gate(&thread.messages, definition.gate_label)?;
            let artifact_text = message
                .text
                .get(artifact_heading_index(&message.text, definition.headings)..)?
                .trim();
            (!artifact_text.is_empty()).then(|| ResolvedSpecArtifact {
                artifact: definition.artifact,
                text: artifact_text.to_string(),
            })
        })
        .collect()
}

fn latest_assistant_message_for_gate<'a>(
    messages: &'a [MessageRecord],
    gate_label: &str,
) -> Option<&'a MessageRecord> {
    let gate_label = gate_label.to_ascii_lowercase();
    messages.iter().rev().find(|message| {
        matches!(message.role, MessageRole::Assistant)
            && message.text.to_ascii_lowercase().contains(&gate_label)
    })
}

fn artifact_heading_index(message_text: &str, headings: &[&str]) -> usize {
    let candidate = headings
        .iter()
        .filter_map(|heading| message_text.find(heading))
        .min();
    if let Some(index) = candidate {
        return index;
    }

    message_text.find("# ").unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::extract_thread_spec_artifacts;
    use crate::model::{MessageRecord, MessageRole, MessageStatus, ThreadRecord};

    #[test]
    fn extracts_latest_matching_artifacts_from_assistant_messages() {
        let thread = ThreadRecord {
            messages: vec![
                MessageRecord {
                    id: "1".to_string(),
                    role: MessageRole::Assistant,
                    status: MessageStatus::Ready,
                    text: "noise".to_string(),
                    timestamp_ms: 1,
                },
                MessageRecord {
                    id: "2".to_string(),
                    role: MessageRole::Assistant,
                    status: MessageStatus::Ready,
                    text: "# Intent\n\nHello\n\n## Intent Gate\nStatus: PASS".to_string(),
                    timestamp_ms: 2,
                },
                MessageRecord {
                    id: "3".to_string(),
                    role: MessageRole::Assistant,
                    status: MessageStatus::Ready,
                    text: "# Tasks\n\nTask body\n\n## Tasks Gate\nStatus: PASS".to_string(),
                    timestamp_ms: 3,
                },
            ],
            ..ThreadRecord::default()
        };

        let artifacts = extract_thread_spec_artifacts(&thread);

        assert_eq!(artifacts.len(), 2);
        assert_eq!(artifacts[0].artifact, "intent.md");
        assert!(artifacts[0].text.starts_with("# Intent"));
        assert_eq!(artifacts[1].artifact, "tasks.md");
        assert!(artifacts[1].text.starts_with("# Tasks"));
    }

    #[test]
    fn prefers_latest_message_for_a_gate() {
        let thread = ThreadRecord {
            messages: vec![
                MessageRecord {
                    id: "1".to_string(),
                    role: MessageRole::Assistant,
                    status: MessageStatus::Ready,
                    text: "# Requirements\n\nOld\n\n## Requirements Gate\nStatus: FAIL".to_string(),
                    timestamp_ms: 1,
                },
                MessageRecord {
                    id: "2".to_string(),
                    role: MessageRole::Assistant,
                    status: MessageStatus::Ready,
                    text: "# Requirements\n\nNew\n\n## Requirements Gate\nStatus: PASS".to_string(),
                    timestamp_ms: 2,
                },
            ],
            ..ThreadRecord::default()
        };

        let artifacts = extract_thread_spec_artifacts(&thread);

        assert_eq!(artifacts.len(), 1);
        assert_eq!(artifacts[0].artifact, "requirements.md");
        assert!(artifacts[0].text.contains("New"));
    }
}
