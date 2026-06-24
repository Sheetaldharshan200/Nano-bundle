import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isBlockedWriteResponse, parseMcpBody } from "../src/readiness.js";

const bootstrapPath = "docker/json-bootstrap/bootstrap.py";
const entrypointPath = "docker/mcp-server/scripts/entrypoint.sh";
const wrapperPath = "docker/mcp-server/scripts/run_http.py";
const dockerfilePath = "docker/mcp-server/Dockerfile";

test("bootstrap SQL is rerunnable and uses Exasol password syntax", async () => {
  const source = await readFile(bootstrapPath, "utf8");
  assert.match(source, /def password_literal/);
  assert.match(source, /IDENTIFIED BY \{password_literal\(readonly_password\)\}/);
  assert.match(source, /conflicts with another user or role name/);
  assert.doesNotMatch(source, /IDENTIFIED BY \{sql_string\(readonly_password\)\}/);
});

test("bootstrap inserts sample rows without unsupported pyexasol batch params", async () => {
  const source = await readFile(bootstrapPath, "utf8");
  assert.match(source, /for row in rows:/);
  assert.doesNotMatch(source, /VALUES \(\?, \?, \?, \?, \?, \?, \?\)"[,]?\s*\n\s*rows,/);
});

test("MCP wrapper loads settings, disables Nano certificate validation, and suppresses expected local warning", async () => {
  const entrypoint = await readFile(entrypointPath, "utf8");
  const wrapper = await readFile(wrapperPath, "utf8");
  const dockerfile = await readFile(dockerfilePath, "utf8");
  assert.match(entrypoint, /EXA_SSL_CERT_VALIDATION:=no/);
  assert.match(entrypoint, /exec python \/app\/run_http\.py/);
  assert.match(wrapper, /EXPECTED_NO_AUTH_WARNING/);
  assert.match(wrapper, /no_auth=True/);
  assert.match(dockerfile, /COPY scripts\/run_http\.py \/app\/run_http\.py/);
  assert.doesNotMatch(dockerfile, /`n/);
});

test("MCP SSE parser and write-block detection handle FastMCP responses", () => {
  const parsed = parseMcpBody('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n');
  assert.equal(parsed.result.ok, true);
  assert.equal(isBlockedWriteResponse({ result: { isError: true, content: [{ text: "Unknown tool" }] } }), true);
  assert.equal(isBlockedWriteResponse({ error: { message: "disabled" } }), true);
  assert.equal(isBlockedWriteResponse({ result: { content: [{ text: "created" }] } }), false);
});