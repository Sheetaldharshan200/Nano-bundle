import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const tests = [];

globalThis.test = function test(name, fn) {
  tests.push({ name, fn });
};

const files = (await readdir("test")).filter((name) => name.endsWith(".test.js")).sort();
for (const file of files) {
  await import(pathToFileURL(join(process.cwd(), "test", file)));
}

let passed = 0;
let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error?.stack || error);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
