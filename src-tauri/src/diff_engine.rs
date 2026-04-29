use std::{collections::HashMap, fs, path::Path, process::Command};

use sha2::{Digest, Sha256};

use crate::{
    diff_model::{
        DiffLineKind, ProjectDiffFile, ProjectDiffHunk, ProjectDiffLine, ProjectDiffSnapshot,
        ProjectDiffStats,
    },
    state_store::now_ms,
};

const MAX_RENDER_LINES: usize = 1_600;
const MAX_RENDER_TEXT_BYTES: usize = 160_000;
const MAX_UNTRACKED_TEXT_BYTES: usize = 96_000;

#[derive(Clone, Copy, Debug, Default)]
pub struct ProjectDiffOptions {
    pub hide_whitespace: bool,
}

#[derive(Clone, Debug, Default)]
struct StatusEntry {
    original_path: Option<String>,
    path: String,
    status: String,
    status_code: String,
}

pub fn project_diff(path: &str, branch: &str, options: ProjectDiffOptions) -> ProjectDiffSnapshot {
    let status_entries = match git_status_entries(path) {
        Ok(entries) => entries,
        Err(_) => {
            return ProjectDiffSnapshot {
                branch: branch.to_string(),
                fingerprint: empty_fingerprint(),
                generated_at_ms: now_ms(),
                git_available: false,
                ..ProjectDiffSnapshot::default()
            };
        }
    };
    let patch_files = git_patch_files(path, options).unwrap_or_default();
    let mut files = merge_diff_files(path, status_entries, patch_files);
    files.sort_by(|left, right| left.path.cmp(&right.path));

    let stats = ProjectDiffStats {
        additions: files.iter().map(|file| file.additions).sum(),
        deletions: files.iter().map(|file| file.deletions).sum(),
        files_changed: files.len(),
    };
    let fingerprint = diff_fingerprint(branch, options.hide_whitespace, &files);

    ProjectDiffSnapshot {
        branch: branch.to_string(),
        files,
        fingerprint,
        generated_at_ms: now_ms(),
        git_available: true,
        stats,
    }
}

fn merge_diff_files(
    repo_path: &str,
    status_entries: Vec<StatusEntry>,
    patch_files: Vec<ProjectDiffFile>,
) -> Vec<ProjectDiffFile> {
    let mut patch_by_id = patch_files
        .into_iter()
        .map(|file| (file.id.clone(), file))
        .collect::<HashMap<_, _>>();
    let mut files = Vec::with_capacity(status_entries.len());

    for status in status_entries {
        let mut file = patch_by_id.remove(&status.path).unwrap_or_else(|| {
            fallback_diff_file(repo_path, &status).unwrap_or_else(|| {
                blank_diff_file(&status.path, &status.status, &status.status_code)
            })
        });
        file.original_path = status.original_path;
        file.status = status.status;
        file.status_code = status.status_code;
        file.id = file.path.clone();
        file.is_generated = infer_generated_file(&file.path);
        apply_render_limits(&mut file);
        files.push(file);
    }

    files.extend(patch_by_id.into_values());
    files
}

fn fallback_diff_file(repo_path: &str, status: &StatusEntry) -> Option<ProjectDiffFile> {
    if status.status_code != "??" {
        return None;
    }

    let file_path = Path::new(repo_path).join(&status.path);
    let bytes = fs::read(&file_path).ok()?;
    let mut file = blank_diff_file(&status.path, &status.status, &status.status_code);
    file.is_generated = infer_generated_file(&status.path);
    if bytes.len() > MAX_UNTRACKED_TEXT_BYTES || looks_binary(&bytes) {
        file.is_binary = looks_binary(&bytes);
        file.is_too_large = bytes.len() > MAX_UNTRACKED_TEXT_BYTES;
        return Some(file);
    }

    let text = String::from_utf8(bytes).ok()?;
    let lines = text.lines().collect::<Vec<_>>();
    let hunk_id = format!("{}:0:1:0", status.path);
    let diff_lines = lines
        .iter()
        .enumerate()
        .map(|(index, line)| ProjectDiffLine {
            kind: DiffLineKind::Added,
            new_line: Some(index + 1),
            old_line: None,
            text: (*line).to_string(),
        })
        .collect::<Vec<_>>();

    file.additions = diff_lines.len();
    file.hunks.push(ProjectDiffHunk {
        header: format!("@@ -0,0 +1,{} @@", diff_lines.len()),
        id: hunk_id,
        lines: diff_lines,
        new_lines: file.additions,
        new_start: 1,
        old_lines: 0,
        old_start: 0,
    });
    Some(file)
}

