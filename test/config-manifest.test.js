import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig, defaultStateDir, loadOrCreateConfig, parseEnvFile, serializeEnvFile } from "../src/config.js";
import { validateManifest } from "../src/manifest.js";

const goodManifest = {
  channel: "stable",
  versions: {
    exasolNanoImage: "docker.io/exasol/nano:2025.1.0",
    jsonBootstrapImage: "docker.io/sheetaldharshan/exasol-json-bootstrap:0.1.0",
    mcpServerImage: "docker.io/sheetaldharshan/exasol-mcp-server:0.1.0"
  },
  minimums: {
    docker: "24.0.0",
    compose: "2.20.0"
  }
};

test("defaultStateDir uses Windows profile when platform is win32", () => {
  assert.equal(defaultStateDir({ USERPROFILE: "C:\\Users\\me" }, "win32"), "C:\\Users\\me\\.exasol-json-mcp");
});

test("env serialization round-trips config values", () => {
  const config = createDefaultConfig({ mcpReadonlyPassword: "secret", datasetName: "events" });
  const parsed = parseEnvFile(serializeEnvFile(config));
  assert.equal(parsed.mcpReadonlyPassword, "secret");
  assert.equal(parsed.datasetName, "events");
  assert.equal(parsed.sqlHost, "127.0.0.1");
});

test("loadOrCreateConfig writes .env once and reuses it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-"));
  try {
    const first = await loadOrCreateConfig(dir, { mcpReadonlyPassword: "first" });
    const second = await loadOrCreateConfig(dir, { mcpReadonlyPassword: "second" });
    const env = await readFile(join(dir, ".env"), "utf8");
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.config.mcpReadonlyPassword, "first");
    assert.match(env, /MCP_READONLY_PASSWORD="first"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("manifest validator accepts pinned images", () => {
  assert.equal(validateManifest(goodManifest), goodManifest);
});

test("manifest validator rejects latest and missing tags", () => {
  assert.throws(() => validateManifest({
    ...goodManifest,
    versions: {
      ...goodManifest.versions,
      exasolNanoImage: "docker.io/exasol/nano:latest"
    }
  }), /must not use latest/);

  assert.throws(() => validateManifest({
    ...goodManifest,
    versions: {
      ...goodManifest.versions,
      mcpServerImage: "docker.io/sheetaldharshan/exasol-mcp-server"
    }
  }), /must include an explicit tag/);
});

