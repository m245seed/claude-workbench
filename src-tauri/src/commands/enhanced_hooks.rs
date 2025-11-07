use log::{debug, error, info, warn};
/// Enhanced Hooks Automation System
///
/// This module implements an event‑driven automation workflow system, including:
/// - New hook event types (on‑context‑compact, on‑agent‑switch, etc.)
/// - Hook chain execution and conditional triggering
/// - Deep integration with existing components (AutoCompactManager, etc.)
/// - Error handling and rollback mechanisms
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

/// Extended hook event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "PascalCase")]
pub enum HookEvent {
    // Existing events
    PreToolUse,
    PostToolUse,
    Notification,
    Stop,
    SubagentStop,

    // New events
    OnContextCompact, // Triggered when context compression occurs
    OnAgentSwitch,    // Triggered when switching sub‑agents
    OnFileChange,     // Triggered on file modification
    OnSessionStart,   // Triggered at the start of a session
    OnSessionEnd,     // Triggered at the end of a session
    OnTabSwitch,      // Triggered when switching tabs
}

impl HookEvent {
    pub fn as_str(&self) -> &str {
        match self {
            HookEvent::PreToolUse => "PreToolUse",
            HookEvent::PostToolUse => "PostToolUse",
            HookEvent::Notification => "Notification",
            HookEvent::Stop => "Stop",
            HookEvent::SubagentStop => "SubagentStop",
            HookEvent::OnContextCompact => "OnContextCompact",
            HookEvent::OnAgentSwitch => "OnAgentSwitch",
            HookEvent::OnFileChange => "OnFileChange",
            HookEvent::OnSessionStart => "OnSessionStart",
            HookEvent::OnSessionEnd => "OnSessionEnd",
            HookEvent::OnTabSwitch => "OnTabSwitch",
        }
    }
}

/// Hook execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookContext {
    pub event: String,
    pub session_id: String,
    pub project_path: String,
    pub data: serde_json::Value, // Event‑specific data
}

/// Hook execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookExecutionResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub hook_command: String,
}

/// Hook chain execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookChainResult {
    pub event: String,
    pub total_hooks: usize,
    pub successful: usize,
    pub failed: usize,
    pub results: Vec<HookExecutionResult>,
    pub should_continue: bool, // Whether subsequent operations should proceed
}

/// Conditional trigger configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalTrigger {
    pub condition: String, // Condition expression
    pub enabled: bool,
    pub priority: Option<i32>, // Execution priority
}

/// Enhanced hook definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedHook {
    pub command: String,
    pub timeout: Option<u64>,
    pub retry: Option<u32>,
    pub condition: Option<ConditionalTrigger>,
    pub on_success: Option<Vec<String>>, // Commands to run on success
    pub on_failure: Option<Vec<String>>, // Commands to run on failure
}

/// Hook executor
pub struct HookExecutor {
    app: AppHandle,
}

impl HookExecutor {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// Execute a single hook
    pub async fn execute_hook(
        &self,
        hook: &EnhancedHook,
        context: &HookContext,
    ) -> Result<HookExecutionResult, String> {
        let start_time = std::time::Instant::now();

        // Check if the condition is met
        if let Some(condition) = &hook.condition {
            if condition.enabled && !self.evaluate_condition(&condition.condition, context)? {
                debug!("Hook condition not met, skipping execution");
                return Ok(HookExecutionResult {
                    success: true,
                    output: "Skipped: condition not met".to_string(),
                    error: None,
                    execution_time_ms: 0,
                    hook_command: hook.command.clone(),
                });
            }
        }

        // Prepare execution environment
        let context_json = serde_json::to_string(context).map_err(|e| e.to_string())?;

        // Execute command
        let mut retry_count = 0;
        let max_retries = hook.retry.unwrap_or(0);

        loop {
            let mut cmd = Command::new("bash");
            cmd.arg("-c")
                .arg(&hook.command)
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .env("HOOK_CONTEXT", &context_json)
                .env("HOOK_EVENT", &context.event)
                .env("SESSION_ID", &context.session_id)
                .env("PROJECT_PATH", &context.project_path);

            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000);
            }

            // Set timeout
            let timeout_duration = tokio::time::Duration::from_secs(hook.timeout.unwrap_or(30));

            // Spawn process and apply timeout
            let child = cmd
                .spawn()
                .map_err(|e| format!("Failed to spawn hook process: {}", e))?;

            let result = tokio::time::timeout(timeout_duration, child.wait_with_output())
                .await
                .map_err(|_| "Hook execution timeout".to_string())?
                .map_err(|e| format!("Hook execution failed: {}", e))?;

            let execution_time = start_time.elapsed().as_millis() as u64;