fn blank_diff_file(path: &str, status: &str, status_code: &str) -> ProjectDiffFile {
    ProjectDiffFile {
        id: path.to_string(),
        path: path.to_string(),
        status: status.to_string(),
        status_code: status_code.to_string(),
        ..ProjectDiffFile::default()
    }
}

fn git_status_entries(path: &str) -> Result<Vec<StatusEntry>, String> {
    let output = Command::new("git")
        .args([
            "-C",
            path,
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let mut records = output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty());
    let mut entries = Vec::new();

    while let Some(record) = records.next() {
        if record.len() < 4 {
            continue;
        }

        let code = String::from_utf8_lossy(&record[..2]).to_string();
        if code.chars().all(char::is_whitespace) {
            continue;
        }

        let mut path = decode_git_path(String::from_utf8_lossy(&record[3..]).as_ref());
        let mut original_path = None;
        if code.chars().any(|status| matches!(status, 'R' | 'C')) {
            let Some(source_record) = records.next() else {
                continue;
            };
            original_path = Some(decode_git_path(
                String::from_utf8_lossy(source_record).as_ref(),
            ));
        }

        if path.is_empty() {
            continue;
        }

        let status_code = primary_status_code(&code);
        if status_code == "?" {
            path = path.trim().to_string();
        }
        let normalized_status_code = if status_code == "?" {
            "??".to_string()
        } else {
            status_code.to_string()
        };

        entries.push(StatusEntry {
            original_path,
            path,
            status: readable_status(&normalized_status_code).to_string(),
            status_code: normalized_status_code,
        });
    }

    Ok(entries)
}

fn git_patch_files(
    path: &str,
    options: ProjectDiffOptions,
) -> Result<Vec<ProjectDiffFile>, String> {
    let mut command = Command::new("git");
    command.args([
        "-C",
        path,
        "diff",
        "--no-ext-diff",
        "--find-renames",
        "--find-copies",
        "--no-color",
        "--unified=3",
        "--no-prefix",
    ]);
    if options.hide_whitespace {
        command.arg("-w");
    }
    if has_head(path) {
        command.arg("HEAD");
    } else {
        command.args(["--cached", "--root"]);
    }

    let output = command.output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(parse_git_diff_output(
        String::from_utf8_lossy(&output.stdout).as_ref(),
    ))
}

fn has_head(path: &str) -> bool {
    Command::new("git")
        .args(["-C", path, "rev-parse", "--verify", "HEAD"])
        .output()
        .map(|result| result.status.success())
        .unwrap_or(false)
}

fn parse_git_diff_output(output: &str) -> Vec<ProjectDiffFile> {
    let lines = output.lines().collect::<Vec<_>>();
    let mut files = Vec::new();
    let mut index = 0;

    while index < lines.len() {
        if !lines[index].starts_with("diff --git ") {
            index += 1;
            continue;
        }

        let mut file = parse_file_header(lines[index]);
        index += 1;

        while index < lines.len() && !lines[index].starts_with("diff --git ") {
            let line = lines[index];

            if line.starts_with("new file mode ") {
                file.status = "added".to_string();
                file.status_code = "A".to_string();
                index += 1;
                continue;
            }
            if line.starts_with("deleted file mode ") {
                file.status = "deleted".to_string();
                file.status_code = "D".to_string();
                index += 1;
                continue;
            }
            if let Some(value) = line.strip_prefix("rename from ") {
                file.original_path = Some(value.to_string());
                file.status = "renamed".to_string();
                file.status_code = "R".to_string();
                index += 1;
                continue;
            }
            if let Some(value) = line.strip_prefix("rename to ") {
                file.path = value.to_string();
                file.id = file.path.clone();
                index += 1;
                continue;
            }
            if let Some(value) = line.strip_prefix("copy from ") {
                file.original_path = Some(value.to_string());
                file.status = "copied".to_string();
                file.status_code = "C".to_string();
                index += 1;
                continue;
            }
            if let Some(value) = line.strip_prefix("copy to ") {
                file.path = value.to_string();
                file.id = file.path.clone();
                index += 1;
                continue;
            }
            if line.starts_with("Binary files ") || line == "GIT binary patch" {
                file.is_binary = true;
                index += 1;
                continue;
            }
            if line.starts_with("@@ ") {
                let (hunk, next_index) = parse_hunk(&lines, index, &file.path, file.hunks.len());
                file.additions += hunk
                    .lines
                    .iter()
                    .filter(|line| matches!(line.kind, DiffLineKind::Added))
                    .count();
                file.deletions += hunk
                    .lines
                    .iter()
                    .filter(|line| matches!(line.kind, DiffLineKind::Removed))
                    .count();
                file.hunks.push(hunk);
                index = next_index;
                continue;
            }

            index += 1;
        }

        if file.path.is_empty() {
            continue;
        }
        file.is_generated = infer_generated_file(&file.path);
        apply_render_limits(&mut file);
        files.push(file);
    }

    files
}

fn parse_file_header(header: &str) -> ProjectDiffFile {
    let mut file = ProjectDiffFile::default();
    let body = header
        .strip_prefix("diff --git ")
        .map(str::trim)
        .unwrap_or_default();
    let (original_path, path) = parse_diff_header_paths(body);
    file.original_path = original_path;
    file.path = path.unwrap_or_default();
    file.id = file.path.clone();
    file.status = "modified".to_string();
    file.status_code = "M".to_string();
    file
}

fn parse_diff_header_paths(body: &str) -> (Option<String>, Option<String>) {
    if let Some((left, right)) = body.split_once('\t') {
        return (
            Some(decode_git_path(left.strip_prefix("a/").unwrap_or(left))),
            Some(decode_git_path(right.strip_prefix("b/").unwrap_or(right))),
        );
    }

    if let Some(separator_index) = body.rfind(" b/") {
        let (left, right_with_prefix) = body.split_at(separator_index);
        let right = right_with_prefix.trim_start();
        return (
            Some(decode_git_path(left.strip_prefix("a/").unwrap_or(left))),
            Some(decode_git_path(right.strip_prefix("b/").unwrap_or(right))),
        );
    }

    let mut parts = body.splitn(2, ' ');
    let left = parts.next().unwrap_or_default();
    let right = parts.next().unwrap_or_default().trim();
    let original_path =
        (!left.is_empty()).then(|| decode_git_path(left.strip_prefix("a/").unwrap_or(left)));
    let path =
        (!right.is_empty()).then(|| decode_git_path(right.strip_prefix("b/").unwrap_or(right)));
    (original_path, path)
}

fn parse_hunk(
    lines: &[&str],
    start_index: usize,
    path: &str,
    hunk_index: usize,
) -> (ProjectDiffHunk, usize) {
    let header = lines[start_index].to_string();
    let (old_start, old_lines, new_start, new_lines) = parse_hunk_header(&header);
    let mut old_line = Some(old_start);
    let mut new_line = Some(new_start);
    let mut diff_lines = Vec::new();
    let mut index = start_index + 1;

    while index < lines.len() {
        let line = lines[index];
        if line.starts_with("diff --git ") || line.starts_with("@@ ") {
            break;
        }

        if let Some(text) = line.strip_prefix('+') {
            diff_lines.push(ProjectDiffLine {
                kind: DiffLineKind::Added,
                new_line,
                old_line: None,
                text: text.to_string(),
            });
            new_line = new_line.map(|value| value + 1);
            index += 1;
            continue;
        }
        if let Some(text) = line.strip_prefix('-') {
            diff_lines.push(ProjectDiffLine {
                kind: DiffLineKind::Removed,
                new_line: None,
                old_line,
                text: text.to_string(),
            });
            old_line = old_line.map(|value| value + 1);
            index += 1;
            continue;
        }
        if let Some(text) = line.strip_prefix(' ') {
            diff_lines.push(ProjectDiffLine {
                kind: DiffLineKind::Context,
                new_line,
                old_line,
                text: text.to_string(),
            });
            old_line = old_line.map(|value| value + 1);
            new_line = new_line.map(|value| value + 1);
            index += 1;
            continue;
        }
        if line == r"\ No newline at end of file" {
            if let Some(previous_line) = diff_lines.last_mut() {
                previous_line.text.push_str(" (No newline at end of file)");
            }
        }
        index += 1;
    }

    (
        ProjectDiffHunk {
            header,
            id: format!("{path}:{old_start}:{new_start}:{hunk_index}"),
            lines: diff_lines,
            new_lines,
            new_start,
            old_lines,
            old_start,
        },
        index,
    )
}

fn parse_hunk_header(header: &str) -> (usize, usize, usize, usize) {
    let Some(header_end) = header.rfind("@@") else {
        return (0, 0, 0, 0);
    };
    let inner = header[2..header_end].trim();
    let mut parts = inner.split_whitespace();
    let old_info = parts.next().unwrap_or("-0,0");
    let new_info = parts.next().unwrap_or("+0,0");
    let (old_start, old_lines) = parse_range(old_info.trim_start_matches('-'));
    let (new_start, new_lines) = parse_range(new_info.trim_start_matches('+'));
    (old_start, old_lines, new_start, new_lines)
}

fn parse_range(value: &str) -> (usize, usize) {
    let mut parts = value.split(',');
    let start = parts
        .next()
        .and_then(|part| part.parse::<usize>().ok())
        .unwrap_or(0);
    let count = parts
        .next()
        .and_then(|part| part.parse::<usize>().ok())
        .unwrap_or(1);
    (start, count)
}

fn apply_render_limits(file: &mut ProjectDiffFile) {
    let line_count = file
        .hunks
        .iter()
        .map(|hunk| hunk.lines.len())
        .sum::<usize>();
    let text_bytes = file
        .hunks
        .iter()
        .flat_map(|hunk| hunk.lines.iter())
        .map(|line| line.text.len())
        .sum::<usize>();
    if line_count > MAX_RENDER_LINES || text_bytes > MAX_RENDER_TEXT_BYTES {
        file.hunks.clear();
        file.is_too_large = true;
    }
}

fn infer_generated_file(path: &str) -> bool {
    let normalized = path.replace('\\', "/").to_ascii_lowercase();
    normalized.contains("/dist/")
        || normalized.contains("/build/")
        || normalized.contains("/storybook-static/")
        || normalized.ends_with(".generated.ts")
        || normalized.ends_with(".generated.js")
        || normalized.ends_with(".gen.ts")
        || normalized.ends_with(".min.js")
        || normalized.ends_with(".min.css")
        || normalized.ends_with("pnpm-lock.yaml")
        || normalized.ends_with("package-lock.json")
}

fn diff_fingerprint(branch: &str, hide_whitespace: bool, files: &[ProjectDiffFile]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(branch.as_bytes());
    hasher.update(if hide_whitespace {
        b"hide_whitespace=1"
    } else {
        b"hide_whitespace=0"
    });
    for file in files {
        hasher.update(file.path.as_bytes());
        hasher.update(file.status_code.as_bytes());
        if let Some(original_path) = &file.original_path {
            hasher.update(original_path.as_bytes());
        }
        hasher.update(file.additions.to_string().as_bytes());
        hasher.update(file.deletions.to_string().as_bytes());
        for hunk in &file.hunks {
            hasher.update(hunk.header.as_bytes());
            for line in &hunk.lines {
                hasher.update(format!("{:?}", line.kind).as_bytes());
                hasher.update(line.text.as_bytes());
                hasher.update(line.old_line.unwrap_or_default().to_string().as_bytes());
                hasher.update(line.new_line.unwrap_or_default().to_string().as_bytes());
            }
        }
    }
    let digest = hasher.finalize();
    let hex = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("sha256:{hex}")
}

fn empty_fingerprint() -> String {
    "sha256:empty".to_string()
}

fn primary_status_code(code: &str) -> &str {
    let trimmed = code.trim();
    if trimmed == "??" {
        return "?";
    }

    code.chars()
        .find(|value| !value.is_whitespace())
        .map(|value| match value {
            'R' => "R",
            'C' => "C",
            'A' => "A",
            'D' => "D",
            'M' => "M",
            'T' => "T",
            'U' => "U",
            _ => "M",
        })
        .unwrap_or("M")
}

fn readable_status(code: &str) -> &'static str {
    match code {
        "A" => "added",
        "C" => "copied",
        "D" => "deleted",
        "R" => "renamed",
        "T" => "type-changed",
        "U" => "unmerged",
        "??" => "untracked",
        _ => "modified",
    }
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.contains(&0)
}

