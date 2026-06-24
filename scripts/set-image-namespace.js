import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export async function setImageNamespace(namespace) {
  if (!namespace || !/^[a-z0-9][a-z0-9_.-]{2,}$/.test(namespace)) {
    throw new Error("Usage: node scripts/set-image-namespace.js <dockerhub-username>");
  }

  const files = ["manifests/stable.json", "manifests/candidate.json", "manifests/dev.json"];
  const tags = {
    "stable.json": "0.1.0",
    "candidate.json": "0.1.0-candidate",
    "dev.json": "0.1.0-dev"
  };

  for (const file of files) {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    const tag = tags[basename(file)];
    manifest.versions.jsonBootstrapImage = `docker.io/${namespace}/exasol-json-bootstrap:${tag}`;
    manifest.versions.mcpServerImage = `docker.io/${namespace}/exasol-mcp-server:${tag}`;
    await writeFile(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`updated ${file}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setImageNamespace(process.argv[2]).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
