# Release Checklist

Use this checklist before promoting a candidate manifest to stable.

- [ ] Version pins changed only in manifests and generated metadata.
- [ ] Upstream release notes reviewed for Exasol Nano, JSON bootstrap image, and MCP Server image.
- [ ] `npm run lint` passed.
- [ ] `npm test` passed.
- [ ] `npm run validate:manifests` passed.
- [ ] `npm pack --dry-run` passed.
- [ ] `npm whoami` returns `sheetaldharshan` for manual npm publishing, or GitHub secret `NPM_TOKEN` is configured for workflow publishing.
- [ ] GitHub `CI` workflow passed on `main`.
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

## npm Release

The package name is `@sheetaldharshan/exasol-json-mcp`, so it must be published from the npm account or organization named `sheetaldharshan`.

Manual publish:

```bash
npm login
npm whoami
npm publish --access public
```

GitHub Actions publish requires a repository secret named `NPM_TOKEN` containing an npm automation token from the `sheetaldharshan` account. Push tag `v0.1.0` or run the `release-npm` workflow manually after CI passes.
