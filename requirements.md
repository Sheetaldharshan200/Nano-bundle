# Requirements

## Product Goal

Deliver a production-ready local launcher for Exasol Nano + JSON Tables + Exasol MCP Server. A user should run one command, answer short first-run prompts, receive a ready MCP endpoint and copy-paste AI client instructions, and then use a local Exasol environment without manually installing project internals.

Primary command:

```bash
npx @sheetaldharshan/exasol-json-mcp start
```

Fallback command:

```bash
pipx run exasol-json-mcp start
```

## Users

- Data analysts and solution engineers who need a local Exasol demo with JSON data and AI access.
- Developers who need repeatable local testing for Exasol JSON workflows.
- Maintainers who need pinned releases, update checks, rollback, and reproducible smoke tests.

## Functional Requirements

- [ ] Provide a CLI named `exasol-json-mcp`.
- [ ] Support `start`, `stop`, `status`, `configure`, `logs`, `smoke-test`, `update`, `rollback`, `reset`, and `print-mcp-config`.
- [ ] On first run, prompt for work directory, Exasol Nano image, SYS password, MCP readonly password, SQL port, MCP port, dataset name, and sample-data choice.
- [ ] Save first-run answers into `.env` in the local work directory.
- [ ] Avoid daily-run setup questions when `.env` exists.
- [ ] Generate a Docker Compose file from pinned, tested versions.
- [ ] Start an Exasol Nano container with persistent `/exa` storage.
- [ ] Run a JSON bootstrap service that installs/configures the JSON workflow and publishes `ANALYTICS` views.
- [ ] Start an MCP Server service that exposes safe Exasol access to AI clients.
- [ ] Wait for database, JSON bootstrap, and MCP readiness before printing `Ready`.
- [ ] Print the MCP URL, AI client MCP config block, and first AI prompt.
- [ ] Keep the terminal open after readiness until the user types `completed` or `exit`.
- [ ] Treat `Ctrl+C` at the final wait prompt as an exit from the prompt only, not as a stack shutdown.
- [ ] Implement `reset` with explicit confirmation before deleting containers or volumes.
- [ ] Implement `update` using a tested release manifest.
- [ ] Implement `rollback` to return to the previous tested manifest.

## Security Requirements

- [ ] Bind Exasol SQL to `127.0.0.1` by default.
- [ ] Bind MCP HTTP to `127.0.0.1` by default.
- [ ] Generate a random MCP readonly password by default.
- [ ] Use `MCP_READONLY` for MCP access, not `SYS`.
- [ ] Limit MCP schema visibility to `ANALYTICS` by default.
- [ ] Disable MCP write query by default.
- [ ] Disable BucketFS read/write by default.
- [ ] Disable MCP functions, scripts, summarization, and profiling by default.
- [ ] Never use `latest`, `main`, `master`, or unversioned Git installs in a release manifest.
- [ ] Do not print generated passwords in normal logs unless explicitly requested through a secure config command.

## Operational Requirements

- [ ] Work on Windows, macOS, and Linux where Docker and Node or pipx are available.
- [ ] Store runtime files under `%USERPROFILE%\.exasol-json-mcp\` on Windows and `~/.exasol-json-mcp/` on macOS/Linux by default.
- [ ] Support Docker Compose v2.
- [ ] Detect missing Docker, Docker daemon not running, blocked ports, and incompatible Compose versions with actionable messages.
- [ ] Provide logs grouped by service.
- [ ] Provide status output with container state, health, ports, version manifest, and next actions.
- [ ] Preserve user data on `stop`.
- [ ] Make destructive cleanup explicit and reversible where possible.

## Release Requirements

- [ ] Maintain a stable release manifest containing pinned image/package versions and minimum Docker/Compose versions.
- [ ] Maintain candidate/dev channels for testing before stable promotion.
- [ ] Run compatibility tests before publishing a stable manifest.
- [ ] Publish release notes describing changed pins, upstream changes, migrations, and rollback guidance.
- [ ] Keep update PRs limited to version pins and generated artifacts where practical.

## Acceptance Criteria

- [ ] A fresh user can run one command and reach a ready MCP endpoint.
- [ ] A daily user can run the same command without answering setup prompts again.
- [ ] The AI client config and first prompt are printed without requiring docs lookup.
- [ ] `ANALYTICS.CUSTOMER_EVENTS` exists and can be queried.
- [ ] MCP can read metadata and execute permitted read queries.
- [ ] MCP write attempts are blocked by default.
- [ ] `update` can move to a newer tested manifest and smoke-test it.
- [ ] `rollback` can restore the previous tested manifest.
- [ ] `reset` cleans the stack only after explicit confirmation.
- [ ] The project can be resumed from `requirements.md`, `design.md`, `tasks.md`, and the repo-local skill.
