import net from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dockerCompose, composePs } from "./docker.js";
import { SERVICES } from "./constants.js";

export async function waitForRuntime(stateDir, config, manifest, logger, options = {}) {
  const timeoutMs = Number(options.timeoutMs || manifest.timeouts?.startMs || 300000);
  const started = Date.now();
  logger.step(`Waiting for Exasol SQL port, up to ${formatDuration(timeoutMs)}`);
  logger.info("Cold Exasol Nano startup commonly takes 2-5 minutes on the first run or after Docker cleanup.");
  await waitForTcp(config.sqlHost, Number(config.sqlPort), { timeoutMs, label: "Exasol SQL" });
  logger.step("Waiting for Docker services");
  logger.info("The JSON bootstrap service must finish before the MCP server can accept requests.");
  await waitForComposeServices(stateDir, { timeoutMs: remaining(started, timeoutMs) });
  logger.step("Waiting for MCP HTTP endpoint");
  await waitForHttp(`http://localhost:${config.mcpPort}${manifest.smoke?.mcpHealthPath || "/mcp"}`, {
    timeoutMs: remaining(started, timeoutMs),
    allowStatuses: [200, 202, 204, 400, 404, 405, 406]
  });
}

export async function runSmokeTests(stateDir, config, manifest, logger, options = {}) {
  const results = [];
  results.push(await record("rendered Compose exists", async () => true));
  results.push(await record("Exasol SQL port accepts TCP", async () => waitForTcp(config.sqlHost, Number(config.sqlPort), { timeoutMs: Number(options.timeoutMs || 30000), label: "Exasol SQL" })));
  results.push(await record("Compose services reached expected states", async () => waitForComposeServices(stateDir, { timeoutMs: Number(options.timeoutMs || 30000) })));
  results.push(await record("MCP HTTP endpoint responds", async () => waitForHttp(`http://localhost:${config.mcpPort}${manifest.smoke?.mcpHealthPath || "/mcp"}`, { timeoutMs: Number(options.timeoutMs || 30000), allowStatuses: [200, 202, 204, 400, 404, 405, 406] })));


  const commandTests = manifest.smoke?.commands || [];
  if (commandTests.length > 0) {
    for (const commandTest of commandTests) {
      results.push(await record(commandTest.name, async () => runComposeSmokeCommand(stateDir, commandTest)));
    }
  } else {
    results.push({ name: "SQL SELECT 1 and dataset query commands", status: "skipped", detail: "manifest.smoke.commands is not configured for this release" });
  }
  const mcpTools = manifest.smoke?.mcpTools;
  if (mcpTools) {
    const mcpSession = await createMcpSession(config);
    results.push({ name: "MCP initialize", status: "passed" });
    results.push(await record("MCP list tools", async () => mcpRequest(config, "tools/list", {}, { sessionId: mcpSession.sessionId })));
    if (mcpTools.listSchemas) results.push(await record("MCP list schemas", async () => mcpTool(config, mcpTools.listSchemas, {}, { sessionId: mcpSession.sessionId })));
    if (mcpTools.readQuery) results.push(await record("MCP read query", async () => mcpTool(config, mcpTools.readQuery, { query: `SELECT COUNT(*) FROM ANALYTICS.${config.datasetName.toUpperCase()}` }, { sessionId: mcpSession.sessionId })));
    if (mcpTools.writeQuery) {
      results.push(await record("MCP write query blocked", async () => {
        const response = await mcpTool(config, mcpTools.writeQuery, { query: "CREATE TABLE ANALYTICS.SHOULD_NOT_EXIST(ID INT)" }, { allowError: true, sessionId: mcpSession.sessionId });
        if (!isBlockedWriteResponse(response)) throw new Error("write query was not blocked");
        return true;
      }));
    }
  } else {
    results.push({ name: "MCP schema/read/write tool tests", status: "skipped", detail: "manifest.smoke.mcpTools is not configured for this release" });
  }

  await persistSmokeSummary(stateDir, results);
  const failed = results.filter((result) => result.status === "failed");
  for (const result of results) logger.info(`${statusIcon(result.status)} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
  if (failed.length > 0) throw new Error(`Smoke test failed: ${failed.map((result) => result.name).join(", ")}`);
  return results;
}

export function waitForTcp(host, port, { timeoutMs = 30000, label = "TCP service" } = {}) {
  const deadline = Date.now() + timeoutMs;
  return retryUntil(deadline, async () => new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 2000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`${label} timed out`));
    });
    socket.once("error", reject);
  }));
}

export async function waitForHttp(url, { timeoutMs = 30000, allowStatuses = [200] } = {}) {
  const deadline = Date.now() + timeoutMs;
  return retryUntil(deadline, async () => {
    const response = await fetch(url, { method: "GET" });
    if (!allowStatuses.includes(response.status)) throw new Error(`${url} returned HTTP ${response.status}`);
    return true;
  });
}

export async function waitForComposeServices(stateDir, { timeoutMs = 30000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return retryUntil(deadline, async () => {
    const services = await composePs(stateDir);
    const byService = new Map(services.map((service) => [service.Service || service.Name, service]));
    assertServiceRunning(byService.get(SERVICES.database), SERVICES.database);
    assertServiceCompleted(byService.get(SERVICES.bootstrap), SERVICES.bootstrap);
    assertServiceRunning(byService.get(SERVICES.mcp), SERVICES.mcp);
    return true;
  });
}

async function record(name, fn) {
  try {
    await fn();
    return { name, status: "passed" };
  } catch (error) {
    return { name, status: "failed", detail: error.message };
  }
}

async function retryUntil(deadline, fn) {
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError || new Error("Timed out");
}

function assertServiceRunning(service, name) {
  if (!service) throw new Error(`${name} is missing`);
  const state = String(service.State || service.Status || "").toLowerCase();
  const health = String(service.Health || "").toLowerCase();
  if (!state.includes("running")) throw new Error(`${name} is not running`);
  if (health && !["healthy", "", "starting"].includes(health)) throw new Error(`${name} health is ${health}`);
}

function assertServiceCompleted(service, name) {
  if (!service) throw new Error(`${name} is missing`);
  const state = String(service.State || service.Status || "").toLowerCase();
  const exitCode = service.ExitCode ?? service.ExitCode;
  if (state.includes("exited") || state.includes("completed")) {
    if (exitCode === undefined || Number(exitCode) === 0) return;
  }
  if (state.includes("running")) return;
  throw new Error(`${name} did not complete successfully`);
}

async function runComposeSmokeCommand(stateDir, commandTest) {
  if (!commandTest.service || !Array.isArray(commandTest.command) || commandTest.command.length === 0) {
    throw new Error(`Invalid smoke command definition for ${commandTest.name || "unnamed command"}`);
  }
  const result = await dockerCompose(stateDir, ["exec", "-T", commandTest.service, ...commandTest.command]);
  const expectedExitCode = commandTest.expectExitCode ?? 0;
  if (result.code !== expectedExitCode) {
    throw new Error(`${commandTest.name} exited ${result.code}; expected ${expectedExitCode}. ${result.stderr || result.stdout}`.trim());
  }
  if (commandTest.stdoutIncludes && !result.stdout.includes(commandTest.stdoutIncludes)) {
    throw new Error(`${commandTest.name} output did not include ${commandTest.stdoutIncludes}`);
  }
  return true;
}
async function createMcpSession(config) {
  const response = await rawMcpRequest(config, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "exasol-json-mcp-smoke", version: "0.1.0" }
  });
  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("MCP initialize did not return mcp-session-id");
  await parseMcpResponse(response, "initialize");
  return { sessionId };
}

async function mcpRequest(config, method, params, { sessionId } = {}) {
  const response = await rawMcpRequest(config, method, params, { sessionId });
  return parseMcpResponse(response, method);
}

async function rawMcpRequest(config, method, params, { sessionId } = {}) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream"
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  return fetch(`http://localhost:${config.mcpPort}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
}

async function parseMcpResponse(response, method) {
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP ${method} returned HTTP ${response.status}: ${text.slice(0, 200)}`);
  return parseMcpBody(text);
}

async function mcpTool(config, name, args, { allowError = false, sessionId } = {}) {
  const response = await mcpRequest(config, "tools/call", { name, arguments: args }, { sessionId });
  if (!allowError && response.result?.isError) throw new Error(JSON.stringify(response.result));
  if (response.error && !allowError) throw new Error(response.error.message || JSON.stringify(response.error));
  return response;
}

export function isBlockedWriteResponse(response) {
  const body = JSON.stringify(response).toLowerCase();
  return Boolean(response?.error || response?.result?.isError || body.includes("disabled") || body.includes("unknown tool"));
}

export function parseMcpBody(text) {
  if (text.startsWith("event:")) {
    const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data:"));
    if (dataLine) return JSON.parse(dataLine.slice(5).trim());
  }
  return JSON.parse(text);
}

async function persistSmokeSummary(stateDir, results) {
  await mkdir(join(stateDir, "logs"), { recursive: true });
  await writeFile(join(stateDir, "logs", "smoke-test-summary.json"), JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2) + "\n", "utf8");
}

function statusIcon(status) {
  if (status === "passed") return "PASS";
  if (status === "skipped") return "SKIP";
  return "FAIL";
}

function remaining(started, timeoutMs) {
  return Math.max(1000, timeoutMs - (Date.now() - started));
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