            if result.status.success() {
                let output = String::from_utf8_lossy(&result.stdout).to_string();

                // Hooks after successful execution
                if let Some(on_success_commands) = &hook.on_success {
                    for cmd in on_success_commands {
                        let _ = self.execute_simple_command(cmd, context).await;
                    }
                }

                return Ok(HookExecutionResult {
                    success: true,
                    output,
                    error: None,
                    execution_time_ms: execution_time,
                    hook_command: hook.command.clone(),
                });
            } else {
                // Failure handling
                let error_output = String::from_utf8_lossy(&result.stderr).to_string();

                if retry_count < max_retries {
                    warn!(
                        "Hook failed, retrying ({}/{})",
                        retry_count + 1,
                        max_retries
                    );
                    retry_count += 1;
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    continue;
                }

                // Hooks after failure
                if let Some(on_failure_commands) = &hook.on_failure {
                    for cmd in on_failure_commands {
                        let _ = self.execute_simple_command(cmd, context).await;
                    }
                }

                return Ok(HookExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(error_output),
                    execution_time_ms: execution_time,
                    hook_command: hook.command.clone(),
                });
            }
        }
    }

    /// Execute a hook chain
    pub async fn execute_hook_chain(
        &self,
        event: HookEvent,
        context: HookContext,
        hooks: Vec<EnhancedHook>,
    ) -> Result<HookChainResult, String> {
        info!(
            "Executing hook chain for event: {:?}, {} hooks",
            event,
            hooks.len()
        );

        let mut results = Vec::new();
        let mut successful = 0;
        let mut failed = 0;
        let mut should_continue = true;

        for (idx, hook) in hooks.iter().enumerate() {
            debug!(
                "Executing hook {}/{}: {}",
                idx + 1,
                hooks.len(),
                hook.command
            );

            match self.execute_hook(hook, &context).await {
                Ok(result) => {
                    if result.success {
                        successful += 1;
                    } else {
                        failed += 1;
                        // If this is a PreToolUse event and the hook fails, block subsequent operations
                        if matches!(event, HookEvent::PreToolUse) {
                            should_continue = false;
                            warn!("PreToolUse hook failed, blocking operation");
                        }
                    }
                    results.push(result);
                }
                Err(e) => {
                    error!("Hook execution error: {}", e);
                    failed += 1;
                    results.push(HookExecutionResult {
                        success: false,
                        output: String::new(),
                        error: Some(e),
                        execution_time_ms: 0,
                        hook_command: hook.command.clone(),
                    });
                }
            }
        }

        // Emit execution result event
        let _ = self.app.emit(
            &format!("hook-chain-complete:{}", context.session_id),
            &results,
        );

        Ok(HookChainResult {
            event: event.as_str().to_string(),
            total_hooks: hooks.len(),
            successful,
            failed,
            results,
            should_continue,
        })
    }

    /// Execute a simple command (used for on_success and on_failure)
    async fn execute_simple_command(
        &self,
        command: &str,
        context: &HookContext,
    ) -> Result<(), String> {
        let mut cmd = Command::new("bash");
        cmd.arg("-c")
            .arg(command)
            .env("SESSION_ID", &context.session_id)
            .env("PROJECT_PATH", &context.project_path);

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000);
        }

        let _ = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn command: {}", e))?
            .wait()
            .await;

        Ok(())
    }

    /// Evaluate a condition expression
    fn evaluate_condition(&self, condition: &str, context: &HookContext) -> Result<bool, String> {
        // Simple condition evaluation implementation
        // Supported formats:
        // - "session_id == 'xyz'"
        // - "data.tokens > 100000"
        // - "event == 'OnContextCompact'"

        // This uses basic string matching; a more powerful expression engine can be integrated later
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").collect();
            if parts.len() == 2 {
                let left = parts[0].trim();
                let right = parts[1].trim().trim_matches(|c| c == '\'' || c == '"');

                match left {
                    "event" => Ok(context.event == right),
                    "session_id" => Ok(context.session_id == right),
                    _ => Ok(false),
                }
            } else {
                Ok(false)
            }
        } else {
            // Default to true for unsupported expressions
            Ok(true)
        }
    }
}

// ============ Hook Event Triggerer ============

/// Hook manager – manages registration and triggering of hooks, retained for future extensions
#[allow(dead_code)]
pub struct HookManager {
    executor: Arc<HookExecutor>,
    registered_hooks: Arc<Mutex<HashMap<String, Vec<EnhancedHook>>>>,
}

