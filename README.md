# Exasol JSON MCP Launcher

Run a local Exasol Nano database, load sample JSON data, and expose a safe read-only MCP endpoint for AI assistants with one command.

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

Use the explicit `@latest` form on Windows. Some `npx` versions can fail to create the command shim when the package is called without a version selector.

This project is built for local demos, BI exploration, solution engineering, and repeatable JSON/MCP testing. It starts everything in Docker on your machine and binds SQL and MCP ports to `127.0.0.1` by default.

## What It Installs Locally

The launcher creates and manages a private local runtime folder. It does not require users to clone this repository.

Default state directory:

| OS | Path |
| --- | --- |
| Windows | `%USERPROFILE%\.exasol-json-mcp` |
| macOS/Linux | `~/.exasol-json-mcp` |

Runtime services:

| Service | Purpose |
| --- | --- |
| `exanano` | Local Exasol Nano database |
| `json-bootstrap` | Creates schema, readonly user, and sample JSON data |
| `mcp-server` | Local read-only MCP endpoint for AI clients |

Default endpoints:

| Endpoint | Default |
| --- | --- |
| Exasol SQL | `127.0.0.1:8563` |
| MCP HTTP | `http://localhost:7766/mcp` |
| Sample dataset | `ANALYTICS.CUSTOMER_EVENTS` |

Security defaults:

- MCP binds to localhost only.
- AI clients use `MCP_READONLY`, not `SYS`.
- Write SQL is disabled through MCP settings.
- BucketFS read/write, functions, scripts, profiling, and summarization are disabled.
- The stack is intended for a single-user local workstation, not an unauthenticated shared server.

## Prerequisites

Install these first:

1. Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Node.js 20 or newer: https://nodejs.org/

Start Docker Desktop and wait until it says the engine is running.

Check from PowerShell, Terminal, or Command Prompt:

```powershell
docker --version
docker compose version
node --version
npm --version
```

## Quick Start

Start the local stack:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

The launcher will:

1. Create the local state directory if missing.
2. Generate safe default runtime secrets.
3. Render `.env`, `docker-compose.yml`, MCP settings, and manifest files.
4. Download tested Docker images when needed.
5. Start Exasol Nano, JSON bootstrap, and MCP Server.
6. Wait for readiness.
7. Run SQL and MCP smoke tests.
8. Print the MCP URL, client config, and first prompt.

First run can take several minutes because Docker images may need to download and Exasol Nano must initialize. Later runs are normally faster.

## Connect AI Clients Permanently

Install the MCP entry into every supported local AI client:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=all
```

Supported client targets:

| Target | Config written |
| --- | --- |
| `claude` | Claude Desktop MCP config |
| `codex` | Codex `config.toml` shared by CLI and IDE extension |
| `vscode` | VS Code `mcp.json` |
| `all` | Installs all supported targets |

Install one client only:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=codex
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=vscode
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=claude
```

Preview changes without writing files:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=all --dry-run
```

Check whether clients are configured:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=all --status
```

Default client config paths on Windows:

| Client | Path |
| --- | --- |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` |
| Codex | `%USERPROFILE%\.codex\config.toml` |
| VS Code | `%APPDATA%\Code\User\mcp.json` |

Restart the AI client after installing the config. The MCP config remains installed permanently until you remove it or overwrite it.

## First Prompt For Your AI Client

After `start` is ready and the AI client has the MCP config, ask:

```text
Use the connected Exasol MCP server. List available schemas, describe ANALYTICS.CUSTOMER_EVENTS, then run SELECT COUNT(*) FROM ANALYTICS.CUSTOMER_EVENTS.
```

When the AI client finishes, return to the launcher terminal and type:

```text
completed
```

The Docker stack keeps running until you stop it.

## Command Reference

Show all commands and examples:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest --help
```

Daily commands:

| Command | Purpose |
| --- | --- |
| `start` | Configure if needed, start/reuse stack, wait for readiness, run smoke tests |
| `status` | Show state directory, ports, active manifest, and Compose status |
| `doctor` | Diagnose Docker, rendered files, MCP endpoint, and client config |
| `print-mcp-config` | Print MCP URL, JSON client config, and first prompt |
| `logs` | Show Docker Compose logs |
| `smoke-test` | Run SQL and MCP smoke tests |
| `stop` | Stop containers while keeping data and config |

Daily examples:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start
npx -y @sheetaldharshan/exasol-json-mcp@latest status
npx -y @sheetaldharshan/exasol-json-mcp@latest doctor
npx -y @sheetaldharshan/exasol-json-mcp@latest print-mcp-config
npx -y @sheetaldharshan/exasol-json-mcp@latest logs --tail=300
npx -y @sheetaldharshan/exasol-json-mcp@latest smoke-test --verbose
npx -y @sheetaldharshan/exasol-json-mcp@latest stop
```

Configuration examples:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest configure
npx -y @sheetaldharshan/exasol-json-mcp@latest start --yes --no-wait
npx -y @sheetaldharshan/exasol-json-mcp@latest start --render-only --yes
npx -y @sheetaldharshan/exasol-json-mcp@latest start --home="C:\Users\sha\.exasol-json-mcp-test"
```

