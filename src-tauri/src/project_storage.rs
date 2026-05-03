use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::model::{AttachmentRecord, PersistedState};

const DOC_DIR_NAME: &str = ".doc";
const ATTACHMENTS_DIR_NAME: &str = "attachments";

fn attachment_prefix(attachment_id: &str) -> &str {
    attachment_id.get(..8).unwrap_or(attachment_id)
}

pub fn project_doc_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(DOC_DIR_NAME)
}

pub fn project_attachment_dir(project_path: &str, thread_id: &str) -> PathBuf {
    project_doc_dir(project_path)
        .join(ATTACHMENTS_DIR_NAME)
        .join(thread_id)
}

pub fn project_attachment_path(
    project_path: &str,
    thread_id: &str,
    attachment_id: &str,
    attachment_name: &str,
) -> PathBuf {
    project_attachment_dir(project_path, thread_id).join(format!(
        "{}-{}",
        attachment_prefix(attachment_id),
        attachment_name
    ))
}

pub fn migrate_attachments_to_project_storage(state: &mut PersistedState) -> Result<bool, String> {
    let mut changed = false;

    for project in &mut state.projects {
        let project_root = Path::new(&project.path);
        if !project_root.exists() {
            continue;
        }

        for thread in &mut project.threads {
            for attachment in &mut thread.attachments {
                let target_path = desired_attachment_path(&project.path, &thread.id, attachment);
                if Path::new(&attachment.path) == target_path {
                    continue;
                }

                fs::create_dir_all(target_path.parent().unwrap_or(project_root))
                    .map_err(|error| error.to_string())?;
                relocate_attachment(Path::new(&attachment.path), &target_path)?;

                if target_path.exists() {
                    attachment.path = target_path.to_string_lossy().to_string();
                    changed = true;
                }
            }
        }
    }

    Ok(changed)
}

fn desired_attachment_path(
    project_path: &str,
    thread_id: &str,
    attachment: &AttachmentRecord,
) -> PathBuf {
    let current_name = Path::new(&attachment.path)
        .file_name()
        .filter(|value| !value.is_empty())
        .map(PathBuf::from);
    let fallback_name = PathBuf::from(format!(
        "{}-{}",
        attachment_prefix(&attachment.id),
        attachment.name
    ));

    project_attachment_dir(project_path, thread_id).join(current_name.unwrap_or(fallback_name))
}

fn relocate_attachment(source_path: &Path, target_path: &Path) -> Result<(), String> {
    if target_path.exists() {
        return Ok(());
    }

    if !source_path.exists() {
        return Ok(());
    }

    match fs::rename(source_path, target_path) {
        Ok(()) => Ok(()),
        Err(_) => {
            fs::copy(source_path, target_path).map_err(|copy_error| copy_error.to_string())?;
            fs::remove_file(source_path).map_err(|remove_error| remove_error.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{env, fs, path::PathBuf};

    use uuid::Uuid;

    use super::{migrate_attachments_to_project_storage, project_attachment_path};
    use crate::model::{AttachmentRecord, PersistedState, ProjectRecord, ThreadRecord};

    fn temp_path(prefix: &str) -> PathBuf {
        env::temp_dir().join(format!("dgcoder-pi-{prefix}-{}", Uuid::new_v4()))
    }

    #[test]
    fn project_attachment_path_uses_repo_local_doc_folder() {
        let path = project_attachment_path("C:/repo", "thread-1", "12345678-0000", "brief.pdf");

        assert_eq!(
            path,
            PathBuf::from("C:/repo")
                .join(".doc")
                .join("attachments")
                .join("thread-1")
                .join("12345678-brief.pdf")
        );
    }

    #[test]
    fn migration_moves_attachment_into_project_doc_folder_and_updates_state() {
        let repo_root = temp_path("repo");
        let app_data_root = temp_path("data");
        let legacy_thread_dir = app_data_root.join("attachments").join("thread-1");
        let legacy_file = legacy_thread_dir.join("12345678-brief.pdf");
        let expected_file = repo_root
            .join(".doc")
            .join("attachments")
            .join("thread-1")
            .join("12345678-brief.pdf");

        fs::create_dir_all(&legacy_thread_dir).unwrap();
        fs::create_dir_all(&repo_root).unwrap();
        fs::write(&legacy_file, b"hello").unwrap();

        let mut state = PersistedState {
            projects: vec![ProjectRecord {
                path: repo_root.to_string_lossy().to_string(),
                threads: vec![ThreadRecord {
                    id: "thread-1".to_string(),
                    attachments: vec![AttachmentRecord {
                        id: "12345678-aaaa-bbbb-cccc-ddddeeeeffff".to_string(),
                        name: "brief.pdf".to_string(),
                        path: legacy_file.to_string_lossy().to_string(),
                        ..AttachmentRecord::default()
                    }],
                    ..ThreadRecord::default()
                }],
                ..ProjectRecord::default()
            }],
            ..PersistedState::default()
        };

        let changed = migrate_attachments_to_project_storage(&mut state).unwrap();

        assert!(changed);
        assert!(expected_file.exists());
        assert!(!legacy_file.exists());
        assert_eq!(
            state.projects[0].threads[0].attachments[0].path,
            expected_file.to_string_lossy()
        );

        fs::remove_dir_all(&repo_root).unwrap();
        fs::remove_dir_all(&app_data_root).unwrap();
    }
}
