# Exasol JSON MCP Launcher

Run a local Exasol Nano database, load sample JSON data, and expose a safe read-only MCP endpoint for AI assistants with one command.

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

This project is for local demos, BI exploration, solution engineering, and repeatable JSON/MCP testing. It starts everything in Docker on your machine and binds SQL and MCP ports to `127.0.0.1` by default.

## What You Get

- Exasol Nano running locally in Docker.
- A bootstrapped `ANALYTICS.CUSTOMER_EVENTS` JSON sample table/view.
- Exasol MCP Server exposed at `http://localhost:7766/mcp`.
- A generated `MCP_READONLY` database user for AI access.
- Read-only MCP defaults: write SQL, BucketFS, functions, scripts, profiling, and summarization are disabled.
- Built-in `status`, `logs`, `smoke-test`, `update`, `rollback`, `stop`, `reset`, `doctor`, `autostart`, and `install-client-config` commands.

## Before You Start

Install these first:

1. Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Node.js 20 or newer: https://nodejs.org/

Then start Docker Desktop and wait until it says the engine is running.

Check from a terminal:

```powershell
docker --version
docker compose version
node --version
npm --version
```

## First Run

Use PowerShell, Terminal, or Command Prompt:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

The launcher will:

1. Create a local folder for its files.
2. Generate safe default passwords.
3. Download the tested Docker images.
4. Start Exasol Nano, JSON bootstrap, and MCP Server.
5. Run smoke tests.
6. Print the MCP URL, AI client config, and first prompt.

First run timing:

- After a Docker prune or on a new machine, startup can take several minutes because Docker must download images again.
- Exasol Nano also needs time to initialize before JSON bootstrap and MCP can start.
- Later runs are normally faster because images and the local Docker volume are already present.

Default local folder:

- Windows: `%USERPROFILE%\.exasol-json-mcp`
- macOS/Linux: `~/.exasol-json-mcp`

## Connect Your AI Client

After `start` finishes, copy the MCP config printed by the launcher into your AI client.

Default MCP URL:

```text
http://localhost:7766/mcp
```

First prompt to try:

```text
Use the connected Exasol MCP server. List available schemas, describe ANALYTICS.CUSTOMER_EVENTS, then run SELECT COUNT(*) FROM ANALYTICS.CUSTOMER_EVENTS.
```

When your AI client finishes, return to the terminal and type:

```text
completed
```

The stack keeps running until you stop it.

## Daily Use

Start or reuse the stack:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

Show current status:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest status
```

Print only the MCP config again:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest print-mcp-config
```

Show recent logs:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest logs
```

Run health checks:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest smoke-test
```

Stop containers but keep data:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest stop
```

Install the MCP entry into supported AI clients:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=all
```

Start the local stack automatically when you sign in:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest autostart enable
```

Check installation health:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest doctor
```

After a system restart, either autostart brings the stack back when Docker Desktop is available, or the user can run the normal `start` command again. The AI client config can remain installed permanently. Supported client targets are `claude`, `codex`, `vscode`, and `all`.

## Update Safely

Use this when a new tested launcher/runtime release is available:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest update
```

The update flow shows current and target versions before changing anything. It saves the old manifest as `previous-manifest.json`, pulls the new images, starts the stack, and runs smoke tests.

If an update fails, roll back:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest rollback
```

Use `status` after update or rollback:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest status
```

## Clean Reset

Use this only when you want to remove the local containers and Docker volume for this stack.

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest reset --confirm=delete-local-exasol-json-mcp
```

A normal `stop` is safer for daily use because it preserves data.

## Troubleshooting

Docker is not running:

```text
Start Docker Desktop, wait for Engine running, then run start again.
```

Port already in use:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest configure
```

Then choose different SQL or MCP ports.

Need logs:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest logs --tail=300
```

Need to verify the system:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest smoke-test --verbose
```

## For Maintainers

Local checks:

```powershell
npm ci
npm run lint
npm test
npm run validate:manifests
npm run check:upstreams
npm pack --dry-run
```

GitHub Actions:

- `ci`: lint, tests, manifest validation, package dry-run, and render-only smoke checks.
- `docker-compatibility`: manual full Docker stack compatibility test.
- `upstream-watch`: scheduled upstream release monitor for Exasol Nano, Exasol MCP Server, and JSON Tables.
- `release-npm`: publishes the npm package when a version tag is pushed or the workflow is manually run.

Release order:

1. Check upstream updates with `npm run check:upstreams`.
2. Update candidate pins only.
3. Run `docker-compatibility` on `candidate`.
4. Promote tested pins to `stable`.
5. Run `docker-compatibility` on `stable`.
6. Bump npm version and publish.

More details are in `docs/user-guide.md`, `docs/maintainer-updates.md`, and `docs/release-checklist.md`.
