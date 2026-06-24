# User Guide

This guide is written for analysts, BI users, and demo users who do not want to manage Docker Compose files by hand.

## Install

You do not need to clone this repository.

Install Docker Desktop and Node.js, then run:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp start
```

The `-y` flag tells npm not to ask an extra install question.

## What Happens During Start

The launcher creates a private local working folder and writes runtime files there. It then starts three Docker services:

- `exanano`: the local Exasol Nano database.
- `json-bootstrap`: the setup job that creates the `ANALYTICS` schema and sample JSON data.
- `mcp-server`: the read-only MCP endpoint for AI assistants.

When all checks pass, the launcher prints `Ready`.

On a new machine or after Docker cleanup, this can take several minutes. The launcher is doing three things in sequence: downloading images, starting Exasol Nano, then running JSON and MCP smoke tests. Later runs are normally faster.

## What To Copy Into Your AI Client

Copy the JSON block printed under `AI client MCP config`.

The default endpoint is:

```text
http://localhost:7766/mcp
```

Then ask your AI client:

```text
Use the connected Exasol MCP server. List available schemas, describe ANALYTICS.CUSTOMER_EVENTS, then run SELECT COUNT(*) FROM ANALYTICS.CUSTOMER_EVENTS.
```

## Common Commands

Start or reuse the environment:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp start
```

Check whether it is configured and running:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp status
```

Show logs:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp logs
```

Run a health check:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp smoke-test
```

Stop without deleting data:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp stop
```

Print the MCP config again:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp print-mcp-config
```

## Updates

Use update when a maintainer announces a tested release:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp update
```

The launcher shows versions before applying the update. If anything fails, run:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp rollback
```

## Reset

Only reset when you want to delete the local Docker volume for this stack:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp reset --confirm=delete-local-exasol-json-mcp
```

For normal daily shutdown, use `stop` instead.

## Safety Notes

- The MCP endpoint is local-only by default.
- The AI client uses `MCP_READONLY`, not the database admin user.
- Write SQL is disabled through MCP settings.
- Do not expose port `7766` to a public network without adding authentication and network controls.
