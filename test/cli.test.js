import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli.js";

test("start --render-only creates runtime files without Docker", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-cli-"));
  const originalLog = console.log;
  const output = [];
  console.log = (value = "") => output.push(String(value));
  try {
    await main(["start", `--home=${dir}`, "--render-only", "--yes"], { USERPROFILE: dir, HOME: dir });
    const env = await readFile(join(dir, ".env"), "utf8");
    const compose = await readFile(join(dir, "docker-compose.yml"), "utf8");
    const mcp = JSON.parse(await readFile(join(dir, "mcp", "settings.json"), "utf8"));
    assert.match(env, /MCP_READONLY_PASSWORD=/);
    assert.equal(compose.includes("docker.io/exasol/nano@sha256:bbaee25461c4690e583aec200531a0824c665841ba018e525092ab83d55b1560"), true);
    assert.equal(mcp.enable_write_query, false);
    assert.match(output.join("\n"), /Ready\./);
  } finally {
    console.log = originalLog;
    await rm(dir, { recursive: true, force: true });
  }
});

test("configure --yes and update --no-docker preserve rollback manifest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-update-"));
  const originalLog = console.log;
  console.log = () => {};
  try {
    await main(["configure", `--home=${dir}`, "--yes"], { USERPROFILE: dir, HOME: dir });
    await main(["update", `--home=${dir}`, "--yes", "--no-docker", "--channel=candidate"], { USERPROFILE: dir, HOME: dir });
    const active = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    const previous = JSON.parse(await readFile(join(dir, "previous-manifest.json"), "utf8"));
    assert.equal(active.channel, "candidate");
    assert.equal(previous.channel, "stable");
    await main(["rollback", `--home=${dir}`, "--no-docker"], { USERPROFILE: dir, HOME: dir });
    const rolledBack = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    assert.equal(rolledBack.channel, "stable");
    assert.equal(existsSync(join(dir, "failed-manifest.json")), true);
  } finally {
    console.log = originalLog;
    await rm(dir, { recursive: true, force: true });
  }
});

test("reset refuses to run without destructive confirmation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "exasol-json-mcp-reset-"));
  const originalLog = console.log;
  console.log = () => {};
  try {
    await main(["configure", `--home=${dir}`, "--yes"], { USERPROFILE: dir, HOME: dir });
    await assert.rejects(() => main(["reset", `--home=${dir}`], { USERPROFILE: dir, HOME: dir }), /Reset is destructive/);
  } finally {
    console.log = originalLog;
    await rm(dir, { recursive: true, force: true });
  }
});
test("--help shows commands, subcommands, clients, and examples", async () => {
  const originalLog = console.log;
  const output = [];
  console.log = (value = "") => output.push(String(value));
  try {
    await main(["--help"]);
    const help = output.join("\n");
    assert.match(help, /Commands:/);
    assert.match(help, /@sheetaldharshan\/exasol-json-mcp@latest start/);
    assert.match(help, /install-client-config/);
    assert.match(help, /autostart enable/);
    assert.match(help, /--client=<target>/);
    assert.match(help, /claude, codex, vscode, or all/);
    assert.match(help, /reset --confirm=delete-local-exasol-json-mcp/);
    assert.match(help, /Default state directory:/);
  } finally {
    console.log = originalLog;
  }
});
