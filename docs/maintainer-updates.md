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

## Release Environment File

Account-specific release settings live in `release.env`, which is intentionally not committed. Start from the checked-in template:

```powershell
Copy-Item release.env.example release.env
```

Set at least these values before building or promoting images:

```env
DOCKER_IMAGE_NAMESPACE=your-dockerhub-user-or-org
JSON_BOOTSTRAP_TAG=0.1.1
MCP_SERVER_TAG=0.1.0
NPM_PACKAGE_NAME=@your-npm-scope/exasol-json-mcp
```

Then use the scripts without hardcoded account names:

```powershell
npm run images:set-namespace
npm run images:push
```

You can still override from the command line for one-off work:

```powershell
node scripts/set-image-namespace.js --namespace=your-dockerhub-user --json-bootstrap-tag=0.1.1 --mcp-server-tag=0.1.0
node scripts/build-images.js --namespace=your-dockerhub-user --json-bootstrap-tag=0.1.1 --mcp-server-tag=0.1.0 --push
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
npx -y <NPM_PACKAGE_NAME> update
```

If an update fails:

```powershell
npx -y <NPM_PACKAGE_NAME> rollback
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
