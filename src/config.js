import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, win32 } from "node:path";
import { randomBytes } from "node:crypto";
import { DEFAULTS, ENV_KEYS } from "./constants.js";

export function defaultStateDir(env = process.env, platform = process.platform) {
  if (env.EXASOL_JSON_MCP_HOME) return env.EXASOL_JSON_MCP_HOME;
  if (platform === "win32") return win32.join(env.USERPROFILE || homedir(), ".exasol-json-mcp");
  return join(env.HOME || homedir(), ".exasol-json-mcp");
}

export function createDefaultConfig(overrides = {}) {
  return {
    ...DEFAULTS,
    exasolNanoImage: overrides.exasolNanoImage,
    mcpReadonlyPassword: generatePassword(),
    ...overrides
  };
}

export function generatePassword() {
  return randomBytes(24).toString("base64url");
}

export function parseEnvFile(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    values[line.slice(0, equals)] = unquote(line.slice(equals + 1));
  }
  return {
    exasolNanoImage: values[ENV_KEYS.exasolNanoImage],
    sysPassword: values[ENV_KEYS.sysPassword] || DEFAULTS.sysPassword,
    mcpReadonlyPassword: values[ENV_KEYS.mcpReadonlyPassword] || generatePassword(),
    sqlHost: values[ENV_KEYS.sqlHost] || DEFAULTS.sqlHost,
    sqlPort: values[ENV_KEYS.sqlPort] || DEFAULTS.sqlPort,
    mcpHost: values[ENV_KEYS.mcpHost] || DEFAULTS.mcpHost,
    mcpPort: values[ENV_KEYS.mcpPort] || DEFAULTS.mcpPort,
    datasetName: values[ENV_KEYS.datasetName] || DEFAULTS.datasetName,
    useSampleData: values[ENV_KEYS.useSampleData] || DEFAULTS.useSampleData,
    mcpReadonlyUser: values[ENV_KEYS.mcpReadonlyUser] || DEFAULTS.mcpReadonlyUser
  };
}

export function serializeEnvFile(config) {
  const rows = [
    [ENV_KEYS.exasolNanoImage, config.exasolNanoImage],
    [ENV_KEYS.sysPassword, config.sysPassword],
    [ENV_KEYS.mcpReadonlyPassword, config.mcpReadonlyPassword],
    [ENV_KEYS.sqlHost, config.sqlHost],
    [ENV_KEYS.sqlPort, config.sqlPort],
    [ENV_KEYS.mcpHost, config.mcpHost],
    [ENV_KEYS.mcpPort, config.mcpPort],
    [ENV_KEYS.datasetName, config.datasetName],
    [ENV_KEYS.useSampleData, config.useSampleData],
    [ENV_KEYS.mcpReadonlyUser, config.mcpReadonlyUser]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  return rows.map(([key, value]) => `${key}=${quote(String(value))}`).join("\n") + "\n";
}

export async function loadConfig(stateDir) {
  const envPath = join(stateDir, ".env");
  if (!existsSync(envPath)) return null;
  return parseEnvFile(await readFile(envPath, "utf8"));
}

export async function saveConfig(stateDir, config) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(join(stateDir, ".env"), serializeEnvFile(config), { mode: 0o600 });
}

export async function loadOrCreateConfig(stateDir, overrides = {}) {
  const existing = await loadConfig(stateDir);
  if (existing) return { config: existing, created: false };
  const config = createDefaultConfig(overrides);
  await saveConfig(stateDir, config);
  return { config, created: true };
}

export async function writeRuntimeFiles(stateDir, files) {
  await mkdir(join(stateDir, "mcp"), { recursive: true });
  await mkdir(join(stateDir, "logs"), { recursive: true });
  await mkdir(join(stateDir, "samples"), { recursive: true });
  await writeFile(join(stateDir, "docker-compose.yml"), files.compose, "utf8");
  await writeFile(join(stateDir, "mcp", "settings.json"), JSON.stringify(files.mcpSettings, null, 2) + "\n", "utf8");
  await writeFile(join(stateDir, "manifest.json"), JSON.stringify(files.manifest, null, 2) + "\n", "utf8");
}

function quote(value) {
  return JSON.stringify(value);
}

function unquote(value) {
  if (!value) return "";
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
