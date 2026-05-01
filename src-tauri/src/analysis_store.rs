use std::path::Path;

use rusqlite::{params, Connection};

use crate::{diff_model::DiffAnalysis, state_store::state_db_path};

const MAX_DIFF_ANALYSIS_CACHE_ROWS: i64 = 256;
const STALE_ANALYSIS_ERROR: &str = "Diff analysis was interrupted before completion.";

pub fn load_diff_analysis(
    data_dir: &Path,
    fingerprint: &str,
    model_key: &str,
) -> Result<Option<DiffAnalysis>, String> {
    let connection = open_analysis_db(data_dir)?;
    let mut statement = connection
        .prepare(
            "SELECT payload_json FROM diff_analysis_cache WHERE fingerprint = ?1 AND model_key = ?2",
        )
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query(params![fingerprint, model_key])
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
            INSERT INTO diff_analysis_cache (fingerprint, model_key, payload_json, updated_at_ms)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(fingerprint, model_key) DO UPDATE SET
                payload_json = excluded.payload_json,
                updated_at_ms = excluded.updated_at_ms
            ",
            params![
                analysis.fingerprint,
                analysis.model_key,
                payload_json,
                analysis.updated_at_ms as i64
            ],
        )
        .map_err(|error| error.to_string())?;
    prune_diff_analysis_cache(&connection)?;
    Ok(())
}

pub fn fail_in_progress_diff_analyses(data_dir: &Path) -> Result<(), String> {
    let connection = open_analysis_db(data_dir)?;
    let mut statement = connection
        .prepare("SELECT fingerprint, model_key, payload_json FROM diff_analysis_cache")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut stale_analyses = Vec::new();
    for row in rows {
        let (_, _, payload_json) = row.map_err(|error| error.to_string())?;
        let mut analysis: DiffAnalysis =
            serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
        if !matches!(
            analysis.status,
            crate::diff_model::DiffAnalysisStatus::InProgress
        ) {
            continue;
        }
        analysis.status = crate::diff_model::DiffAnalysisStatus::Failed;
        analysis.error = Some(STALE_ANALYSIS_ERROR.to_string());
        stale_analyses.push(analysis);
    }
    drop(statement);

    for analysis in stale_analyses {
        save_diff_analysis(data_dir, &analysis)?;
    }
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
    migrate_analysis_cache(&connection)?;
    Ok(connection)
}

