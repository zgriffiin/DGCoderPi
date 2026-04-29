use std::path::Path;

use rusqlite::{params, Connection};

use crate::{diff_model::DiffAnalysis, state_store::state_db_path};

pub fn load_diff_analysis(
    data_dir: &Path,
    fingerprint: &str,
) -> Result<Option<DiffAnalysis>, String> {
    let connection = open_analysis_db(data_dir)?;
    let mut statement = connection
        .prepare("SELECT payload_json FROM diff_analysis_cache WHERE fingerprint = ?1")
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query(params![fingerprint])
        .map_err(|error| error.to_string())?;
    let Some(row) = rows.next().map_err(|error| error.to_string())? else {
        return Ok(None);
    };

    let payload: String = row.get(0).map_err(|error| error.to_string())?;
    let analysis = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
    Ok(Some(analysis))
}

pub fn save_diff_analysis(data_dir: &Path, analysis: &DiffAnalysis) -> Result<(), String> {
    let connection = open_analysis_db(data_dir)?;
    let payload_json = serde_json::to_string(analysis).map_err(|error| error.to_string())?;
    connection
        .execute(
            "
            INSERT INTO diff_analysis_cache (fingerprint, payload_json, updated_at_ms)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(fingerprint) DO UPDATE SET
                payload_json = excluded.payload_json,
                updated_at_ms = excluded.updated_at_ms
            ",
            params![
                analysis.fingerprint,
                payload_json,
                analysis.updated_at_ms as i64
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn open_analysis_db(data_dir: &Path) -> Result<Connection, String> {
    let connection =
        Connection::open(state_db_path(data_dir)).map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS diff_analysis_cache (
                fingerprint TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                updated_at_ms INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

#[cfg(test)]
mod tests {
    use super::{load_diff_analysis, save_diff_analysis};
    use crate::{
        diff_model::{DiffAnalysis, DiffAnalysisStatus},
        state_store::now_ms,
    };
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn cache_miss_then_hit_round_trips_analysis() {
        let data_dir = temp_data_dir("analysis-store-miss-hit");
        assert!(load_diff_analysis(data_dir.as_path(), "sha256:missing")
            .unwrap()
            .is_none());

        let analysis = DiffAnalysis {
            fingerprint: "sha256:abc".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::Complete,
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };
        save_diff_analysis(data_dir.as_path(), &analysis).unwrap();

        let loaded = load_diff_analysis(data_dir.as_path(), "sha256:abc")
            .unwrap()
            .unwrap();
        assert_eq!(loaded.fingerprint, analysis.fingerprint);
        assert_eq!(loaded.status, DiffAnalysisStatus::Complete);
    }

    #[test]
    fn fingerprint_invalidation_uses_distinct_rows() {
        let data_dir = temp_data_dir("analysis-store-fingerprint");
        let complete = DiffAnalysis {
            fingerprint: "sha256:complete".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::Complete,
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };
        let failed = DiffAnalysis {
            fingerprint: "sha256:failed".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::Failed,
            error: Some("boom".to_string()),
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };
        save_diff_analysis(data_dir.as_path(), &complete).unwrap();
        save_diff_analysis(data_dir.as_path(), &failed).unwrap();

        assert_eq!(
            load_diff_analysis(data_dir.as_path(), "sha256:complete")
                .unwrap()
                .unwrap()
                .status,
            DiffAnalysisStatus::Complete
        );
        assert_eq!(
            load_diff_analysis(data_dir.as_path(), "sha256:failed")
                .unwrap()
                .unwrap()
                .status,
            DiffAnalysisStatus::Failed
        );
    }

    #[test]
    fn failed_state_round_trips_error_payload() {
        let data_dir = temp_data_dir("analysis-store-failed");
        let failed = DiffAnalysis {
            fingerprint: "sha256:failed".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::Failed,
            error: Some("bridge timeout".to_string()),
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };

        save_diff_analysis(data_dir.as_path(), &failed).unwrap();

        let loaded = load_diff_analysis(data_dir.as_path(), "sha256:failed")
            .unwrap()
            .unwrap();
        assert_eq!(loaded.status, DiffAnalysisStatus::Failed);
        assert_eq!(loaded.error.as_deref(), Some("bridge timeout"));
    }

    fn temp_data_dir(prefix: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
