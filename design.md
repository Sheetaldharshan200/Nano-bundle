# Design

## Overview

The deliverable is a cross-platform CLI launcher that owns the local user experience while Docker Compose owns runtime process isolation. The launcher does not ask users to clone repositories or install project internals. It renders configuration from a tested release manifest, starts the stack, verifies readiness, and prints copy-paste instructions for AI clients.

## Architecture

```text
npx / pipx launcher
        |
        v
local state directory
        |
        +-- .env
        +-- docker-compose.yml
        +-- manifest.json
        +-- previous-manifest.json
        +-- mcp/settings.json
        +-- samples/
        +-- logs/
        |
        v
Docker Compose
        |
        +-- exanano
        |     image: docker.io/exasol/nano:<pinned-version>
        |     bind: 127.0.0.1:8563
        |     volume: exa-data:/exa
        |     shm_size: 512m
        |
        +-- json-bootstrap
        |     image: docker.io/sheetaldharshan/exasol-json-bootstrap:<pinned-version>
        |     action: create schemas, load JSON, publish views, grant readonly access
        |
        +-- mcp-server
              image: docker.io/sheetaldharshan/exasol-mcp-server:<pinned-version>
              bind: 127.0.0.1:7766
              user: MCP_READONLY
              schema scope: ANALYTICS
```

## CLI Package Strategy

The Node package is the primary distribution because `npx` gives the shortest cross-platform command. The Python package is a fallback with equivalent CLI behavior through `pipx run`.

Both launchers should share the same command contract and release manifest format. If both implementations exist, keep one canonical implementation for Compose rendering and manifest validation, or generate both from shared fixtures to avoid behavior drift.

## Local State

Default state directory:

- Windows: `%USERPROFILE%\.exasol-json-mcp\`
- macOS/Linux: `~/.exasol-json-mcp/`

Files:

- `.env`: user-selected settings and generated secrets.
- `docker-compose.yml`: rendered runtime stack.
- `manifest.json`: active tested versions.
- `previous-manifest.json`: rollback target.
- `mcp/settings.json`: safe MCP capability settings.
- `samples/`: optional sample JSON/NDJSON data.
- `logs/`: launcher logs and smoke-test summaries.

## First-Run Flow

1. Parse command and resolve state directory.
2. Detect Docker, Docker Compose, daemon status, and port availability.
3. Load existing `.env` or prompt for missing values.
4. Generate defaults, including random MCP password.
5. Persist `.env` with restrictive file permissions where the OS supports it.
6. Resolve the stable release manifest.
7. Render Compose and MCP settings.
8. Pull/start services.
9. Wait for Exasol SQL/TLS readiness.
10. Wait for JSON bootstrap completion.
11. Wait for MCP readiness.
12. Run smoke tests unless explicitly skipped by a future advanced flag.
13. Print `Ready`, MCP config, first AI prompt, and terminal wait instructions.

## Daily Run Flow

1. Load `.env`.
2. Validate Docker and ports.
3. Re-render config if templates or manifest changed.
4. Start or reuse existing containers.
5. Verify readiness.
6. Print the same MCP instructions.

## Command Behavior

`start`: Create config if missing, start stack, verify readiness, print instructions, wait for `completed` or `exit`.

`stop`: Stop containers and keep volumes and config.

`status`: Print active manifest, configured ports, service health, data directory, and next useful commands.

`configure`: Re-run prompts and rewrite `.env`, preserving previous values as defaults.

`logs`: Show service logs with service filtering and follow mode.

`smoke-test`: Run database, JSON, and MCP checks without changing config.

`update`: Resolve target manifest, show current and target versions, confirm, save previous manifest, pull images, start stack, run smoke tests, and print rollback guidance.

`rollback`: Restore `previous-manifest.json`, pull/start previous images, run smoke tests, and report result.

`reset`: Confirm by requiring an explicit phrase, then stop containers and remove project volumes/config according to selected reset scope.

`print-mcp-config`: Print only the MCP URL/config block and first prompt.

## Release Manifest

Example:

```json
{
  "channel": "stable",
  "versions": {
    "exasolNanoImage": "docker.io/exasol/nano:<tested-tag>",
    "jsonBootstrapImage": "docker.io/sheetaldharshan/exasol-json-bootstrap:<tested-tag>",
    "mcpServerImage": "docker.io/sheetaldharshan/exasol-mcp-server:<tested-tag>"
  },
  "minimums": {
    "docker": "24.0.0",
    "compose": "2.20.0"
  }
}
```

Rules:

- Stable manifests contain only tested pins.
- Candidate manifests can be promoted only after the compatibility matrix passes.
- Runtime releases must not depend on live Git branches.

## Security Design

Default MCP settings:

```json
{
  "enable_read_query": true,
  "enable_write_query": false,
  "enable_summarize_table": false,
  "enable_query_profiling": false,
  "enable_read_bucketfs": false,
  "enable_write_bucketfs": false,
  "schemas": {
    "like_pattern": "ANALYTICS"
  },
  "views": {
    "enable": true
  },
  "functions": {
    "enable": false
  },
  "scripts": {
    "enable": false
  },
  "language": "english"
}
```

The bootstrap service creates `MCP_READONLY`, grants only required schema privileges, and avoids using `SYS` for runtime AI access. The launcher must make insecure overrides explicit in prompts and status output.


## Runtime Compatibility Decisions

The Docker runtime includes guardrails for the exact failures found during Windows Docker Desktop validation:

- Exasol Nano is digest-pinned and has no Compose healthcheck. The bootstrap service starts after the Nano container starts and performs its own SQL retry loop, avoiding brittle shell-specific `/dev/tcp` checks inside the Nano image.
- The bootstrap service uses Exasol-compatible password literals for `CREATE USER` and treats `user name ... conflicts with another user or role name` as an existing-user condition, so restart/update flows are rerunnable.
- Sample rows are inserted with explicit SQL literals rather than unsupported pyexasol list-parameter batching.
- The MCP service passes settings through the official `EXA_MCP_SETTINGS` variable and disables certificate validation for the local Nano self-signed certificate with `EXA_SSL_CERT_VALIDATION=no`.
- MCP HTTP is published only on `127.0.0.1`. The upstream server is started in local no-auth mode inside the container, while database access is constrained by the `MCP_READONLY` user and MCP tool settings. The wrapper suppresses the upstream no-auth warning because it is expected for this single-user localhost deployment.
- MCP smoke tests create and reuse the `mcp-session-id` returned by `initialize`, then validate schema listing, read query, and write-block behavior.
## Failure Handling

- Missing Docker: print install/start guidance and exit nonzero.
- Docker daemon stopped: ask user to start Docker Desktop or service.
- Port conflict: identify the port and offer `configure`.
- Exasol not ready: show last relevant service logs and suggest `logs`.
- Bootstrap failure: preserve logs, mark stack unhealthy, and avoid printing `Ready`.
- MCP failure: show MCP logs and keep database running for diagnosis.
- Smoke-test failure after update: offer rollback immediately.

## Compatibility Test Matrix

- Start stack.
- Connect to Nano over SQL/TLS.
- Run `SELECT 1`.
- Run JSON ingest.
- Query `ANALYTICS.CUSTOMER_EVENTS`.
- Start MCP Server.
- MCP list schemas.
- MCP read query.
- MCP write query blocked.
- Reset stack.

## Documentation Output

The launcher output is part of the product surface. It must be concise, copy-pasteable, and complete enough that the user does not need to search docs during first run.
