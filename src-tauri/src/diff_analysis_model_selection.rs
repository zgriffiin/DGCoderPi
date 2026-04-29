use crate::model::ModelOption;

pub fn diff_analysis_model_rank(model: &ModelOption) -> (u8, u8, bool) {
    let provider_rank = diff_analysis_provider_rank(model);
    let descriptor = format!("{} {}", model.label, model.key).to_ascii_lowercase();
    let tokens = descriptor
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let has_token = |candidates: &[&str]| {
        tokens
            .iter()
            .any(|token| candidates.iter().any(|candidate| token == candidate))
    };
    let size_rank = if has_token(&["nano"]) {
        0
    } else if has_token(&["mini", "small", "haiku", "flash", "spark"]) {
        1
    } else if has_token(&["sonnet", "medium", "standard"]) {
        2
    } else {
        3
    };

    (provider_rank, size_rank, !model.configured)
}

pub fn should_use_thread_model_for_diff_analysis(model_key: &str) -> bool {
    is_supported_diff_analysis_model_key(model_key)
}

pub fn is_supported_diff_analysis_model_key(model_key: &str) -> bool {
    !model_key.starts_with("openai-codex::")
}

pub fn unsupported_diff_analysis_model_message(model_key: &str) -> Option<String> {
    if is_supported_diff_analysis_model_key(model_key) {
        return None;
    }

    Some(format!(
        "AI Review does not support Codex login-only models yet ({model_key}). Configure an API-backed model in Settings for Diff Review."
    ))
}

fn diff_analysis_provider_rank(model: &ModelOption) -> u8 {
    match model.provider.as_str() {
        "openai" => 0,
        "anthropic" => 1,
        "google" => 2,
        "openrouter" => 3,
        "deepseek" => 4,
        "openai-codex" => 5,
        _ => 6,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        diff_analysis_model_rank, should_use_thread_model_for_diff_analysis,
        unsupported_diff_analysis_model_message,
    };
    use crate::model::ModelOption;

    #[test]
    fn diff_analysis_model_rank_prefers_small_variants_and_configured_models() {
        let standard = ModelOption {
            configured: true,
            key: "openai::gpt-5.4".to_string(),
            label: "GPT-5.4".to_string(),
            provider: "openai".to_string(),
            ..ModelOption::default()
        };
        let mini = ModelOption {
            configured: true,
            key: "openai::gpt-5.4-mini".to_string(),
            label: "GPT-5.4 Mini".to_string(),
            provider: "openai".to_string(),
            ..ModelOption::default()
        };
        let unconfigured_mini = ModelOption {
            configured: false,
            key: "openai::gpt-5.4-mini".to_string(),
            label: "GPT-5.4 Mini".to_string(),
            provider: "openai".to_string(),
            ..ModelOption::default()
        };

        assert!(diff_analysis_model_rank(&mini) < diff_analysis_model_rank(&standard));
        assert!(diff_analysis_model_rank(&mini) < diff_analysis_model_rank(&unconfigured_mini));
    }

    #[test]
    fn diff_analysis_model_rank_prefers_openai_over_openai_codex() {
        let openai = ModelOption {
            configured: true,
            key: "openai::gpt-5.4".to_string(),
            label: "GPT-5.4".to_string(),
            provider: "openai".to_string(),
            ..ModelOption::default()
        };
        let codex = ModelOption {
            configured: true,
            key: "openai-codex::gpt-5.4".to_string(),
            label: "GPT-5.4".to_string(),
            provider: "openai-codex".to_string(),
            ..ModelOption::default()
        };

        assert!(diff_analysis_model_rank(&openai) < diff_analysis_model_rank(&codex));
        assert!(!should_use_thread_model_for_diff_analysis(&codex.key));
        assert!(should_use_thread_model_for_diff_analysis(&openai.key));
        assert!(unsupported_diff_analysis_model_message(&codex.key).is_some());
        assert!(unsupported_diff_analysis_model_message(&openai.key).is_none());
    }

    #[test]
    fn diff_analysis_model_rank_does_not_treat_gemini_as_mini() {
        let gemini_pro = ModelOption {
            configured: true,
            key: "google::gemini-2.5-pro".to_string(),
            label: "Gemini 2.5 Pro".to_string(),
            provider: "google".to_string(),
            ..ModelOption::default()
        };
        let gemini_flash = ModelOption {
            configured: true,
            key: "google::gemini-2.5-flash".to_string(),
            label: "Gemini 2.5 Flash".to_string(),
            provider: "google".to_string(),
            ..ModelOption::default()
        };

        assert_eq!(diff_analysis_model_rank(&gemini_pro).1, 3);
        assert!(diff_analysis_model_rank(&gemini_flash) < diff_analysis_model_rank(&gemini_pro));
    }
}
