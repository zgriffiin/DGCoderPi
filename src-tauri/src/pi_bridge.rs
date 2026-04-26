use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::Path,
    process::{Child, ChildStderr, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::model::{
    ActivityTone, AttachmentParseStatus, FeatureSettings, MessageRole, MessageStatus, ModelOption,
    ProviderStatus, QueueMode, QueueStatus, ThreadStatus,
};

type PendingRequests = Arc<Mutex<HashMap<String, mpsc::Sender<BridgeResponse>>>>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeEnvironment {
    pub models: Vec<ModelOption>,
    pub providers: Vec<ProviderStatus>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeAttachmentResult {
    pub preview_text: Option<String>,
    pub warnings: Vec<String>,
    pub status: BridgeAttachmentStatus,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BridgeAttachmentStatus {
    Failed,
    Ready,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeThreadSnapshot {
    pub last_error: Option<String>,
    pub messages: Vec<BridgeMessage>,
    pub queue: Vec<BridgeQueueEntry>,
    pub status: ThreadStatus,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeMessage {
    pub id: String,
    pub role: MessageRole,
    pub status: MessageStatus,
    pub text: String,
    pub timestamp_ms: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeQueueEntry {
    pub id: String,
    pub mode: QueueMode,
    pub status: QueueStatus,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeActivity {
    pub detail: String,
    pub title: String,
    pub tone: ActivityTone,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum BridgeEvent {
    ThreadUpdate {
        activity: Option<BridgeActivity>,
        snapshot: BridgeThreadSnapshot,
        thread_id: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BridgeResponse {
    pub error: Option<String>,
    pub id: String,
    pub ok: bool,
    pub payload: Option<Value>,
}

pub struct PiBridge {
    child: Mutex<Child>,
    pending: PendingRequests,
    status: Arc<Mutex<String>>,
    stdin: Mutex<ChildStdin>,
}

impl PiBridge {
    pub fn start(
        repo_root: &Path,
        app_data_dir: &Path,
        features: &FeatureSettings,
        on_event: Arc<dyn Fn(BridgeEvent) + Send + Sync>,
    ) -> Result<Self, String> {
        let script_path = repo_root.join("sidecar").join("pi-bridge.mjs");
        let mut child = Command::new("node")
            .arg(script_path)
            .current_dir(repo_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Node bridge stdin was not available.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Node bridge stdout was not available.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Node bridge stderr was not available.".to_string())?;

        let pending = Arc::new(Mutex::new(HashMap::new()));
        let status = Arc::new(Mutex::new("starting".to_string()));

        start_stdout_listener(stdout, pending.clone(), status.clone(), on_event);
        start_stderr_listener(stderr);

        let bridge = Self {
            child: Mutex::new(child),
            pending,
            status,
            stdin: Mutex::new(stdin),
        };

        let response: BridgeEnvironment = bridge.request(
            "bootstrap",
            json!({
                "appDataDir": app_data_dir,
                "docparserEnabled": features.docparser_enabled,
            }),
        )?;

        drop(response);
        bridge.set_status("ready");
        Ok(bridge)
    }

    pub fn status(&self) -> String {
        self.status
            .lock()
            .ok()
            .map(|value| value.clone())
            .unwrap_or_else(|| "unknown".to_string())
    }

    pub fn refresh_environment(&self) -> Result<BridgeEnvironment, String> {
        self.request("list-models", json!({}))
    }

    pub fn set_feature_settings(
        &self,
        features: &FeatureSettings,
    ) -> Result<BridgeEnvironment, String> {
        self.request(
            "set-features",
            json!({
                "docparserEnabled": features.docparser_enabled,
            }),
        )
    }

    pub fn set_provider_key(&self, provider: &str, key: &str) -> Result<BridgeEnvironment, String> {
        self.request(
            "set-api-key",
            json!({
                "key": key,
                "provider": provider,
            }),
        )
    }

    pub fn parse_attachment(&self, path: &str) -> Result<BridgeAttachmentResult, String> {
        self.request("parse-attachment", json!({ "path": path }))
    }

    pub fn send_prompt(
        &self,
        thread_id: &str,
        cwd: &str,
        model_key: &str,
        text: &str,
        attachments: &[BridgePromptAttachment],
        mode: &str,
    ) -> Result<(), String> {
        self.request::<Value>(
            mode,
            json!({
                "attachments": attachments,
                "cwd": cwd,
                "modelKey": model_key,
                "text": text,
                "threadId": thread_id,
            }),
        )?;
        Ok(())
    }

    pub fn abort(&self, thread_id: &str) -> Result<(), String> {
        self.request::<Value>("abort", json!({ "threadId": thread_id }))?;
        Ok(())
    }

    fn request<T>(&self, command_type: &str, payload: Value) -> Result<T, String>
    where
        T: DeserializeOwned,
    {
        let id = Uuid::new_v4().to_string();
        let command = json!({
            "id": id,
            "payload": payload,
            "type": command_type,
        });

        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "Pending bridge requests were poisoned.".to_string())?
            .insert(id.clone(), tx);

        let mut stdin = self
            .stdin
            .lock()
            .map_err(|_| "Node bridge stdin lock was poisoned.".to_string())?;
        stdin
            .write_all(command.to_string().as_bytes())
            .map_err(|error| error.to_string())?;
        stdin.write_all(b"\n").map_err(|error| error.to_string())?;
        stdin.flush().map_err(|error| error.to_string())?;
        drop(stdin);

        let response = rx
            .recv_timeout(Duration::from_secs(120))
            .map_err(|_| format!("Timed out waiting for bridge response for {command_type}."))?;
        if !response.ok {
            return Err(response
                .error
                .unwrap_or_else(|| "Bridge command failed.".to_string()));
        }

        let payload = response
            .payload
            .ok_or_else(|| "Bridge response did not include a payload.".to_string())?;
        serde_json::from_value(payload).map_err(|error| error.to_string())
    }

    fn set_status(&self, next_status: &str) {
        if let Ok(mut status) = self.status.lock() {
            *status = next_status.to_string();
        }
    }
}

impl Drop for PiBridge {
    fn drop(&mut self) {
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgePromptAttachment {
    pub kind: String,
    pub mime_type: String,
    pub name: String,
    pub path: String,
    pub preview_text: Option<String>,
}

pub fn attachment_status_from_bridge(status: BridgeAttachmentStatus) -> AttachmentParseStatus {
    match status {
        BridgeAttachmentStatus::Failed => AttachmentParseStatus::Failed,
        BridgeAttachmentStatus::Ready => AttachmentParseStatus::Ready,
    }
}

fn start_stdout_listener(
    stdout: impl std::io::Read + Send + 'static,
    pending: PendingRequests,
    status: Arc<Mutex<String>>,
    on_event: Arc<dyn Fn(BridgeEvent) + Send + Sync>,
) {
    thread::spawn(move || {
        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            let Ok(text) = line else {
                break;
            };
            if text.trim().is_empty() {
                continue;
            }

            if let Ok(response) = serde_json::from_str::<BridgeResponse>(&text) {
                let sender = pending
                    .lock()
                    .ok()
                    .and_then(|mut requests| requests.remove(&response.id));
                if let Some(tx) = sender {
                    let _ = tx.send(response);
                }
                continue;
            }

            if let Ok(event) = serde_json::from_str::<BridgeEvent>(&text) {
                on_event(event);
            }
        }

        if let Ok(mut value) = status.lock() {
            *value = "offline".to_string();
        }
    });
}

fn start_stderr_listener(stderr: ChildStderr) {
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for text in reader.lines().map_while(Result::ok) {
            eprintln!("[pi-bridge] {text}");
        }
    });
}
