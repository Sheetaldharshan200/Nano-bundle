import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { loadReleaseEnv, releaseEnvConfig, requireDockerNamespace } from "./release-env.js";

export function buildImages({ namespace, registry, jsonBootstrapTag, mcpServerTag, imageTag, push = false } = {}) {
  const envConfig = releaseEnvConfig();
  const config = {
    ...envConfig,
    dockerRegistry: registry || envConfig.dockerRegistry,
    dockerNamespace: namespace || envConfig.dockerNamespace,
    jsonBootstrapTag: jsonBootstrapTag || imageTag || envConfig.jsonBootstrapTag || "0.1.0",
    mcpServerTag: mcpServerTag || imageTag || envConfig.mcpServerTag || "0.1.0"
  };
  requireDockerNamespace(config);

  const images = [
    { name: config.jsonBootstrapImageName, context: "docker/json-bootstrap", tag: config.jsonBootstrapTag },
    { name: config.mcpServerImageName, context: "docker/mcp-server", tag: config.mcpServerTag }
  ];

  for (const image of images) {
    const ref = `${config.dockerRegistry}/${config.dockerNamespace}/${image.name}:${image.tag}`;
    run("docker", ["build", "-t", ref, image.context]);
    if (push) run("docker", ["push", ref]);
  }
}

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
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
  return { flags, positionals };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await loadReleaseEnv();
    const { flags, positionals } = parseArgs(process.argv.slice(2));
    buildImages({
      namespace: flags.namespace || positionals[0],
      imageTag: flags.tag || (positionals[1] && !String(positionals[1]).startsWith("--") ? positionals[1] : undefined),
      jsonBootstrapTag: flags["json-bootstrap-tag"],
      mcpServerTag: flags["mcp-server-tag"],
      registry: flags.registry,
      push: Boolean(flags.push || process.argv.includes("--push"))
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}