#[allow(dead_code)]
impl HookManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            executor: Arc::new(HookExecutor::new(app)),
            registered_hooks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register hooks
    pub fn register_hooks(&self, event: HookEvent, hooks: Vec<EnhancedHook>) {
        let mut registered = self.registered_hooks.lock().unwrap();
        registered.insert(event.as_str().to_string(), hooks);
    }

    /// Trigger a hook event
    pub async fn trigger(
        &self,
        event: HookEvent,
        context: HookContext,
    ) -> Result<HookChainResult, String> {
        let hooks = {
            let registered = self.registered_hooks.lock().unwrap();
            registered.get(event.as_str()).cloned().unwrap_or_default()
        };

        if hooks.is_empty() {
            debug!("No hooks registered for event: {:?}", event);
            return Ok(HookChainResult {
                event: event.as_str().to_string(),
                total_hooks: 0,
                successful: 0,
                failed: 0,
                results: vec![],
                should_continue: true,
            });
        }

        self.executor
            .execute_hook_chain(event, context, hooks)
            .await
    }
}

// ============ Tauri Commands ============

/// Trigger a hook event
#[tauri::command]
pub async fn trigger_hook_event(
    app: AppHandle,
    event: String,
    context: HookContext,
) -> Result<HookChainResult, String> {
    let event_enum = match event.as_str() {
        "OnContextCompact" => HookEvent::OnContextCompact,
        "OnAgentSwitch" => HookEvent::OnAgentSwitch,
        "OnFileChange" => HookEvent::OnFileChange,
        "OnSessionStart" => HookEvent::OnSessionStart,
        "OnSessionEnd" => HookEvent::OnSessionEnd,
        "OnTabSwitch" => HookEvent::OnTabSwitch,
        _ => return Err(format!("Unknown hook event: {}", event)),
    };

    // Load hooks from configuration
    let hooks_config = crate::commands::claude::get_hooks_config(
        "project".to_string(),
        Some(context.project_path.clone()),
    )
    .await?;

    let hooks_array = hooks_config
        .get(&event)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<EnhancedHook>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default();

    let executor = HookExecutor::new(app);
    executor
        .execute_hook_chain(event_enum, context, hooks_array)
        .await
}

/// Test a hook condition
#[tauri::command]
pub async fn test_hook_condition(
    app: tauri::AppHandle,
    condition: String,
    context: HookContext,
) -> Result<bool, String> {
    let executor = HookExecutor::new(app);
    executor.evaluate_condition(&condition, &context)
}

// ============ Intelligent Automation Scenario Implementation ============

/// Pre‑commit code review hook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreCommitCodeReviewConfig {
    pub enabled: bool,                     // Whether the hook is enabled
    pub quality_threshold: f64,            // Minimum quality score threshold (0.0‑10.0)
    pub block_critical_issues: bool,       // Block severe issues
    pub block_major_issues: bool,          // Block major issues
    pub review_scope: String,              // "security", "performance", or "all"
    pub exclude_patterns: Vec<String>,     // File patterns to exclude
    pub max_files_to_review: usize,        // Maximum number of files to review
    pub show_suggestions: bool,            // Show improvement suggestions
}

impl Default for PreCommitCodeReviewConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            quality_threshold: 6.0,
            block_critical_issues: true,
            block_major_issues: false,
            review_scope: "all".to_string(),
            exclude_patterns: vec![
                "node_modules/**".to_string(),
                "dist/**".to_string(),
                "build/**".to_string(),
                "target/**".to_string(),
                "*.min.js".to_string(),
                "*.bundle.js".to_string(),
                ".git/**".to_string(),
            ],
            max_files_to_review: 20,
            show_suggestions: true,
        }
    }
}

/// Pre‑commit code review hook – concrete implementation of the intelligent automation scenario
#[allow(dead_code)]
pub struct PreCommitCodeReviewHook {
    config: PreCommitCodeReviewConfig,
    _app: AppHandle, // Reserved for future extensions such as user notifications
}

#[allow(dead_code)]
impl PreCommitCodeReviewHook {
    pub fn new(app: AppHandle, config: PreCommitCodeReviewConfig) -> Self {
        Self { config, _app: app }
    }

    /// Execute pre‑commit code review (Disabled – agent functionality removed)
    pub async fn execute(&self, _project_path: &str) -> Result<CommitDecision, String> {
        // Agent functionality removed – always allow commits
        Ok(CommitDecision::Allow {
            message: "Code review functionality has been disabled (Agent functionality removed)".to_string(),
            suggestions: vec![],
        })
    }
}

/// Commit decision result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommitDecision {
    Allow {
        message: String,
        suggestions: Vec<String>,
    },
    Block {
        reason: String,
        details: String, // Changed from CodeReviewResult – agent functionality removed
        suggestions: Vec<String>,
    },
}

/// Execute pre‑commit code review hook (Disabled – agent functionality removed)
#[tauri::command]
pub async fn execute_pre_commit_review(
    _app: tauri::AppHandle,
    _project_path: String,
    _config: Option<PreCommitCodeReviewConfig>,
) -> Result<CommitDecision, String> {
    // Agent functionality has been removed – return an allow decision
    Ok(CommitDecision::Allow {
        message: "Code review functionality has been disabled (Agent functionality removed)".to_string(),
        suggestions: vec![],
    })
}
