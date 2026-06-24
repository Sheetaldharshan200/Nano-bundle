import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { COMMANDS, RESET_CONFIRMATION } from "./constants.js";
import { enableAutostart, disableAutostart, autostartStatus } from "./autostart.js";
import { installClientConfig, clientConfigStatus } from "./client-config.js";
import { doctor as runDoctor } from "./doctor.js";
import { defaultStateDir, loadConfig, loadOrCreateConfig, parseEnvFile, saveConfig, writeRuntimeFiles } from "./config.js";
import { assertDockerAvailable, assertPortsAvailable, dockerCompose, hasRenderedStack } from "./docker.js";
import { Logger } from "./logger.js";
import { loadBundledManifest, validateManifest } from "./manifest.js";
import { promptForConfig, waitForCompletionInput } from "./prompt.js";
import { runSmokeTests, waitForRuntime } from "./readiness.js";
import { renderCompose, renderFirstPrompt, renderMcpClientConfig, renderMcpSettings, renderReadyOutput } from "./render.js";

export async function main(argv = [], env = process.env) {
  const parsed = parseArgs(argv);
  const command = parsed.command || "help";
  if (command === "help" || parsed.flags.help) return printHelp();
  if (!COMMANDS.includes(command)) throw new Error(`Unknown command: ${command}`);

  const logger = new Logger({ verbose: Boolean(parsed.flags.verbose), quiet: Boolean(parsed.flags.quiet) });
  const stateDir = parsed.flags.home || defaultStateDir(env);
  const manifest = validateManifest(await loadBundledManifest(parsed.flags.channel || "stable"));

  switch (command) {
    case "start":
      return start(stateDir, manifest, parsed.flags, logger);
    case "configure":
      return configure(stateDir, manifest, parsed.flags, logger);
    case "print-mcp-config":
      return printMcpConfig(stateDir, logger);
    case "install-client-config":
      return installClientConfiguration(stateDir, parsed.flags, logger);
    case "autostart":
      return autostartCommand(stateDir, parsed.args[1] || "status", parsed.flags, logger);
    case "doctor":
      return doctorCommand(stateDir, logger);
    case "status":
      return status(stateDir, logger);
    case "stop":
      return composeCommand(stateDir, ["stop"], "Stack stopped. Data is preserved.", logger);
    case "logs":
      return composeCommand(stateDir, ["logs", "--tail", parsed.flags.tail || "200"], null, logger, { stdio: "inherit" });
    case "reset":
      return reset(stateDir, parsed.flags, logger);
    case "smoke-test":
      return smokeTest(stateDir, parsed.flags, logger);
    case "update":
      return update(stateDir, manifest, parsed.flags, logger);
    case "rollback":
      return rollback(stateDir, parsed.flags, logger);
  }
}

async function start(stateDir, manifest, flags, logger) {
  const { config, created } = await ensureConfig(stateDir, manifest, flags);
  const effectiveManifest = effectiveManifestForConfig(manifest, config);
  await renderRuntime(stateDir, config, effectiveManifest);

  if (flags["render-only"] || flags["no-docker"]) {
    logger.info(`Rendered runtime files in ${stateDir}`);
    logger.info(created ? "Created .env with generated defaults." : "Reused existing .env.");
    logger.info("Docker was not started because --render-only or --no-docker was used.");
    logger.info(renderReadyOutput(config));
    return;
  }

  await preflight(config, effectiveManifest, logger, { checkPorts: created || Boolean(flags["check-ports"]) });
  logger.info(created
    ? "First run can take several minutes because Docker images may need to download and Exasol Nano must initialize."
    : "Starting or reusing the existing local stack. This is usually faster after the first successful run.");
  logger.step("Starting Docker Compose stack");
  logger.info("If Docker was pruned recently, this step downloads the Nano, JSON bootstrap, and MCP images again.");
  const result = await dockerCompose(stateDir, ["up", "-d"], { stdio: "inherit" });
  if (result.code !== 0) throw new Error("docker compose up failed");
  await waitForRuntime(stateDir, config, effectiveManifest, logger);
  logger.step("Running SQL and MCP smoke tests");
  await runSmokeTests(stateDir, config, effectiveManifest, logger);
  logger.info(renderReadyOutput(config));
  const answer = await waitForCompletionInput({ nonInteractive: Boolean(flags.yes || flags["no-wait"] || flags["non-interactive"]) });
  logger.info(answer === "completed" ? "Completed. Stack remains running." : "Exited launcher. Stack remains running. Use `exasol-json-mcp stop` to stop it.");
}

