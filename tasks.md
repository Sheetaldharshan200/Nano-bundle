# Tasks

## Resume Notes

- Last updated: 2026-06-24.
- Source decision guide: `C:\Users\sha\Downloads\exasol-nano-json-mcp-final-decision-guide.md`.
- Current state: Node CLI production mechanics implemented: interactive/non-interactive config, safe manifest validation, Compose/MCP rendering, Docker preflight, port checks, readiness waits, manifest-driven SQL and MCP smoke tests, update/rollback, CI/release workflows, and package validation. Docker Hub images are published under `docker.io/sheetaldharshan/*` for stable, candidate, and dev tags.
- Verification evidence: Windows Docker Desktop local full smoke passed on 2026-06-24 with Docker 29.5.2 and Compose 5.1.4. Checks passed: Exasol SQL TCP, bootstrap completion, MCP HTTP, SQL `SELECT 1`, SQL `ANALYTICS.CUSTOMER_EVENTS` count, MCP initialize/list tools/list schemas/read query/write-blocked. MCP startup logs were also checked to confirm the known upstream no-auth and schema-shadow warnings are suppressed in the packaged runtime.
- Next recommended step: run the GitHub manual `docker-compatibility` workflow for candidate/stable and add macOS/Linux matrix evidence before public stable release.

## Phase 0: Planning And Continuation

- [x] Capture final decision guide into production requirements.
- [x] Create `requirements.md`.
- [x] Create `design.md`.
- [x] Create `tasks.md`.
- [x] Create repo-local Codex skill for cross-session continuation.
- [x] Add decision-guide summary reference to the skill.
- [x] Re-review requirements/design/tasks before implementation and tighten any ambiguous acceptance criteria.

## Phase 1: Repository And CLI Foundation

- [x] Choose implementation layout for primary Node CLI and Python fallback.
- [x] Create package metadata for `@sheetaldharshan/exasol-json-mcp`.
- [x] Create CLI entry point `exasol-json-mcp`.
- [x] Add command parser for `start`, `stop`, `status`, `configure`, `logs`, `smoke-test`, `update`, `rollback`, `reset`, and `print-mcp-config`.
- [x] Add structured logging with normal and verbose modes.
- [x] Add cross-platform path handling for default state directory.
- [x] Add unit test runner and baseline tests.
- [x] Add lint/format scripts.

## Phase 2: Configuration And Manifest

- [x] Define `.env` schema and defaults.
- [x] Implement first-run prompt flow.
- [x] Implement daily-run `.env` loading without repeated prompts.
- [x] Generate random MCP readonly password by default.
- [x] Implement release manifest schema validation.
- [x] Add stable bundled manifest file.
- [x] Add candidate/dev manifest files or manifest URLs.
- [x] Reject unpinned images and `latest`/branch-style versions in release manifests.
- [x] Store `previous-manifest.json` for rollback.
- [x] Add tests for config defaults, env persistence, and manifest validation.

## Phase 3: Compose And Runtime Generation

- [x] Render `docker-compose.yml` from config and manifest.
- [x] Render `mcp/settings.json` with safe defaults.
- [x] Configure Exasol Nano with `/exa` persistence and `shm_size: "512m"`.
- [x] Bind SQL and MCP ports to `127.0.0.1`.
- [x] Add bootstrap service contract for schemas, JSON load, views, and grants.
- [x] Add MCP service contract using `MCP_READONLY`.
- [x] Add tests for rendered Compose and MCP settings.

## Phase 4: Docker Lifecycle Commands

- [x] Implement Docker/Compose version detection.
- [x] Detect Docker daemon availability.
- [x] Detect port conflicts before start.
- [x] Implement `start`.
- [x] Implement `stop`.
- [x] Implement `status`.
- [x] Implement `logs`.
- [x] Implement `reset` with explicit destructive confirmation.
- [x] Add command tests using no-Docker command paths.

## Phase 5: Readiness And Smoke Tests

