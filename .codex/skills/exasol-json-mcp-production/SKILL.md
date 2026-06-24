---
name: exasol-json-mcp-production
description: Production delivery workflow for the Exasol Nano + JSON Tables + MCP launcher. Use when Codex must plan, resume, implement, polish, verify, or synchronize work for this repository, especially requirements.md, design.md, tasks.md, update/rollback work, security hardening, release readiness, and cross-session continuation after context loss or thread termination.
---

# Exasol JSON MCP Production

Use this skill to keep delivery disciplined across sessions. The product is a one-command launcher that starts a local Docker Compose stack with Exasol Nano, JSON/NDJSON bootstrap through Exasol JSON Tables, and a safe Exasol MCP Server for AI clients.

## Resume Protocol

Always start by reading, in order:

1. `requirements.md`
2. `design.md`
3. `tasks.md`
4. `references/decision-guide-summary.md`

Then inspect repository state with `git status --short` and a file listing. Treat unchecked tasks in `tasks.md` as the backlog, but rethink them against the requirements and design before editing code or docs.

## Planning Discipline

When updating planning artifacts:

- Keep requirements user-facing and testable.
- Keep design implementation-facing and explicit about architecture, security, update behavior, and failure modes.
- Keep tasks actionable with checkboxes, dependencies, and acceptance checks.
- Prefer small production slices that can be verified independently.
- Add new tasks when implementation reveals missing production work.
- Mark tasks complete only after verification evidence exists.
- Preserve decisions and rationale; do not silently replace architecture.
- If assumptions change, update all three files in the same pass.

## Production Standards

Maintain these non-negotiables:

- One first-run command: `npx @your-org/exasol-json-mcp start`.
- Python fallback: `pipx run exasol-json-mcp start`.
- No manual Python, Rust, MCP Server, or repository cloning by users.
- Runtime uses pinned versions, never `latest`, `main`, or unversioned Git installs.
- SQL and MCP endpoints bind to `127.0.0.1` by default.
- MCP uses a generated readonly user, not `SYS`.
- MCP read access is limited to the `ANALYTICS` schema by default.
- Write SQL, BucketFS access, functions, scripts, and profiling are disabled by default.
- The launcher prints an MCP config block and first AI prompt.
- The launcher stays open until the user types `completed` or `exit`.
- Update and rollback are explicit commands with smoke tests.

## Work Loop

For every substantial change:

1. Re-read the relevant requirement and task.
2. Implement the smallest coherent slice.
3. Run the closest available verification.
4. Update `tasks.md` with completion state and newly discovered work.
5. Polish naming, messages, security defaults, and operator experience before moving on.
6. Leave clear resume notes in `tasks.md` when work remains.

## Verification Expectations

Prefer verification in this order:

- Unit tests for launcher logic.
- Compose rendering/config generation tests.
- Security-default tests.
- Smoke tests against a local Docker stack when available.
- Manual command output inspection for docs and generated config.

If Docker, network, or dependencies are unavailable, record the limitation in `tasks.md` and keep the task unchecked unless an equivalent verification exists.
