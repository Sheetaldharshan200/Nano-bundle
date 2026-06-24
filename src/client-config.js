import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { renderMcpClientConfig } from "./render.js";

export function claudeConfigPath({ platform = process.platform, env = process.env } = {}) {
  if (platform === "win32") return join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "Claude", "claude_desktop_config.json");
}

export async function installClientConfig(config, { client = "claude", platform = process.platform, env = process.env, dryRun = false } = {}) {
  if (client !== "claude") throw new Error(`Unsupported client: ${client}. Supported clients: claude`);
  const path = claudeConfigPath({ platform, env });
  const existing = await readJsonIfExists(path);
  const next = mergeMcpServer(existing, config);
  if (dryRun) return { client, path, config: next, changed: JSON.stringify(existing) !== JSON.stringify(next) };
  await mkdir(dirname(path), { recursive: true });
  if (existsSync(path)) await copyFile(path, `${path}.bak`);
  await writeFile(path, JSON.stringify(next, null, 2) + "\n", "utf8");
  return { client, path, config: next, changed: true };
}

export async function clientConfigStatus(config, { client = "claude", platform = process.platform, env = process.env } = {}) {
  if (client !== "claude") throw new Error(`Unsupported client: ${client}. Supported clients: claude`);
  const path = claudeConfigPath({ platform, env });
  const existing = await readJsonIfExists(path);
  const expected = JSON.parse(renderMcpClientConfig(config)).mcpServers.exasol_nano;
  const actual = existing?.mcpServers?.exasol_nano;
  return { client, path, installed: JSON.stringify(actual) === JSON.stringify(expected), actual, expected };
}

function mergeMcpServer(existing, config) {
  const current = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const rendered = JSON.parse(renderMcpClientConfig(config));
  return {
    ...current,
    mcpServers: {
      ...(current.mcpServers || {}),
      exasol_nano: rendered.mcpServers.exasol_nano
    }
  };
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
