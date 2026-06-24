import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function buildImages({ namespace, version = "0.1.0", push = false } = {}) {
  if (!namespace || !/^[a-z0-9][a-z0-9_.-]{2,}$/.test(namespace)) {
    throw new Error("Usage: node scripts/build-images.js <dockerhub-username> [tag] [--push]");
  }

  const images = [
    { name: "exasol-json-bootstrap", context: "docker/json-bootstrap" },
    { name: "exasol-mcp-server", context: "docker/mcp-server" }
  ];

  for (const image of images) {
    const ref = `docker.io/${namespace}/${image.name}:${version}`;
    run("docker", ["build", "-t", ref, image.context]);
    if (push) run("docker", ["push", ref]);
  }
}

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    buildImages({
      namespace: process.argv[2] || process.env.DOCKERHUB_USERNAME,
      version: process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : process.env.IMAGE_TAG || "0.1.0",
      push: process.argv.includes("--push")
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