Useful options:

| Option | Purpose |
| --- | --- |
| `--home=<path>` | Override local state directory |
| `--channel=<stable|candidate|dev>` | Select bundled manifest channel |
| `--yes` | Use defaults and skip safe confirmations |
| `--no-wait` | Do not wait for `completed`/`exit` after start |
| `--render-only` | Render files without starting Docker |
| `--no-docker` | Configure/update/rollback without Docker actions |
| `--static-only` | For `smoke-test`, validate rendered files only |
| `--tail=<lines>` | For `logs`, number of log lines to show |
| `--client=<claude|codex|vscode|all>` | Select AI client config target |
| `--dry-run` | Preview client/autostart changes |
| `--status` | For `install-client-config`, show installed state |
| `--verbose` | Print diagnostic details |

## Start Automatically After Sign-In

Enable autostart:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest autostart enable
```

Check autostart:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest autostart status
```

Disable autostart:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest autostart disable
```

Autostart registers a user-level startup hook that runs:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest start --yes --no-wait
```

Docker Desktop still needs to be available after sign-in. The long-running database and MCP containers also use Docker restart policy `unless-stopped`, so Docker can restart them after daemon restart.

## Update And Rollback

Use only tested launcher/runtime releases. Do not point non-technical users directly at upstream image tags.

Update to the current stable manifest bundled with the package:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest update
```

Test a candidate manifest only when you are intentionally validating a release:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest update --channel=candidate
```

Rollback to the previous manifest:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest rollback
```

Check status after update or rollback:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest status
```

## Reset And Cleanup

Normal shutdown preserves data:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest stop
```

Destructive reset removes stack containers and volumes:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest reset --confirm=delete-local-exasol-json-mcp
```

Use reset only when you want a fresh local database volume. For daily use, prefer `stop`.

## Troubleshooting

### `exasol-json-mcp is not recognized`

Use the explicit `@latest` package selector:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest --help
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

Fallback form:

```powershell
npm exec -y --package=@sheetaldharshan/exasol-json-mcp@latest -- exasol-json-mcp --help
```

### Docker Is Not Running

Start Docker Desktop, wait until the engine is running, then run:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest doctor
npx -y @sheetaldharshan/exasol-json-mcp@latest start
```

### Port Already In Use

Reconfigure ports:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest configure
```

Then choose a different SQL or MCP port.

### Bootstrap Or MCP Startup Failed

Show logs and run diagnostics:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest logs --tail=300
npx -y @sheetaldharshan/exasol-json-mcp@latest doctor
npx -y @sheetaldharshan/exasol-json-mcp@latest smoke-test --verbose
```

Known production fixes already included:

- Exasol Nano readiness uses SQL retry logic instead of brittle Compose healthchecks.
- `MCP_READONLY` user creation is rerunnable.
- Existing `ANALYTICS.CUSTOMER_EVENTS` view is dropped before being recreated.
- MCP uses official `EXA_MCP_SETTINGS` and local Nano TLS settings.
- MCP smoke tests reuse the `mcp-session-id` returned by `initialize`.

### AI Client Does Not Show The MCP Server

Reinstall or check client config:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=all --status
npx -y @sheetaldharshan/exasol-json-mcp@latest install-client-config --client=all
```

Then restart the AI client.

## Maintainer Guide

Local checks:

```powershell
npm ci
npm run lint
npm test
npm run validate:manifests
npm run check:upstreams
npm pack --dry-run
```

Release and image ownership settings live in local `release.env`, which is intentionally ignored by git. Start from the template:

```powershell
Copy-Item release.env.example release.env
```

Important values:

```env
DOCKER_REGISTRY=docker.io
DOCKER_IMAGE_NAMESPACE=sheetaldharshan
JSON_BOOTSTRAP_IMAGE_NAME=exasol-json-bootstrap
MCP_SERVER_IMAGE_NAME=exasol-mcp-server
JSON_BOOTSTRAP_TAG=0.1.1
MCP_SERVER_TAG=0.1.0
NPM_PACKAGE_NAME=@sheetaldharshan/exasol-json-mcp
```

Build and push images using `release.env`:

```powershell
npm run images:set-namespace
npm run images:push
```

GitHub Actions:

| Workflow | Purpose |
| --- | --- |
| `ci` | Lint, tests, manifest validation, package dry-run, render-only smoke |
| `docker-compatibility` | Manual full Docker stack compatibility test |
| `upstream-watch` | Scheduled upstream release monitor |
| `release-npm` | Publish npm package from tag or manual workflow |

Release order:

1. Review `npm run check:upstreams` or the upstream-watch issue.
2. Update candidate pins only.
3. Build and push candidate Docker images.
4. Run `docker-compatibility` with `channel=candidate`.
5. Promote tested pins to `stable`.
6. Run `docker-compatibility` with `channel=stable`.
7. Bump npm version.
8. Publish npm package.
9. Tell users to run `npx -y @sheetaldharshan/exasol-json-mcp@latest update`.

More documentation:

- `docs/user-guide.md`
- `docs/operations.md`
- `docs/maintainer-updates.md`
- `docs/release-checklist.md`
- `docs/runtime-packaging.md`
