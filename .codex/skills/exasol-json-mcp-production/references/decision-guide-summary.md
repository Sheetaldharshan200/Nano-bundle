# Decision Guide Summary

Source: `C:\Users\sha\Downloads\exasol-nano-json-mcp-final-decision-guide.md`, dated 2026-06-23.

## Product Decision

Build a one-command launcher as the primary user experience:

```bash
npx @your-org/exasol-json-mcp start
```

Keep a Python fallback:

```bash
pipx run exasol-json-mcp start
```

The launcher creates a local work directory, writes `.env`, renders Docker Compose and MCP settings, starts the stack, waits for readiness, prints MCP client instructions, and keeps the terminal open until the user confirms completion.

## Runtime Stack

- `exasol/nano:<pinned-version>` for the local Exasol database.
- `json-bootstrap` service for JSON Tables setup, sample data, schemas, views, and grants.
- `mcp-server` service for safe AI access through MCP.

Default local state directory:

- Windows: `%USERPROFILE%\.exasol-json-mcp\`
- macOS/Linux: `~/.exasol-json-mcp/`

## Required Commands

- `start`
- `stop`
- `status`
- `configure`
- `logs`
- `smoke-test`
- `update`
- `rollback`
- `reset`
- `print-mcp-config`

## Core Security Defaults

- Bind SQL and MCP ports to `127.0.0.1`.
- Generate the MCP readonly password by default.
- Use `MCP_READONLY` for MCP access.
- Expose only `ANALYTICS` schema to MCP by default.
- Disable MCP write query, BucketFS read/write, functions, scripts, summarization, and profiling by default.
- Pin all images and package versions.

## Compatibility Tests

- Stack starts.
- Nano accepts SQL/TLS connection.
- `SELECT 1` works.
- JSON ingest works.
- `ANALYTICS.CUSTOMER_EVENTS` can be queried.
- MCP starts.
- MCP can list schemas.
- MCP read query works.
- MCP write query is blocked.
- Reset cleanup works.