fn migrate_analysis_cache(connection: &Connection) -> Result<(), String> {
    let table_exists = {
        let mut statement = connection
            .prepare(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'diff_analysis_cache'",
            )
            .map_err(|error| error.to_string())?;
        let mut rows = statement.query([]).map_err(|error| error.to_string())?;
        rows.next().map_err(|error| error.to_string())?.is_some()
    };

    if !table_exists {
        return connection
            .execute_batch(
                "
                CREATE TABLE diff_analysis_cache (
                    fingerprint TEXT NOT NULL,
                    model_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    updated_at_ms INTEGER NOT NULL,
                    PRIMARY KEY (fingerprint, model_key)
                );
                CREATE INDEX idx_diff_analysis_cache_updated_at
                    ON diff_analysis_cache(updated_at_ms);
                ",
            )
            .map_err(|error| error.to_string());
    }

    let has_model_key = {
        let mut statement = connection
            .prepare("PRAGMA table_info(diff_analysis_cache)")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(|error| error.to_string())?;
        rows.filter_map(Result::ok)
            .collect::<Vec<_>>()
            .contains(&"model_key".to_string())
    };

    if !has_model_key {
        connection
            .execute_batch(
                "
                ALTER TABLE diff_analysis_cache RENAME TO diff_analysis_cache_legacy;
                CREATE TABLE diff_analysis_cache (
                    fingerprint TEXT NOT NULL,
                    model_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    updated_at_ms INTEGER NOT NULL,
                    PRIMARY KEY (fingerprint, model_key)
                );
                INSERT INTO diff_analysis_cache (fingerprint, model_key, payload_json, updated_at_ms)
                SELECT
                    fingerprint,
                    COALESCE(json_extract(payload_json, '$.modelKey'), ''),
                    payload_json,
                    updated_at_ms
                FROM diff_analysis_cache_legacy;
                DROP TABLE diff_analysis_cache_legacy;
                ",
            )
            .map_err(|error| error.to_string())?;
    }

    connection
        .execute(
            "CREATE INDEX IF NOT EXISTS idx_diff_analysis_cache_updated_at
                ON diff_analysis_cache(updated_at_ms)",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn prune_diff_analysis_cache(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "
            DELETE FROM diff_analysis_cache
            WHERE rowid IN (
                SELECT rowid
                FROM diff_analysis_cache
                ORDER BY updated_at_ms DESC
                LIMIT -1 OFFSET ?1
            )
            ",
            params![MAX_DIFF_ANALYSIS_CACHE_ROWS],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
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
        assert!(
            load_diff_analysis(data_dir.as_path(), "sha256:missing", "openai::gpt-5.4")
                .unwrap()
                .is_none()
        );

        let analysis = DiffAnalysis {
            fingerprint: "sha256:abc".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::Complete,
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };
        save_diff_analysis(data_dir.as_path(), &analysis).unwrap();

        let loaded = load_diff_analysis(data_dir.as_path(), "sha256:abc", "openai::gpt-5.4")
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
            load_diff_analysis(data_dir.as_path(), "sha256:complete", "openai::gpt-5.4")
                .unwrap()
                .unwrap()
                .status,
            DiffAnalysisStatus::Complete
        );
        assert_eq!(
            load_diff_analysis(data_dir.as_path(), "sha256:failed", "openai::gpt-5.4")
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

        let loaded = load_diff_analysis(data_dir.as_path(), "sha256:failed", "openai::gpt-5.4")
            .unwrap()
            .unwrap();
        assert_eq!(loaded.status, DiffAnalysisStatus::Failed);
        assert_eq!(loaded.error.as_deref(), Some("bridge timeout"));
    }

    #[test]
    fn identical_fingerprint_uses_distinct_rows_per_model() {
        let data_dir = temp_data_dir("analysis-store-model-key");
        let mini = DiffAnalysis {
            fingerprint: "sha256:shared".to_string(),
            model_key: "openai::gpt-5.4-mini".to_string(),
            status: DiffAnalysisStatus::Complete,
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };
        let standard = DiffAnalysis {
            fingerprint: "sha256:shared".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::Failed,
            error: Some("model-specific".to_string()),
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };

        save_diff_analysis(data_dir.as_path(), &mini).unwrap();
        save_diff_analysis(data_dir.as_path(), &standard).unwrap();

        assert_eq!(
            load_diff_analysis(data_dir.as_path(), "sha256:shared", "openai::gpt-5.4-mini")
                .unwrap()
                .unwrap()
                .status,
            DiffAnalysisStatus::Complete
        );
        assert_eq!(
            load_diff_analysis(data_dir.as_path(), "sha256:shared", "openai::gpt-5.4")
                .unwrap()
                .unwrap()
                .status,
            DiffAnalysisStatus::Failed
        );
    }

    #[test]
    fn cache_prunes_oldest_rows_after_limit() {
        let data_dir = temp_data_dir("analysis-store-prune");
        for index in 0..260 {
            let analysis = DiffAnalysis {
                fingerprint: format!("sha256:{index}"),
                model_key: "openai::gpt-5.4".to_string(),
                status: DiffAnalysisStatus::Complete,
                updated_at_ms: index,
                ..DiffAnalysis::default()
            };
            save_diff_analysis(data_dir.as_path(), &analysis).unwrap();
        }

        assert!(
            load_diff_analysis(data_dir.as_path(), "sha256:0", "openai::gpt-5.4")
                .unwrap()
                .is_none()
        );
        assert!(
            load_diff_analysis(data_dir.as_path(), "sha256:259", "openai::gpt-5.4")
                .unwrap()
                .is_some()
        );
    }

    #[test]
    fn startup_recovery_fails_in_progress_analysis() {
        let data_dir = temp_data_dir("analysis-store-recover-in-progress");
        let analysis = DiffAnalysis {
            fingerprint: "sha256:stale".to_string(),
            model_key: "openai::gpt-5.4".to_string(),
            status: DiffAnalysisStatus::InProgress,
            updated_at_ms: now_ms(),
            ..DiffAnalysis::default()
        };
        save_diff_analysis(data_dir.as_path(), &analysis).unwrap();

        super::fail_in_progress_diff_analyses(data_dir.as_path()).unwrap();

        let loaded = load_diff_analysis(data_dir.as_path(), "sha256:stale", "openai::gpt-5.4")
            .unwrap()
            .unwrap();
        assert_eq!(loaded.status, DiffAnalysisStatus::Failed);
        assert_eq!(loaded.error.as_deref(), Some(super::STALE_ANALYSIS_ERROR));
    }

    fn temp_data_dir(prefix: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
