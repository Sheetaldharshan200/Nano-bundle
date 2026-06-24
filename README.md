# Exasol JSON MCP Launcher

One-command local launcher for Exasol Nano, JSON Tables bootstrap, and Exasol MCP Server.

```bash
npx @sheetaldharshan/exasol-json-mcp start
```

Current implementation status is tracked in `tasks.md`. The launcher renders pinned Docker Compose runtime files, safe MCP settings, first-run configuration, update/rollback state, and smoke-test orchestration. Release manifests point to tested Docker Hub images under `docker.io/sheetaldharshan/*`.

## Local Development

```bash
npm run lint
npm test
node ./bin/exasol-json-mcp.js start --home=.tmp/local --render-only --yes
```

## Safety Defaults

- SQL and MCP bind to `127.0.0.1`.
- MCP uses `MCP_READONLY`, not `SYS`.
- MCP write query, BucketFS, functions, scripts, profiling, and summarization are disabled.
- Release manifests reject `latest`, `main`, `master`, and untagged images.
## First Run

```bash
npx @sheetaldharshan/exasol-json-mcp start
```

The launcher writes its runtime files under `~/.exasol-json-mcp` or `%USERPROFILE%\.exasol-json-mcp`, starts Docker Compose, runs SQL and MCP smoke checks, then prints the MCP URL and first AI prompt. Re-running `start` reuses `.env` and does not ask setup questions again.

Useful commands:

```bash
npx @sheetaldharshan/exasol-json-mcp status
npx @sheetaldharshan/exasol-json-mcp logs
npx @sheetaldharshan/exasol-json-mcp smoke-test
npx @sheetaldharshan/exasol-json-mcp stop
```

## Local MCP Security Boundary

The MCP HTTP endpoint is bound to `127.0.0.1` by default. The upstream Exasol MCP Server runs in local HTTP mode inside Docker; access control is enforced by Docker loopback binding, the generated `MCP_READONLY` database user, and MCP settings that disable write query, BucketFS, functions, scripts, profiling, and summarization. Do not publish the MCP port on a public interface without adding an external authentication proxy.

## npm Publishing

This package is scoped to the npm account `sheetaldharshan`.

Manual publish:

```bash
npm login
npm whoami
npm ci
npm run lint
npm test
npm run validate:manifests
npm pack --dry-run
npm publish --access public
```

GitHub publish:

1. Create an npm automation token in the `sheetaldharshan` npm account.
2. Add it to the GitHub repository as `Settings -> Secrets and variables -> Actions -> New repository secret`.
3. Name the secret `NPM_TOKEN`.
4. Push a version tag like `v0.1.0` or run the `release-npm` workflow manually.

