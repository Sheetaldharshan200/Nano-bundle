# Maintainer Update Guide

The project intentionally separates upstream discovery from user updates.

Upstream discovery tells maintainers that a new Exasol Nano, Exasol MCP Server, or JSON Tables release exists. User updates happen only after candidate pins pass compatibility tests and are promoted to stable.

## Upstream Sources

- Exasol Nano: Docker Hub repository `exasol/nano`.
- Exasol MCP Server: PyPI package `exasol-mcp-server`.
- JSON Tables: GitHub repository `exasol-labs/exasol-json-tables` tags/releases.

## Scheduled Watcher

GitHub Actions workflow: `upstream-watch`.

It runs daily and can also be started manually. It writes an upstream report and opens a GitHub issue when newer upstream versions are found.

Local command:

```powershell
npm run check:upstreams
```

## Maintainer Flow For New Upstream Versions

1. Read the upstream-watch issue.
2. Review upstream release notes and breaking changes.
3. Update Docker build requirements or image pins in a candidate branch.
4. Build and push candidate Docker images.
5. Update `manifests/candidate.json` only.
6. Run `docker-compatibility` with `channel=candidate`.
7. If candidate passes, promote pins to `manifests/stable.json`.
8. Run `docker-compatibility` with `channel=stable`.
9. Bump the npm package version.
10. Publish the release.

## User Update Contract

Users should not follow upstream tags directly. They should use only tested package releases and stable manifests:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp update
```

If an update fails:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp rollback
```

## Why The Watcher Opens Issues Instead Of Auto-Updating Pins

The stack includes a database, bootstrap job, MCP server, and security settings. New upstream versions can change startup behavior, tool names, SQL behavior, authentication, or settings. Auto-changing stable pins before a full smoke test would risk breaking non-technical users.

## Promotion Checklist

- [ ] Upstream release notes reviewed.
- [ ] Candidate Docker images built and pushed.
- [ ] Candidate manifest updated.
- [ ] `npm run lint` passed.
- [ ] `npm test` passed.
- [ ] `npm run validate:manifests` passed.
- [ ] `npm run check:upstreams` reviewed.
- [ ] GitHub `docker-compatibility` passed on candidate.
- [ ] Stable manifest updated only after candidate passed.
- [ ] GitHub `docker-compatibility` passed on stable.
- [ ] Release notes include update and rollback commands.
