import assert from "node:assert/strict";
import { renderCompose, renderFirstPrompt, renderMcpClientConfig, renderMcpSettings, renderReadyOutput } from "../src/render.js";

const config = {
  sysPassword: "exasol",
  mcpReadonlyPassword: "readonly-secret",
  sqlHost: "127.0.0.1",
  sqlPort: "8563",
  mcpHost: "127.0.0.1",
  mcpPort: "7766",
  datasetName: "customer_events",
  useSampleData: "true",
  mcpReadonlyUser: "MCP_READONLY"
};

const manifest = {
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

test("MCP settings are readonly and scoped to ANALYTICS", () => {
  const settings = renderMcpSettings();
  assert.equal(settings.enable_read_query, true);
  assert.equal(settings.enable_write_query, false);
  assert.equal(settings.enable_read_bucketfs, false);
  assert.equal(settings.enable_write_bucketfs, false);
  assert.equal(settings.functions.enable, false);
  assert.equal(settings.scripts.enable, false);
  assert.equal(settings.schemas.like_pattern, "ANALYTICS");
});

test("Compose binds local ports and uses readonly MCP user", () => {
  const compose = renderCompose(config, manifest);
  assert.match(compose, /"127\.0\.0\.1:8563:8563"/);
  assert.match(compose, /"127\.0\.0\.1:7766:7766"/);
  assert.match(compose, /EXASOL_USER: "MCP_READONLY"/);
  assert.doesNotMatch(compose, /EXASOL_USER: "sys"/);
  assert.match(compose, /shm_size: "512m"/);
  assert.match(compose, /exa-data:\/exa/);
});

test("MCP client config and prompt are copy-pasteable", () => {
  const clientConfig = JSON.parse(renderMcpClientConfig(config));
  assert.equal(clientConfig.mcpServers.exasol_nano.url, "http://localhost:7766/mcp");
  assert.match(renderFirstPrompt(config), /ANALYTICS\.CUSTOMER_EVENTS/);
  assert.match(renderReadyOutput(config), /type:\n  completed/);
});
test("Compose avoids brittle Nano healthcheck and lets bootstrap wait for SQL", () => {
  const compose = renderCompose(config, manifest);
  assert.doesNotMatch(compose, /healthcheck:/);
  assert.doesNotMatch(compose, /service_healthy/);
  assert.match(compose, /condition: service_started/);
});

test("Compose passes official MCP settings and Nano TLS environment variables", () => {
  const compose = renderCompose(config, manifest);
  assert.match(compose, /EXA_MCP_SETTINGS: \/app\/settings\.json/);
  assert.match(compose, /EXA_SSL_CERT_VALIDATION: "no"/);
  assert.doesNotMatch(compose, /MCP_SETTINGS_FILE/);
});
test("Compose restarts long-running services after host reboot", () => {
  const compose = renderCompose(config, manifest);
  assert.match(compose, /exanano:\n    restart: unless-stopped/);
  assert.match(compose, /mcp-server:\n    restart: unless-stopped/);
  assert.doesNotMatch(compose, /json-bootstrap:\n    restart: unless-stopped/);
});

