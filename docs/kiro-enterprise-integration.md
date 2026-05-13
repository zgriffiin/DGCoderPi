# Kiro Enterprise Integration

## Overview

DGCoder-Pi supports Kiro Enterprise as a provider, giving access to Claude Opus 4.6 and Claude Sonnet 4.6 through AWS Bedrock via IAM Identity Center SSO authentication.

Kiro (formerly Amazon Q Developer) is an AWS application built on Amazon Bedrock. Enterprise accounts authenticate through AWS IAM Identity Center using the OAuth 2.0 Device Authorization Grant (RFC 8628), the same flow used by the AWS CLI and Kiro IDE.

## Authentication Flow

Kiro Enterprise uses the SSO OIDC device code flow:

1. User provides their IAM Identity Center start URL and region.
2. App registers a public OIDC client with the SSO OIDC service.
3. App starts device authorization — returns a verification URL and user code.
4. User opens the URL in their browser and enters the code to authorize.
5. App polls for token completion.
6. Access and refresh tokens are stored locally.
7. Tokens are refreshed automatically before expiry on subsequent sessions.

### Configuration

Users need two pieces of information from their admin:

- **Start URL**: The IAM Identity Center portal URL (e.g. `https://infor-aws-portal-prod.awsapps.com/start`)
- **Region**: The AWS region hosting the identity directory (e.g. `us-east-1`)

### Token Storage

Credentials are stored at `{appDataDir}/pi-agent/kiro-sso-credential.json`. The file contains:

- Access token (bearer token for API calls)
- Refresh token (for automatic renewal)
- Client registration (reused until expiry, typically 90 days)
- Start URL and region (for refresh operations)

## Available Models

When authenticated, the following models become available:

| Model             | Key                       | Reasoning         | Images |
| ----------------- | ------------------------- | ----------------- | ------ |
| Claude Opus 4.6   | `kiro::claude-opus-4.6`   | Yes (off → xhigh) | Yes    |
| Claude Sonnet 4.6 | `kiro::claude-sonnet-4.6` | Yes (off → high)  | Yes    |

These are the same Claude models available through Anthropic's API, accessed via AWS Bedrock through the Kiro enterprise subscription. Prompting patterns from the Anthropic reference apply directly.

## Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Tauri App  │────▶│  Node Bridge │────▶│  Pi Agent Lib   │
│  (Rust)     │     │  (sidecar)   │     │  (Bedrock/SSO)  │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │ kiro-auth   │
                    │ (SSO OIDC)  │
                    └─────────────┘
```

- **kiro-auth.mjs**: Handles the SSO OIDC device authorization flow, token storage, and refresh.
- **pi-bridge.mjs**: Registers `kiro` as a provider, syncs credentials on environment build, exposes login/logout commands.
- **Tauri commands**: `start_kiro_sso_login`, `complete_kiro_sso_login`, `logout_kiro` — exposed to the frontend.

## Prompt Alignment

Claude Opus 4.6 and Sonnet 4.6 share the same prompting characteristics as the Anthropic-direct models. Key patterns:

- XML tag structuring for complex prompts (`<task>`, `<context>`, `<constraints>`)
- System prompt for persistent identity, rules, and format
- Extended thinking levels for reasoning control
- Literal instruction following — invest in detailed prompts
- Strong long-context retrieval

See `.codex/skills/pi-agent-prompting/references/anthropic.md` for the full prompting reference.

## Relationship to Kiro IDE

This integration provides access to Kiro's model catalog through the enterprise SSO mechanism. It does not integrate with Kiro's IDE features (specs, steering, hooks, powers). DGCoder-Pi maintains its own agent orchestration through Pi.

If Kiro later exposes agent events, workspace context, or transport settings as APIs, those could be evaluated as additional adapter capabilities without changing the current provider integration.

## Diff Analysis

Kiro models are ranked alongside Anthropic models for diff analysis (provider rank 1, same as direct Anthropic). Claude Sonnet 4.6 via Kiro is a good candidate for diff review when configured.

## Troubleshooting

- **"SSO OIDC client registration failed"**: Check that the region is correct and the SSO OIDC endpoint is reachable.
- **"Device authorization expired"**: The user took too long to authorize. Restart the login flow.
- **"Authorization was denied"**: The user or admin denied access. Check IAM Identity Center permissions.
- **"Token refresh failed"**: The refresh token may have expired. Log out and log in again.
- **Models not appearing**: Verify the credential is valid in Settings. The Kiro provider should show "IAM Identity Center SSO" as the source.
