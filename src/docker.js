import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.stdio || "pipe", cwd: options.cwd, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export async function dockerCompose(stateDir, args, options = {}) {
  return run("docker", ["compose", "--project-directory", stateDir, ...args], options);
}

export async function assertDockerAvailable(minimums = {}) {
  const docker = await safeRun("docker", ["--version"]);
  if (docker.error || docker.code !== 0) throw new Error("Docker is not available. Install Docker Desktop or ensure docker is on PATH.");

  const compose = await safeRun("docker", ["compose", "version"]);
  if (compose.error || compose.code !== 0) throw new Error("Docker Compose v2 is not available. Install or enable Docker Compose v2.");

  const info = await safeRun("docker", ["info", "--format", "{{json .ServerVersion}}"]);
  if (info.code !== 0) throw new Error("Docker is installed but the daemon is not reachable. Start Docker Desktop or the Docker service.");

  const dockerVersion = firstVersion(docker.stdout);
  const composeVersion = firstVersion(compose.stdout);
  if (minimums.docker && compareVersions(dockerVersion, minimums.docker) < 0) {
    throw new Error(`Docker ${minimums.docker} or newer is required. Found ${dockerVersion}.`);
  }
  if (minimums.compose && compareVersions(composeVersion, minimums.compose) < 0) {
    throw new Error(`Docker Compose ${minimums.compose} or newer is required. Found ${composeVersion}.`);
  }
  return { dockerVersion, composeVersion };
}

export async function assertPortsAvailable(bindings) {
  for (const { host, port, label } of bindings) {
    await assertPortAvailable(host, Number(port), label);
  }
}

export function hasRenderedStack(stateDir) {
  return existsSync(join(stateDir, "docker-compose.yml"));
}

export async function composePs(stateDir) {
  const result = await dockerCompose(stateDir, ["ps", "--all", "--format", "json"]);
  if (result.code !== 0) throw new Error(`docker compose ps failed: ${result.stderr.trim()}`);
  return parseComposeJson(result.stdout);
}

export async function composeLogsTail(stateDir, services = [], lines = "80") {
  const result = await dockerCompose(stateDir, ["logs", "--tail", String(lines), ...services]);
  return result.stdout || result.stderr;
}

async function safeRun(command, args) {
  try {
    return await run(command, args);
  } catch (error) {
    return { code: -1, stdout: "", stderr: String(error), error };
  }
}

function assertPortAvailable(host, port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") reject(new Error(`${label} port ${host}:${port} is already in use. Re-run configure with a different port.`));
      else reject(error);
    });
    server.once("listening", () => server.close(resolve));
    server.listen(port, host);
  });
}

function parseComposeJson(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
}

function firstVersion(text) {
  return text.match(/\d+\.\d+\.\d+/)?.[0] || "0.0.0";
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}
