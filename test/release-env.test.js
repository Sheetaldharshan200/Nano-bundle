import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadReleaseEnv, releaseEnvConfig } from "../scripts/release-env.js";
import { setImageNamespace } from "../scripts/set-image-namespace.js";

const minimalManifest = {
  channel: "stable",
  versions: {
    exasolNanoImage: "docker.io/exasol/nano:2025.1.0",
    jsonBootstrapImage: "docker.io/old/exasol-json-bootstrap:old",
    mcpServerImage: "docker.io/old/exasol-mcp-server:old"
  },
  minimums: { docker: "24.0.0", compose: "2.20.0" }
};

test("release env file provides organization, package, and image tags", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-release-env-"));
  const envPath = join(dir, "release.env");
  const previous = {
    DOCKER_IMAGE_NAMESPACE: process.env.DOCKER_IMAGE_NAMESPACE,
    JSON_BOOTSTRAP_TAG: process.env.JSON_BOOTSTRAP_TAG,
    MCP_SERVER_TAG: process.env.MCP_SERVER_TAG,
    NPM_PACKAGE_NAME: process.env.NPM_PACKAGE_NAME
  };
  try {
    delete process.env.DOCKER_IMAGE_NAMESPACE;
    delete process.env.JSON_BOOTSTRAP_TAG;
    delete process.env.MCP_SERVER_TAG;
    delete process.env.NPM_PACKAGE_NAME;
    await writeFile(envPath, "DOCKER_IMAGE_NAMESPACE=my-org\nJSON_BOOTSTRAP_TAG=1.2.3\nMCP_SERVER_TAG=4.5.6\nNPM_PACKAGE_NAME=@my-org/exasol-json-mcp\n", "utf8");
    const loaded = await loadReleaseEnv({ path: envPath });
    const config = releaseEnvConfig();
    assert.equal(loaded.loaded, true);
    assert.equal(config.dockerNamespace, "my-org");
    assert.equal(config.jsonBootstrapTag, "1.2.3");
    assert.equal(config.mcpServerTag, "4.5.6");
    assert.equal(config.npmPackageName, "@my-org/exasol-json-mcp");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("set image namespace uses env-style tags for stable candidate and dev manifests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-manifests-"));
  const previousCwd = process.cwd();
  try {
    await mkdir(join(dir, "manifests"), { recursive: true });
    for (const name of ["stable", "candidate", "dev"]) {
      await writeFile(join(dir, "manifests", `${name}.json`), JSON.stringify({ ...minimalManifest, channel: name }, null, 2), "utf8");
    }
    process.chdir(dir);
    await setImageNamespace({ namespace: "my-org", jsonBootstrapTag: "1.2.3", mcpServerTag: "4.5.6" });
    const stable = JSON.parse(await readFile(join(dir, "manifests", "stable.json"), "utf8"));
    const candidate = JSON.parse(await readFile(join(dir, "manifests", "candidate.json"), "utf8"));
    const dev = JSON.parse(await readFile(join(dir, "manifests", "dev.json"), "utf8"));
    assert.equal(stable.versions.jsonBootstrapImage, "docker.io/my-org/exasol-json-bootstrap:1.2.3");
    assert.equal(stable.versions.mcpServerImage, "docker.io/my-org/exasol-mcp-server:4.5.6");
    assert.equal(candidate.versions.jsonBootstrapImage, "docker.io/my-org/exasol-json-bootstrap:1.2.3-candidate");
    assert.equal(dev.versions.mcpServerImage, "docker.io/my-org/exasol-mcp-server:4.5.6-dev");
  } finally {
    process.chdir(previousCwd);
    await rm(dir, { recursive: true, force: true });
  }
});