- [x] Wait for Exasol SQL/TLS readiness.
- [x] Wait for JSON bootstrap completion.
- [x] Wait for MCP readiness.
- [x] Implement manifest-driven `smoke-test` command hook for `SELECT 1`.
- [x] Implement manifest-driven smoke command hook for `ANALYTICS.CUSTOMER_EVENTS`.
- [x] Implement manifest-driven MCP schema-list test.
- [x] Implement manifest-driven MCP read-query test.
- [x] Implement manifest-driven MCP write-blocked test.
- [x] Persist smoke-test summary in logs.

## Phase 6: User Output And AI Client Setup

- [x] Print final `Ready` output only after smoke tests pass.
- [x] Print MCP Server URL.
- [x] Print AI client MCP config block.
- [x] Print first AI prompt.
- [x] Keep terminal open until `completed` or `exit`.
- [x] Handle `Ctrl+C` at the final wait prompt without stopping containers.
- [x] Implement `print-mcp-config`.
- [x] Add snapshot tests for terminal output.

## Phase 7: Update And Rollback

- [x] Implement `update` manifest resolution.
- [x] Show current and target versions before update.
- [x] Require confirmation before update changes runtime.
- [x] Pull target images.
- [x] Run smoke tests after update.
- [x] Save rollback target before update.
- [x] Implement `rollback`.
- [x] Offer rollback when update smoke tests fail.
- [x] Add tests for update/rollback state transitions.

## Phase 8: Security Hardening

- [x] Verify MCP uses `MCP_READONLY`, not `SYS`.
- [x] Verify MCP can see only `ANALYTICS` by default.
- [x] Verify MCP write query is disabled.
- [x] Verify BucketFS read/write are disabled.
- [x] Verify functions/scripts/profiling/summarization are disabled.
- [x] Ensure secrets are not printed in normal logs.
- [x] Add security regression tests.

## Phase 9: Packaging And CI

- [x] Add CI for lint, unit tests, manifest validation, and package build.
- [x] Add manual compatibility test job for Docker stack startup.
- [x] Add release workflow for npm package.
- [ ] Add release workflow for Python fallback package if implemented.
- [x] Add scheduled manifest validation workflow.
- [x] Configure scheduled upstream watcher for Nano, MCP Server, and JSON Tables; opens/updates a GitHub issue for maintainer review before candidate pins change.
- [x] Publish candidate/dev/stable Docker image tags after real image pins are available.

## Phase 9A: Regression Hardening From Live Validation

- [x] Add regression tests for removing brittle Nano Compose healthchecks.
- [x] Add regression tests for official `EXA_MCP_SETTINGS` and local Nano TLS env configuration.
- [x] Add regression tests for Exasol-compatible readonly-user password syntax and rerunnable user creation.
- [x] Add regression tests for sample ingest avoiding unsupported pyexasol batch parameters.
- [x] Add regression tests for MCP SSE parsing and `result.isError` write-block handling.
- [x] Suppress expected upstream MCP local no-auth and schema-shadow startup warnings in the wrapper.
- [x] Add operations/troubleshooting documentation for the fixed production failure modes.
- [x] Improve `status` output with manifest channel and image pins.

## Phase 10: Production Readiness Review

- [x] Run full compatibility matrix on Windows.
- [ ] Run full compatibility matrix on macOS.
- [ ] Run full compatibility matrix on Linux.
- [x] Review first-run terminal UX for copy-paste completeness.
- [x] Review failure messages for actionable next steps.
- [x] Review security defaults against requirements.
- [ ] Review rollback from a failed update.
- [x] Confirm docs, design, and tasks match implementation.




## Release Blockers

- [x] Replace placeholder image pins with real published tested Docker Hub images under `docker.io/sheetaldharshan/*`.
- [x] Configure `manifest.smoke.commands` with exact SQL probe commands supported by the final images.
- [x] Configure `manifest.smoke.mcpTools` with exact Exasol MCP Server tool names for schema listing, read query, and write-blocked tests.
- [ ] Run the GitHub manual `docker-compatibility` workflow against candidate and stable manifests.

## Documentation And Update UX

- [x] Rewrite README for non-technical end-to-end install, start, connect, update, rollback, stop, and reset flows.
- [x] Add user guide for BI/demo users.
- [x] Add maintainer update guide for upstream-watch, candidate testing, stable promotion, and user update instructions.
- [x] Add scheduled upstream-watch GitHub Action and local `npm run check:upstreams` command.
