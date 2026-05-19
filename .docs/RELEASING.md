# Releasing DGCoder

This document covers the release process for DGCoder desktop builds.

## Version Scheme

The project follows semantic versioning with pre-release tags:

- Alpha: `0.1.0-alpha.1`, `0.1.0-alpha.2`, ...
- Beta: `0.1.0-beta.1`, ...
- Release candidate: `0.1.0-rc.1`, ...
- Stable: `0.1.0`, `0.2.0`, `1.0.0`, ...

The version is tracked in three manifest files that must stay in sync:

| File                        | Field     |
| --------------------------- | --------- |
| `package.json`              | `version` |
| `src-tauri/Cargo.toml`      | `version` |
| `src-tauri/tauri.conf.json` | `version` |

## Bumping the Version

Use the version bump script to update all manifests at once:

```bash
pnpm version:bump 0.1.0-alpha.2
```

The script validates the format and updates all three files. Never edit version numbers by hand in individual files.

## Cutting a Release

1. **Ensure main is clean.** All CI checks should be green on the latest main commit.

2. **Bump the version:**

   ```bash
   pnpm version:bump 0.1.0-alpha.1
   ```

3. **Commit the version change:**

   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "chore: release v0.1.0-alpha.1"
   ```

4. **Tag and push:**

   ```bash
   git tag v0.1.0-alpha.1
   git push origin main --tags
   ```

5. **The release workflow takes over.** It will:
   - Validate that the tag version matches all three manifests
   - Run frontend checks (type check, lint, tests, build)
   - Run Rust checks (fmt, clippy, tests)
   - Build the Windows installer (MSI + NSIS)
   - Create a GitHub Release with the artifacts attached
   - Mark the release as pre-release for alpha/beta/rc versions

6. **Verify the release** on the GitHub Releases page. Download and install the artifact to confirm it works.

## Release CI Pipeline

The release workflow (`.github/workflows/release.yml`) is triggered by pushing a `v*` tag. It runs four sequential jobs:

1. **validate** — Extracts the version from the tag and verifies all three manifests match. Fails fast on any mismatch.
2. **frontend-checks** — Type check, lint, unit tests, component tests, browser E2E tests, and frontend build.
3. **build-windows** — Rust fmt/clippy/test, then `tauri build` producing MSI and NSIS installers.
4. **publish-release** — Creates the GitHub Release, attaches artifacts, and auto-generates release notes from commits since the last tag.

## Version in the App

The version from `package.json` is injected at build time as `__APP_VERSION__` and displayed in **Settings → About**. Users can verify which version they are running from within the app.

## Credential Safety

The released installer does not contain any developer credentials. All user-specific configuration happens at runtime:

- **Provider API keys** (OpenAI, Anthropic, etc.) are entered by the user in Settings → Providers and stored in the Tauri app data directory on their machine.
- **Codex authentication** is handled through the `codex login` flow at runtime.
- **No `.env` files** are bundled. The `.gitignore` excludes all `.env` variants from the repository.
- **No local state** is included in the bundle. The app's SQLite database and cached data live in the user's OS-specific app data folder (`%APPDATA%\com.dgcoder.pi`).

Users must configure their own provider keys after installation. The app will show provider status as "missing" until the user adds their credentials through the Settings UI.

## First-Time Setup for End Users

After installing DGCoder:

1. Open the app and go to **Settings → Providers**.
2. Add API keys for the providers you want to use (OpenAI, Anthropic, etc.).
3. Optionally, go to **Settings → Accounts** and connect Codex if you have a ChatGPT subscription.
4. Open or create a project and start working.

## Troubleshooting Releases

**Version mismatch error in CI:**
Run `pnpm version:bump <version>` again to re-sync all manifests, then amend the commit and re-tag.

**Build fails on Windows runner:**
Check that `pnpm setup:imagemagick` succeeds. The ImageMagick resources are downloaded at build time and are required for the Tauri bundle.

**Release marked as draft or missing artifacts:**
The `publish-release` job requires the `build-windows` job to produce at least one artifact. If the Tauri build fails, no release is created. Fix the build and re-tag.
