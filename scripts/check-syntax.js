import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

globalThis.test = function noopTest() {};

const skipScripts = new Set(["check-syntax.js", "run-tests.js"]);
const roots = ["bin", "src", "test", "scripts"];
for (const root of roots) {
  const files = await readdir(root);
  for (const file of files.filter((name) => name.endsWith(".js"))) {
    if (root === "scripts" && skipScripts.has(file)) continue;
    await import(pathToFileURL(join(process.cwd(), root, file)));
  }
}
console.log("Syntax/import check passed.");
