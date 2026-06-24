import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { validateManifest } from "../src/manifest.js";

export async function validateBundledManifests() {
  const files = (await readdir("manifests")).filter((name) => name.endsWith(".json")).sort();
  let checked = 0;
  for (const file of files) {
    const manifest = JSON.parse(await readFile(join("manifests", file), "utf8"));
    validateManifest(manifest);
    checked += 1;
    console.log(`valid - ${file}`);
  }
  console.log(`${checked} manifest(s) valid.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateBundledManifests().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
