# Release Checklist

Use this checklist before promoting a candidate manifest to stable.

- [ ] `release.env` reviewed locally and `release.env.example` updated if new release variables are needed.
- [ ] Version pins changed only in manifests and generated metadata.
- [ ] Upstream release notes reviewed for Exasol Nano, JSON bootstrap image, and MCP Server image.
- [ ] `npm run lint` passed.
- [ ] `npm test` passed.
- [ ] `npm run validate:manifests` passed.
- [ ] `npm pack --dry-run` passed.
- [ ] `npm whoami` returns the account or organization configured by `NPM_PACKAGE_NAME`, or GitHub secret `NPM_TOKEN` is configured for workflow publishing.
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
npx <NPM_PACKAGE_NAME> rollback
```

## npm Release

The package name should match `NPM_PACKAGE_NAME` in `release.env`. For the public package in this repo, that is `@sheetaldharshan/exasol-json-mcp`.

Manual publish:

```bash
npm login
npm whoami
npm publish --access public
```

GitHub Actions publish requires a repository secret named `NPM_TOKEN` containing an npm automation token for the configured npm package scope. Push a `vX.Y.Z` tag or run the `release-npm` workflow manually after CI passes.