async function configure(stateDir, manifest, flags, logger) {
  const existing = await loadConfig(stateDir);
  const config = await promptForConfig({
    existing: existing || {},
    manifest,
    stateDir,
    nonInteractive: Boolean(flags.yes || flags["non-interactive"])
  });
  await saveConfig(stateDir, config);
  await renderRuntime(stateDir, config, effectiveManifestForConfig(manifest, config));
  logger.info(`${existing ? "Refreshed" : "Created"} configuration in ${stateDir}`);
  logger.info("Run `exasol-json-mcp start` to start the stack.");
}

async function ensureConfig(stateDir, manifest, flags) {
  const existing = await loadConfig(stateDir);
  if (existing) return { config: existing, created: false };
  if (flags.yes || flags["non-interactive"] || flags["render-only"] || flags["no-docker"]) {
    return loadOrCreateConfig(stateDir, { exasolNanoImage: manifest.versions.exasolNanoImage });
  }
  const config = await promptForConfig({ manifest, stateDir });
  await saveConfig(stateDir, config);
  return { config, created: true };
}

async function renderRuntime(stateDir, config, manifest) {
  await writeRuntimeFiles(stateDir, {
    compose: renderCompose(config, manifest),
    mcpSettings: renderMcpSettings(config),
    manifest
  });
}

async function preflight(config, manifest, logger, { checkPorts = false } = {}) {
  logger.step("Checking Docker and Compose");
  const versions = await assertDockerAvailable(manifest.minimums);
  logger.debug(`Docker ${versions.dockerVersion}, Compose ${versions.composeVersion}`);
  if (checkPorts) {
    logger.step("Checking localhost ports");
    await assertPortsAvailable([
      { host: config.sqlHost, port: config.sqlPort, label: "Exasol SQL" },
      { host: config.mcpHost, port: config.mcpPort, label: "MCP HTTP" }
    ]);
  }
}

async function printMcpConfig(stateDir, logger) {
  const config = await readConfig(stateDir);
  logger.info(`MCP Server URL:\n  http://localhost:${config.mcpPort}/mcp\n`);
  logger.info("AI client MCP config:");
  logger.info(renderMcpClientConfig(config));
  logger.info("\nFirst prompt:");
  logger.info(renderFirstPrompt(config));
}

async function installClientConfiguration(stateDir, flags, logger) {
  const config = await readConfig(stateDir);
  const client = flags.client || "claude";
  if (flags.status) {
    const status = await clientConfigStatus(config, { client });
    logger.info(`${client} config: ${status.installed ? "installed" : "not installed"}`);
    logger.info(`Path: ${status.path}`);
    return;
  }
  const result = await installClientConfig(config, { client, dryRun: Boolean(flags["dry-run"]) });
  logger.info(flags["dry-run"] ? `${client} config dry run:` : `${client} config installed:`);
  logger.info(`Path: ${result.path}`);
  logger.info("Restart the AI client if it was already open.");
}

async function autostartCommand(stateDir, action, flags, logger) {
  if (!["enable", "disable", "status"].includes(action)) {
    throw new Error("Usage: exasol-json-mcp autostart <enable|disable|status>");
  }
  if (action === "enable" && !existsSync(join(stateDir, ".env"))) {
    throw new Error("Run `exasol-json-mcp start` once before enabling autostart.");
  }
  if (action === "enable") {
    const { plan } = await enableAutostart(stateDir, { dryRun: Boolean(flags["dry-run"]) });
    logger.info(flags["dry-run"] ? "Autostart dry run:" : "Autostart enabled.");
    logger.info(`Command: ${plan.command}`);
    if (plan.scriptPath) logger.info(`Script: ${plan.scriptPath}`);
    if (plan.servicePath) logger.info(`Service: ${plan.servicePath}`);
    return;
  }
  if (action === "disable") {
    await disableAutostart(stateDir, { dryRun: Boolean(flags["dry-run"]) });
    logger.info(flags["dry-run"] ? "Autostart disable dry run complete." : "Autostart disabled.");
    return;
  }
  const status = await autostartStatus(stateDir, { dryRun: Boolean(flags["dry-run"]) });
  logger.info(`Autostart: ${status.installed ? "installed" : "not installed"}`);
  logger.info(`Command: ${status.plan.command}`);
  if (status.plan.scriptPath) logger.info(`Script: ${status.plan.scriptPath}`);
  if (status.plan.servicePath) logger.info(`Service: ${status.plan.servicePath}`);
}

