import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { loadReleaseEnv, releaseEnvConfig, requireDockerNamespace } from "./release-env.js";

export async function setImageNamespace(options = {}) {
  const envConfig = releaseEnvConfig();
  const cleanOptions = typeof options === "string" ? { dockerNamespace: options } : removeUndefined(options);
  const config = {
    ...envConfig,
    ...cleanOptions,
    dockerNamespace: cleanOptions.namespace || cleanOptions.dockerNamespace || envConfig.dockerNamespace
  };
  requireDockerNamespace(config);

  const files = ["manifests/stable.json", "manifests/candidate.json", "manifests/dev.json"];
  const tags = {
    "stable.json": {
      jsonBootstrap: config.jsonBootstrapTag || "0.1.0",
      mcpServer: config.mcpServerTag || "0.1.0"
    },
    "candidate.json": {
      jsonBootstrap: `${config.jsonBootstrapTag || "0.1.0"}-candidate`,
      mcpServer: `${config.mcpServerTag || "0.1.0"}-candidate`
    },
    "dev.json": {
      jsonBootstrap: `${config.jsonBootstrapTag || "0.1.0"}-dev`,
      mcpServer: `${config.mcpServerTag || "0.1.0"}-dev`
    }
  };

  for (const file of files) {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    const tag = tags[basename(file)];
    manifest.versions.jsonBootstrapImage = `${config.dockerRegistry}/${config.dockerNamespace}/${config.jsonBootstrapImageName}:${tag.jsonBootstrap}`;
    manifest.versions.mcpServerImage = `${config.dockerRegistry}/${config.dockerNamespace}/${config.mcpServerImageName}:${tag.mcpServer}`;
    await writeFile(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`updated ${file}`);
  }
}

function removeUndefined(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
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
  await loadReleaseEnv().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
  if (!process.exitCode) {
    const { flags, positionals } = parseArgs(process.argv.slice(2));
    setImageNamespace({
      namespace: flags.namespace || positionals[0],
      dockerRegistry: flags.registry || process.env.DOCKER_REGISTRY || "docker.io",
      jsonBootstrapTag: flags["json-bootstrap-tag"],
      mcpServerTag: flags["mcp-server-tag"]
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  }
}