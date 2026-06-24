export async function loadReleaseEnv({ path = process.env.RELEASE_ENV_FILE || "release.env", required = false } = {}) {
  let source;
  try {
    source = await import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && !required) return { path, loaded: false };
    throw error;
  }

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals <= 0) continue;
    const key = trimmed.slice(0, equals).trim();
    const value = unquote(trimmed.slice(equals + 1).trim());
    if (!process.env[key]) process.env[key] = value;
  }
  return { path, loaded: true };
}

export function releaseEnvConfig(env = process.env) {
  return {
    dockerRegistry: env.DOCKER_REGISTRY || "docker.io",
    dockerNamespace: env.DOCKER_IMAGE_NAMESPACE || env.DOCKERHUB_NAMESPACE || env.DOCKER_ORG || env.ORG_NAME,
    jsonBootstrapImageName: env.JSON_BOOTSTRAP_IMAGE_NAME || "exasol-json-bootstrap",
    mcpServerImageName: env.MCP_SERVER_IMAGE_NAME || "exasol-mcp-server",
    jsonBootstrapTag: env.JSON_BOOTSTRAP_TAG || env.IMAGE_TAG,
    mcpServerTag: env.MCP_SERVER_TAG || env.IMAGE_TAG,
    npmPackageName: env.NPM_PACKAGE_NAME || "@sheetaldharshan/exasol-json-mcp"
  };
}

export function requireDockerNamespace(config) {
  if (!config.dockerNamespace || !/^[a-z0-9][a-z0-9_.-]{2,}$/.test(config.dockerNamespace)) {
    throw new Error("Set DOCKER_IMAGE_NAMESPACE in release.env, or pass the Docker Hub namespace as the first argument.");
  }
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}