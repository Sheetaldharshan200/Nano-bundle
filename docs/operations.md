# Operations And Troubleshooting

This document records production runtime decisions and the fixes for issues found during Windows Docker Desktop validation.

## Docker Hub Images

The release manifests use tested Docker images. Maintainers configure the Docker Hub account or organization with `DOCKER_IMAGE_NAMESPACE` in `release.env`; the current public release uses `docker.io/sheetaldharshan/*`:

- `docker.io/sheetaldharshan/exasol-json-bootstrap:0.1.1`
- `docker.io/sheetaldharshan/exasol-mcp-server:0.1.0`

Candidate and dev tags are available in the release manifests for each runtime image; the JSON bootstrap fix is published as `0.1.1`, `0.1.1-candidate`, and `0.1.1-dev`.

## Known Startup Failure Classes Now Covered

- Nano readiness is handled by bootstrap SQL retries, not by a Compose healthcheck inside the Nano container.
- `CREATE USER MCP_READONLY` is idempotent and handles Exasol's conflict message on reruns.
- Bootstrap inserts sample rows without unsupported pyexasol batch-parameter execution.
- MCP settings use `EXA_MCP_SETTINGS`; `MCP_SETTINGS_FILE` is not used by upstream Exasol MCP Server.
- Local Nano TLS uses `EXA_SSL_CERT_VALIDATION=no` because Nano uses a self-signed certificate in this local stack.
- MCP smoke tests reuse the `mcp-session-id` returned by `initialize`.
- FastMCP tool errors with `result.isError=true` fail smoke tests unless the test is explicitly checking blocked writes.

## Expected Local Security Model

The MCP server is intended for a single-user local workstation. Docker publishes it on `127.0.0.1` only. The upstream MCP HTTP server is run in local no-auth mode inside the container, but the database credentials are restricted to `MCP_READONLY`, and write-capable MCP tools are disabled by default. For remote or shared deployments, put an authenticated reverse proxy in front of MCP and do not bind the port to `0.0.0.0`.

## Verification Commands

```bash
npm run lint
npm test
npm run validate:manifests
npm pack --dry-run
node ./bin/exasol-json-mcp.js start --home=.tmp/live-dockerhub --no-wait --verbose
```

The full smoke test should pass SQL TCP, bootstrap completion, MCP HTTP, SQL `SELECT 1`, SQL `ANALYTICS.CUSTOMER_EVENTS` count, MCP initialize/list tools/list schemas/read query, and write-block checks.