fn decode_git_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.len() < 2 || !trimmed.starts_with('"') || !trimmed.ends_with('"') {
        return trimmed.to_string();
    }

    let inner = &trimmed[1..trimmed.len() - 1];
    let bytes = inner.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'\\' {
            decoded.push(bytes[index]);
            index += 1;
            continue;
        }

        if index + 1 >= bytes.len() {
            decoded.push(b'\\');
            break;
        }

        match bytes[index + 1] {
            b'"' => {
                decoded.push(b'"');
                index += 2;
            }
            b'\\' => {
                decoded.push(b'\\');
                index += 2;
            }
            b'n' => {
                decoded.push(b'\n');
                index += 2;
            }
            b'r' => {
                decoded.push(b'\r');
                index += 2;
            }
            b't' => {
                decoded.push(b'\t');
                index += 2;
            }
            b'0'..=b'7' => {
                let mut value: u8 = 0;
                let mut octal_length = 0;
                while index + 1 + octal_length < bytes.len() && octal_length < 3 {
                    let digit = bytes[index + 1 + octal_length];
                    if !(b'0'..=b'7').contains(&digit) {
                        break;
                    }
                    let next_value = u32::from(value) * 8 + u32::from(digit - b'0');
                    if next_value > 0xFF {
                        break;
                    }
                    value = next_value as u8;
                    octal_length += 1;
                }

                if octal_length == 0 {
                    decoded.push(b'\\');
                    index += 1;
                    continue;
                }

                decoded.push(value);
                index += 1 + octal_length;
            }
            other => {
                decoded.push(other);
                index += 2;
            }
        }
    }

    String::from_utf8_lossy(&decoded).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::{parse_file_header, project_diff, ProjectDiffOptions};
    use std::{
        fs,
        path::{Path, PathBuf},
        process::Command,
    };
    use uuid::Uuid;

    #[test]
    fn parses_modified_and_untracked_diff_payloads() {
        let repo = create_temp_git_repo("diff-engine");
        write_file(
            repo.as_path(),
            "src/example.ts",
            "export const value = 1;\n",
        );
        git(repo.as_path(), ["add", "."]);
        git(repo.as_path(), ["commit", "-m", "initial"]);

        write_file(
            repo.as_path(),
            "src/example.ts",
            "export const value = 2;\nexport const next = 3;\n",
        );
        write_file(repo.as_path(), "docs/note.md", "# Note\nHello\n");

        let snapshot = project_diff(
            repo.to_string_lossy().as_ref(),
            "main",
            ProjectDiffOptions::default(),
        );

        assert!(snapshot.git_available);
        assert_eq!(snapshot.stats.files_changed, 2);
        assert!(snapshot
            .files
            .iter()
            .any(|file| file.path == "src/example.ts" && !file.hunks.is_empty()));
        assert!(snapshot
            .files
            .iter()
            .any(|file| file.path == "docs/note.md" && file.status_code == "??"));
        assert!(snapshot.fingerprint.starts_with("sha256:"));
    }

    #[test]
    fn hide_whitespace_changes_diff_fingerprint() {
        let repo = create_temp_git_repo("diff-whitespace");
        write_file(
            repo.as_path(),
            "src/example.ts",
            "export const value = 1;\n",
        );
        git(repo.as_path(), ["add", "."]);
        git(repo.as_path(), ["commit", "-m", "initial"]);

        write_file(
            repo.as_path(),
            "src/example.ts",
            "export  const value = 1;\n",
        );

        let visible = project_diff(
            repo.to_string_lossy().as_ref(),
            "main",
            ProjectDiffOptions::default(),
        );
        let hidden = project_diff(
            repo.to_string_lossy().as_ref(),
            "main",
            ProjectDiffOptions {
                hide_whitespace: true,
            },
        );

        assert_ne!(visible.fingerprint, hidden.fingerprint);
        assert_eq!(hidden.stats.additions + hidden.stats.deletions, 0);
    }

    #[test]
    fn parse_file_header_preserves_paths_with_spaces() {
        let parsed = parse_file_header("diff --git a/docs/spec notes.md b/docs/spec notes.md");

        assert_eq!(parsed.original_path.as_deref(), Some("docs/spec notes.md"));
        assert_eq!(parsed.path, "docs/spec notes.md");
    }

    #[test]
    fn parse_file_header_handles_literal_b_substring_in_filename() {
        let parsed = parse_file_header("diff --git a/docs/a b/value.txt\tb/docs/a b/value.txt");

        assert_eq!(parsed.original_path.as_deref(), Some("docs/a b/value.txt"));
        assert_eq!(parsed.path, "docs/a b/value.txt");
    }

    fn create_temp_git_repo(prefix: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        git(path.as_path(), ["init", "-b", "main"]);
        git(path.as_path(), ["config", "user.email", "pi@example.com"]);
        git(path.as_path(), ["config", "user.name", "Pi"]);
        path
    }

    fn write_file(repo: &Path, relative_path: &str, content: &str) {
        let path = repo.join(relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn git(repo: &Path, args: impl IntoIterator<Item = &'static str>) {
        let status = Command::new("git")
            .args(args)
            .current_dir(repo)
            .status()
            .unwrap();
        assert!(status.success());
    }
}
