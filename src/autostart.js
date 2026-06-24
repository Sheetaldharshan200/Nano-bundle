import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { run } from "./docker.js";

const TASK_NAME = "ExasolJsonMcp";
const PLIST_ID = "com.sheetaldharshan.exasol-json-mcp";

export function autostartPlan(stateDir, { platform = process.platform, env = process.env } = {}) {
  const homeDir = resolve(stateDir);
  const command = `npx -y @sheetaldharshan/exasol-json-mcp@latest start --home=${shellQuote(homeDir, platform)} --yes --no-wait`;
  if (platform === "win32") {
    const scriptPath = join(homeDir, "autostart", "start-exasol-json-mcp.ps1");
    const taskRun = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptPath}"`;
    return {
      platform,
      command,
      scriptPath,
      servicePath: null,
      installCommand: ["schtasks", ["/Create", "/TN", TASK_NAME, "/SC", "ONLOGON", "/TR", taskRun, "/F"]],
      uninstallCommand: ["schtasks", ["/Delete", "/TN", TASK_NAME, "/F"]],
      statusCommand: ["schtasks", ["/Query", "/TN", TASK_NAME]],
      scriptContents: `$ErrorActionPreference = 'Stop'\n${command}\n`
    };
  }
  if (platform === "darwin") {
    const servicePath = join(homedir(), "Library", "LaunchAgents", `${PLIST_ID}.plist`);
    return {
      platform,
      command,
      scriptPath: null,
      servicePath,
      installCommand: ["launchctl", ["load", "-w", servicePath]],
      uninstallCommand: ["launchctl", ["unload", "-w", servicePath]],
      statusCommand: ["launchctl", ["list", PLIST_ID]],
      serviceContents: renderLaunchAgent(command, homeDir)
    };
  }
  const systemdHome = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const servicePath = join(systemdHome, "systemd", "user", "exasol-json-mcp.service");
  return {
    platform,
    command,
    scriptPath: null,
    servicePath,
    installCommand: ["systemctl", ["--user", "enable", "--now", "exasol-json-mcp.service"]],
    uninstallCommand: ["systemctl", ["--user", "disable", "--now", "exasol-json-mcp.service"]],
    statusCommand: ["systemctl", ["--user", "status", "exasol-json-mcp.service", "--no-pager"]],
    serviceContents: renderSystemdService(command)
  };
}

export async function enableAutostart(stateDir, options = {}) {
  const plan = autostartPlan(stateDir, options);
  if (plan.scriptPath) {
    await mkdir(dirname(plan.scriptPath), { recursive: true });
    await writeFile(plan.scriptPath, plan.scriptContents, "utf8");
  }
  if (plan.servicePath) {
    await mkdir(dirname(plan.servicePath), { recursive: true });
    await writeFile(plan.servicePath, plan.serviceContents, "utf8");
  }
  if (options.dryRun) return { plan, result: { code: 0, stdout: "dry run", stderr: "" } };
  const [command, args] = plan.installCommand;
  const result = await run(command, args);
  if (result.code !== 0) throw new Error(`autostart enable failed: ${result.stderr || result.stdout}`.trim());
  return { plan, result };
}

export async function disableAutostart(stateDir, options = {}) {
  const plan = autostartPlan(stateDir, options);
  if (!options.dryRun) {
    const [command, args] = plan.uninstallCommand;
    const result = await run(command, args);
    if (result.code !== 0 && !isMissingAutostartEntry(result.stderr || result.stdout)) {
      throw new Error(`autostart disable failed: ${result.stderr || result.stdout}`.trim());
    }
  }
  if (plan.scriptPath && existsSync(plan.scriptPath)) await rm(plan.scriptPath, { force: true });
  if (plan.servicePath && existsSync(plan.servicePath)) await rm(plan.servicePath, { force: true });
  return { plan };
}

export async function autostartStatus(stateDir, options = {}) {
  const plan = autostartPlan(stateDir, options);
  if (options.dryRun) return { plan, installed: false, stdout: "dry run" };
  const [command, args] = plan.statusCommand;
  const result = await run(command, args);
  return {
    plan,
    installed: result.code === 0,
    stdout: result.stdout || result.stderr
  };
}

function renderSystemdService(command) {
  return `[Unit]\nDescription=Exasol JSON MCP local stack\nAfter=default.target\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/bin/sh -lc ${systemdQuote(command)}\n\n[Install]\nWantedBy=default.target\n`;
}

function renderLaunchAgent(command, stateDir) {
  const logPath = join(stateDir, "logs", "autostart.log");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>Label</key>\n  <string>${PLIST_ID}</string>\n  <key>ProgramArguments</key>\n  <array>\n    <string>/bin/zsh</string>\n    <string>-lc</string>\n    <string>${escapeXml(command)}</string>\n  </array>\n  <key>RunAtLoad</key>\n  <true/>\n  <key>StandardOutPath</key>\n  <string>${escapeXml(logPath)}</string>\n  <key>StandardErrorPath</key>\n  <string>${escapeXml(logPath)}</string>\n</dict>\n</plist>\n`;
}

function shellQuote(value, platform = process.platform) {
  if (platform === "win32") return `"${String(value).replaceAll('"', '\\"')}"`;
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function systemdQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function isMissingAutostartEntry(output) {
  const text = String(output).toLowerCase();
  return text.includes("not found")
    || text.includes("cannot find")
    || text.includes("does not exist")
    || text.includes("no such");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}