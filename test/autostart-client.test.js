import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autostartPlan, enableAutostart } from "../src/autostart.js";
import { claudeConfigPath, codexConfigPath, vscodeConfigPath, expandClients, installClientConfig, clientConfigStatus } from "../src/client-config.js";

const config = {
  mcpPort: "7766"
};

test("autostart plan uses npx start with no wait", () => {
  const plan = autostartPlan("C:\\Users\\me\\.exasol-json-mcp", { platform: "win32" });
  assert.match(plan.command, /npx -y @sheetaldharshan\/exasol-json-mcp@latest start/);
  assert.match(plan.command, /--yes --no-wait/);
  assert.equal(plan.installCommand[0], "schtasks");
});

test("autostart dry run writes launcher script without enabling OS service", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-autostart-"));
  try {
    const { plan } = await enableAutostart(dir, { platform: "win32", dryRun: true });
    const script = await readFile(plan.scriptPath, "utf8");
    assert.match(script, /exasol-json-mcp@latest start/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("client=all expands to every supported client", () => {
  assert.deepEqual(expandClients("all"), ["claude", "codex", "vscode"]);
});

test("Claude client config is merged without deleting existing servers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-client-"));
  const appData = join(dir, "AppData", "Roaming");
  const path = claudeConfigPath({ platform: "win32", env: { APPDATA: appData } });
  try {
    await writeFile(path, "", "utf8").catch(async () => {
      await import("node:fs/promises").then(({ mkdir }) => mkdir(join(appData, "Claude"), { recursive: true }));
      await writeFile(path, JSON.stringify({ mcpServers: { existing: { command: "keep" } } }), "utf8");
    });
    await installClientConfig(config, { client: "claude", platform: "win32", env: { APPDATA: appData } });
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.equal(saved.mcpServers.existing.command, "keep");
    assert.equal(saved.mcpServers.exasol_nano.url, "http://localhost:7766/mcp");
    const status = await clientConfigStatus(config, { client: "claude", platform: "win32", env: { APPDATA: appData } });
    assert.equal(status.installed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Codex config.toml is merged without deleting existing settings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-codex-"));
  const path = codexConfigPath({ env: { CODEX_HOME: dir } });
  try {
    await writeFile(path, "model = \"gpt-5.5\"\n\n[mcp_servers.existing]\nurl = \"http://localhost:1234/mcp\"\n", "utf8");
    await installClientConfig(config, { client: "codex", env: { CODEX_HOME: dir } });
    const saved = await readFile(path, "utf8");
    assert.match(saved, /model = "gpt-5\.5"/);
    assert.match(saved, /\[mcp_servers\.existing\]/);
    assert.match(saved, /\[mcp_servers\.exasol_nano\]/);
    assert.match(saved, /url = "http:\/\/localhost:7766\/mcp"/);
    const status = await clientConfigStatus(config, { client: "codex", env: { CODEX_HOME: dir } });
    assert.equal(status.installed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("VS Code mcp.json is merged without deleting existing servers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-vscode-"));
  const path = vscodeConfigPath({ platform: "win32", env: { VSCODE_MCP_CONFIG_PATH: join(dir, "mcp.json") } });
  try {
    await writeFile(path, JSON.stringify({ servers: { existing: { type: "http", url: "http://localhost:1234/mcp" } } }), "utf8");
    await installClientConfig(config, { client: "vscode", platform: "win32", env: { VSCODE_MCP_CONFIG_PATH: path } });
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.equal(saved.servers.existing.url, "http://localhost:1234/mcp");
    assert.deepEqual(saved.servers.exasol_nano, { type: "http", url: "http://localhost:7766/mcp" });
    const status = await clientConfigStatus(config, { client: "vscode", platform: "win32", env: { VSCODE_MCP_CONFIG_PATH: path } });
    assert.equal(status.installed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});