async function doctorCommand(stateDir, logger) {
  const config = await loadConfig(stateDir);
  await runDoctor(stateDir, config, logger);
}

async function status(stateDir, logger) {
  const configExists = existsSync(join(stateDir, ".env"));
  const stackRendered = hasRenderedStack(stateDir);
  logger.info(`State directory: ${stateDir}`);
  logger.info(`Configuration: ${configExists ? "present" : "missing"}`);
  logger.info(`Rendered stack: ${stackRendered ? "present" : "missing"}`);
  if (configExists) {
    const config = await readConfig(stateDir);
    logger.info(`Exasol SQL: ${config.sqlHost}:${config.sqlPort}`);
    logger.info(`MCP Server: http://localhost:${config.mcpPort}/mcp`);
    logger.info(`Dataset: ANALYTICS.${config.datasetName.toUpperCase()}`);
  }
  if (existsSync(join(stateDir, "manifest.json"))) {
    const manifest = await readManifest(stateDir);
    logger.info(`Manifest channel: ${manifest.channel}`);
    logger.info(`Exasol Nano image: ${manifest.versions.exasolNanoImage}`);
    logger.info(`JSON bootstrap image: ${manifest.versions.jsonBootstrapImage}`);
    logger.info(`MCP Server image: ${manifest.versions.mcpServerImage}`);
  }
  if (stackRendered) {
    const result = await dockerCompose(stateDir, ["ps", "--all"], { stdio: "pipe" }).catch(() => null);
    if (result?.code === 0 && result.stdout.trim()) logger.info(`\n${result.stdout.trim()}`);
  }
  logger.info(stackRendered ? "Next: exasol-json-mcp start" : "Next: exasol-json-mcp configure");
}

async function composeCommand(stateDir, args, successMessage, logger, options = {}) {
  if (!hasRenderedStack(stateDir)) throw new Error(`No rendered stack in ${stateDir}. Run configure or start first.`);
  await assertDockerAvailable();
  const result = await dockerCompose(stateDir, args, options);
  if (result.code !== 0) throw new Error(`docker compose ${args.join(" ")} failed`);
  if (successMessage) logger.info(successMessage);
}

async function reset(stateDir, flags, logger) {
  if (flags.confirm !== RESET_CONFIRMATION) {
    throw new Error(`Reset is destructive. Re-run with --confirm=${RESET_CONFIRMATION} to remove containers and volumes.`);
  }
  await composeCommand(stateDir, ["down", "--volumes"], "Stack containers and volumes removed.", logger);
}

async function smokeTest(stateDir, flags, logger) {
  if (!hasRenderedStack(stateDir)) throw new Error(`No rendered stack in ${stateDir}. Run configure or start first.`);
  const config = await readConfig(stateDir);
  const manifest = await readManifest(stateDir);
  if (flags["static-only"]) {
    logger.info("Static smoke test passed: rendered Compose, MCP settings, and manifest are present.");
    return;
  }
  await runSmokeTests(stateDir, config, manifest, logger);
}

