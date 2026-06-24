import { existsSync } from "node:fs";
import { join } from "node:path";
import { run, dockerCompose, hasRenderedStack } from "./docker.js";
import { clientConfigStatus, SUPPORTED_CLIENTS } from "./client-config.js";

export async function doctor(stateDir, config, logger) {
  logger.info("Doctor report");
  logger.info(`State directory: ${stateDir}`);
  logger.info(`Node.js: ${process.version}`);
  await checkCommand(logger, "Docker", "docker", ["--version"]);
  await checkCommand(logger, "Docker Compose", "docker", ["compose", "version"]);
  await checkCommand(logger, "Docker daemon", "docker", ["info", "--format", "{{json .ServerVersion}}"]);

  logger.info(`Configuration: ${existsSync(join(stateDir, ".env")) ? "present" : "missing"}`);
  logger.info(`Rendered stack: ${hasRenderedStack(stateDir) ? "present" : "missing"}`);

  if (config) {
    logger.info(`Exasol SQL: ${config.sqlHost}:${config.sqlPort}`);
    logger.info(`MCP URL: http://localhost:${config.mcpPort}/mcp`);
    await checkMcpEndpoint(config, logger);
    for (const client of SUPPORTED_CLIENTS) {
      const status = await clientConfigStatus(config, { client }).catch((error) => ({ installed: false, path: "unknown", error: error.message }));
      logger.info(`${client} config: ${status.installed ? "installed" : "not installed"} (${status.path})${status.error ? ` - ${status.error}` : ""}`);
    }
  } else {
    logger.info("Next: run `exasol-json-mcp start` once to create configuration.");
  }

  if (hasRenderedStack(stateDir)) {
    const ps = await dockerCompose(stateDir, ["ps", "--all"], { stdio: "pipe" }).catch((error) => ({ code: -1, stdout: "", stderr: error.message }));
    logger.info(ps.code === 0 && ps.stdout.trim() ? `\n${ps.stdout.trim()}` : `Docker Compose status unavailable: ${ps.stderr}`);
  }
}

async function checkCommand(logger, label, command, args) {
  try {
    const result = await run(command, args);
    logger.info(`${label}: ${result.code === 0 ? "ok" : "failed"}${result.stdout.trim() ? ` - ${result.stdout.trim()}` : ""}${result.stderr.trim() ? ` - ${result.stderr.trim()}` : ""}`);
  } catch (error) {
    logger.info(`${label}: failed - ${error.message}`);
  }
}

async function checkMcpEndpoint(config, logger) {
  try {
    const response = await fetch(`http://localhost:${config.mcpPort}/mcp`, { headers: { accept: "application/json, text/event-stream" } });
    logger.info(`MCP HTTP endpoint: responding with HTTP ${response.status}`);
  } catch (error) {
    logger.info(`MCP HTTP endpoint: not reachable - ${error.message}`);
  }
}
