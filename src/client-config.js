import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { renderMcpClientConfig } from "./render.js";

export const SUPPORTED_CLIENTS = ["claude", "codex", "vscode"];

export function expandClients(client = "claude") {
  if (client === "all") return SUPPORTED_CLIENTS;
  if (!SUPPORTED_CLIENTS.includes(client)) throw new Error(`Unsupported client: ${client}. Supported clients: ${SUPPORTED_CLIENTS.join(", ")}, all`);
  return [client];
}

export function claudeConfigPath({ platform = process.platform, env = process.env } = {}) {
  if (platform === "win32") return join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "Claude", "claude_desktop_config.json");
}

export function codexConfigPath({ env = process.env } = {}) {
  return join(env.CODEX_HOME || join(homedir(), ".codex"), "config.toml");
}

export function vscodeConfigPath({ platform = process.platform, env = process.env } = {}) {
  if (env.VSCODE_MCP_CONFIG_PATH) return env.VSCODE_MCP_CONFIG_PATH;
  if (platform === "win32") return join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "Code", "User", "mcp.json");
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "Code", "User", "mcp.json");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "Code", "User", "mcp.json");
}

export async function installClientConfig(config, { client = "claude", platform = process.platform, env = process.env, dryRun = false } = {}) {
  if (client === "codex") return installCodexConfig(config, { env, dryRun });
  if (client === "vscode") return installJsonClientConfig(config, { client, path: vscodeConfigPath({ platform, env }), rootKey: "servers", dryRun });
  if (client === "claude") return installJsonClientConfig(config, { client, path: claudeConfigPath({ platform, env }), rootKey: "mcpServers", dryRun });
  throw new Error(`Unsupported client: ${client}. Supported clients: ${SUPPORTED_CLIENTS.join(", ")}, all`);
}

export async function clientConfigStatus(config, { client = "claude", platform = process.platform, env = process.env } = {}) {
  if (client === "codex") return codexConfigStatus(config, { env });
  if (client === "vscode") return jsonClientConfigStatus(config, { client, path: vscodeConfigPath({ platform, env }), rootKey: "servers" });
  if (client === "claude") return jsonClientConfigStatus(config, { client, path: claudeConfigPath({ platform, env }), rootKey: "mcpServers" });
  throw new Error(`Unsupported client: ${client}. Supported clients: ${SUPPORTED_CLIENTS.join(", ")}, all`);
}

async function installJsonClientConfig(config, { client, path, rootKey, dryRun = false }) {
  const existing = await readJsonIfExists(path);
  const next = mergeJsonMcpServer(existing, config, rootKey, expectedJsonServer(config, client));
  if (dryRun) return { client, path, config: next, changed: JSON.stringify(existing) !== JSON.stringify(next) };
  await mkdir(dirname(path), { recursive: true });
  if (existsSync(path)) await copyFile(path, `${path}.bak`);
  await writeFile(path, JSON.stringify(next, null, 2) + "\n", "utf8");
  return { client, path, config: next, changed: true };
}

async function installCodexConfig(config, { env = process.env, dryRun = false } = {}) {
  const path = codexConfigPath({ env });
  const existing = existsSync(path) ? await readFile(path, "utf8") : "";
  const next = upsertCodexMcpServer(existing, config);
  if (dryRun) return { client: "codex", path, config: next, changed: existing !== next };
  await mkdir(dirname(path), { recursive: true });
  if (existsSync(path)) await copyFile(path, `${path}.bak`);
  await writeFile(path, next, "utf8");
  return { client: "codex", path, config: next, changed: true };
}

async function jsonClientConfigStatus(config, { client, path, rootKey }) {
  const existing = await readJsonIfExists(path);
  const expected = expectedJsonServer(config, client);
  const actual = existing?.[rootKey]?.exasol_nano;
  return { client, path, installed: JSON.stringify(actual) === JSON.stringify(expected), actual, expected };
}

async function codexConfigStatus(config, { env = process.env } = {}) {
  const path = codexConfigPath({ env });
  const source = existsSync(path) ? await readFile(path, "utf8") : "";
  const expected = expectedCodexServer(config);
  const actual = extractCodexServer(source);
  return { client: "codex", path, installed: actual.url === expected.url && actual.enabled !== false, actual, expected };
}

function mergeJsonMcpServer(existing, config, rootKey, server) {
  const current = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  return {
    ...current,
    [rootKey]: {
      ...(current[rootKey] || {}),
      exasol_nano: server
    }
  };
}

function expectedJsonServer(config, client) {
  const url = mcpUrl(config);
  if (client === "vscode") return { type: "http", url };
  return JSON.parse(renderMcpClientConfig(config)).mcpServers.exasol_nano;
}

function expectedCodexServer(config) {
  return {
    url: mcpUrl(config),
    enabled: true,
    startup_timeout_sec: 20,
    tool_timeout_sec: 120
  };
}

function upsertCodexMcpServer(source, config) {
  const normalized = source.trimEnd();
  const section = renderCodexSection(config);
  const sectionPattern = /(?:^|\r?\n)\[mcp_servers\.exasol_nano\][\s\S]*?(?=\r?\n\[[^\]]+\]|$)/;
  if (sectionPattern.test(normalized)) {
    return normalized.replace(sectionPattern, (match) => `${match.startsWith("\n") || match.startsWith("\r\n") ? "\n" : ""}${section.trimEnd()}`) + "\n";
  }
  return `${normalized}${normalized ? "\n\n" : ""}${section}`;
}

function renderCodexSection(config) {
  const expected = expectedCodexServer(config);
  return `[mcp_servers.exasol_nano]\nurl = "${escapeTomlString(expected.url)}"\nenabled = true\nstartup_timeout_sec = ${expected.startup_timeout_sec}\ntool_timeout_sec = ${expected.tool_timeout_sec}\n`;
}

function extractCodexServer(source) {
  const match = source.match(/(?:^|\r?\n)\[mcp_servers\.exasol_nano\]([\s\S]*?)(?=\r?\n\[[^\]]+\]|$)/);
  if (!match) return {};
  const body = match[1];
  return {
    url: readTomlString(body, "url"),
    enabled: readTomlBoolean(body, "enabled")
  };
}

function readTomlString(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*"((?:\\\\.|[^"])*)"`, "m"));
  return match ? match[1].replaceAll('\\"', '"').replaceAll('\\\\', '\\') : undefined;
}

function readTomlBoolean(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)`, "m"));
  return match ? match[1] === "true" : undefined;
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return {};
  const source = await readFile(path, "utf8");
  if (!source.trim()) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Could not parse existing client config at ${path}: ${error.message}`);
  }
}

function mcpUrl(config) {
  return `http://localhost:${config.mcpPort}/mcp`;
}

function escapeTomlString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}