async function update(stateDir, targetManifest, flags, logger) {
  const config = await readConfig(stateDir).catch(() => null);
  if (!config) throw new Error(`No .env in ${stateDir}. Run configure or start first.`);
  const currentPath = join(stateDir, "manifest.json");
  const previousPath = join(stateDir, "previous-manifest.json");
  if (existsSync(currentPath)) await copyFile(currentPath, previousPath);

  const target = effectiveManifestForConfig(targetManifest, config);
  logger.info("Current versions:");
  if (existsSync(currentPath)) logger.info(JSON.stringify((await readManifest(stateDir)).versions, null, 2));
  logger.info("Target versions:");
  logger.info(JSON.stringify(target.versions, null, 2));

  if (!flags.yes && !flags["non-interactive"] && !(await confirm("Apply this update?"))) {
    logger.info("Update cancelled.");
    return;
  }

  await writeFile(currentPath, JSON.stringify(target, null, 2) + "\n", "utf8");
  await renderRuntime(stateDir, config, target);

  if (flags["no-docker"]) {
    logger.info("Manifest updated without Docker actions.");
    return;
  }

  await preflight(config, target, logger);
  const pull = await dockerCompose(stateDir, ["pull"], { stdio: "inherit" });
  if (pull.code !== 0) throw new Error("docker compose pull failed");
  const up = await dockerCompose(stateDir, ["up", "-d"], { stdio: "inherit" });
  if (up.code !== 0) throw new Error("docker compose up failed after update");
  try {
    await waitForRuntime(stateDir, config, target, logger);
    await runSmokeTests(stateDir, config, target, logger);
    logger.info("Update completed and smoke tests passed.");
  } catch (error) {
    logger.error(`${error.message}\nRun exasol-json-mcp rollback to restore the previous manifest.`);
    throw error;
  }
}

async function rollback(stateDir, flags, logger) {
  const activePath = join(stateDir, "manifest.json");
  const previousPath = join(stateDir, "previous-manifest.json");
  if (!existsSync(previousPath)) throw new Error("No previous manifest is available for rollback.");
  if (existsSync(activePath)) await copyFile(activePath, join(stateDir, "failed-manifest.json"));
  await copyFile(previousPath, activePath);
  const config = await readConfig(stateDir);
  const manifest = await readManifest(stateDir);
  await renderRuntime(stateDir, config, manifest);

  if (flags["no-docker"]) {
    logger.info("Rolled back manifest without Docker actions.");
    return;
  }

  await preflight(config, manifest, logger);
  const pull = await dockerCompose(stateDir, ["pull"], { stdio: "inherit" });
  if (pull.code !== 0) throw new Error("docker compose pull failed during rollback");
  const up = await dockerCompose(stateDir, ["up", "-d"], { stdio: "inherit" });
  if (up.code !== 0) throw new Error("docker compose up failed during rollback");
  await waitForRuntime(stateDir, config, manifest, logger);
  await runSmokeTests(stateDir, config, manifest, logger);
  logger.info("Rollback completed and smoke tests passed.");
}

async function readConfig(stateDir) {
  if (!existsSync(join(stateDir, ".env"))) throw new Error(`No .env in ${stateDir}. Run configure or start first.`);
  return parseEnvFile(await readFile(join(stateDir, ".env"), "utf8"));
}

async function readManifest(stateDir) {
  const manifestPath = join(stateDir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`No manifest.json in ${stateDir}. Run configure or start first.`);
  return validateManifest(JSON.parse(await readFile(manifestPath, "utf8")));
}

function effectiveManifestForConfig(manifest, config) {
  if (!config.exasolNanoImage) return manifest;
  return validateManifest({
    ...manifest,
    versions: {
      ...manifest.versions,
      exasolNanoImage: config.exasolNanoImage
    }
  });
}

async function confirm(question) {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=", 2);
      flags[key] = value ?? true;
    } else {
      positionals.push(arg);
    }
  }
  return { command: positionals[0], args: positionals, flags };
}

function printHelp() {
  console.log(`exasol-json-mcp <command> [options]\n\nCommands:\n  ${COMMANDS.join("\n  ")}\n\nOptions:\n  --home=<path>       Override local state directory\n  --channel=stable    Select bundled manifest channel\n  --yes               Use defaults and skip confirmations where safe\n  --no-docker         Render/configure/update without Docker actions\n  --render-only       Alias for start-time rendering only\n  --no-wait           Do not wait for completed/exit after start\n  --static-only       For smoke-test, validate rendered files only\n  --client=claude     Select AI client for install-client-config\n  --dry-run           Show planned client/autostart changes without writing\n  --verbose           Print diagnostic details\n`);
}
