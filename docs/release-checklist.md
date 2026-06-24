# Release Checklist

Use this checklist before promoting a candidate manifest to stable.

- [ ] Version pins changed only in manifests and generated metadata.
- [ ] Upstream release notes reviewed for Exasol Nano, JSON bootstrap image, and MCP Server image.
- [ ] `npm run lint` passed.
- [ ] `npm test` passed.
- [ ] `npm run validate:manifests` passed.
- [ ] `npm pack --dry-run` passed.
- [ ] Manual `docker-compatibility` workflow passed for candidate.
- [ ] Update from previous stable passed.
- [ ] Rollback from candidate to previous stable passed.
- [ ] MCP write query remained blocked.
- [ ] MCP startup logs do not contain the known local no-auth or schema-shadow warnings.
- [ ] Release notes include changed pins, migration notes, and rollback command.

## Release Notes Template

### Changed Pins

- Exasol Nano: `old` -> `new`
- JSON bootstrap: `old` -> `new`
- MCP Server: `old` -> `new`

### Compatibility

Summarize tested OS/runtime matrix and Docker/Compose versions.

### User Impact

Describe startup, data, schema, MCP, or configuration changes.

### Rollback

```bash
npx @sheetaldharshan/exasol-json-mcp rollback
```