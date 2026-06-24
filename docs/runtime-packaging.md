# Runtime Packaging Notes

The current runtime uses Docker because Exasol Nano, JSON bootstrap, and the MCP server can be pinned, isolated, smoke-tested, updated, and rolled back consistently.

If Exasol later provides Nano as a supported Windows `.exe`, macOS app, or Linux AppImage, this launcher can still bundle the experience with the same outer contract:

```powershell
npx -y @sheetaldharshan/exasol-json-mcp start
npx -y @sheetaldharshan/exasol-json-mcp update
npx -y @sheetaldharshan/exasol-json-mcp rollback
```

## Adapter Model

Add a runtime provider layer behind the existing commands:

- `docker`: current Docker Compose provider.
- `native-windows`: future Exasol-provided `.exe` provider.
- `native-linux-appimage`: future Exasol-provided AppImage provider.
- `native-macos`: future Exasol-provided app/binary provider.

The launcher should keep the same state directory, `.env`, manifest, MCP settings, smoke tests, and user commands. Only the provider-specific start/stop/status/update implementation changes.

## What The Native Provider Would Need

A native Exasol runtime would need documented support for:

- Non-interactive install/start/stop/status commands.
- Local data directory configuration.
- SQL host/port binding to `127.0.0.1`.
- SYS password initialization or secure first-run password handling.
- Logs location.
- Version reporting.
- Clean uninstall/reset behavior.
- Exit codes suitable for automation.

Without those hooks, Docker remains the safer production wrapper.

## How MCP Still Fits

The MCP server can remain containerized or become a native sidecar. The important contract is the same:

- MCP binds to `127.0.0.1`.
- MCP connects with `MCP_READONLY`.
- MCP settings disable unsafe tools by default.
- Smoke tests verify schema listing, read query, and blocked write behavior.

## Packaging Later

A future `.exe` or AppImage wrapper for this launcher can embed Node or be rewritten as a native shell. It should still call the same provider contract and keep `npx` as a supported fallback for advanced users.
