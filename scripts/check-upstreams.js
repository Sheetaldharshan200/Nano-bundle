import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_CONFIG = ".github/upstream-watch.json";
const DEFAULT_MANIFEST = "manifests/stable.json";

export async function checkUpstreams({ configPath = DEFAULT_CONFIG, manifestPath = DEFAULT_MANIFEST } = {}) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const checks = [];
  checks.push(await checkNano(config.exasolNano, manifest));
  checks.push(await checkPyPi(config.exasolMcpServer));
  checks.push(await checkGitHubTags(config.jsonTables));

  const hasUpdates = checks.some((check) => check.updateAvailable);
  return {
    checkedAt: new Date().toISOString(),
    hasUpdates,
    checks
  };
}

async function checkNano(config, manifest) {
  const currentImage = manifest.versions[config.currentImageKey];
  const currentDigest = currentImage.match(/@sha256:[a-f0-9]{64}$/)?.[0]?.slice(1) || null;
  const currentTag = imageTag(currentImage);
  const data = await fetchJson(`https://hub.docker.com/v2/repositories/${config.repository}/tags?page_size=100`);
  const pattern = new RegExp(config.stableTagPattern);
  const latest = data.results.find((tag) => pattern.test(tag.name));
  if (!latest) throw new Error(`No stable Nano tag matched ${config.stableTagPattern}`);

  const latestImage = `docker.io/${config.repository}@${latest.digest}`;
  const updateAvailable = currentDigest ? currentDigest !== latest.digest : currentTag !== latest.name;
  return {
    name: "Exasol Nano",
    source: `https://hub.docker.com/r/${config.repository}/tags`,
    current: currentDigest || currentTag || currentImage,
    latest: `${latest.name} (${latest.digest})`,
    suggestedPin: latestImage,
    updateAvailable,
    note: updateAvailable ? "Update candidate manifest only, then run docker-compatibility." : "Stable manifest is on the latest watched Nano digest."
  };
}

async function checkPyPi(config) {
  const current = await readRequirementVersion(config.requirementsFile, config.package);
  const data = await fetchJson(`https://pypi.org/pypi/${config.package}/json`);
  const latest = data.info.version;
  return {
    name: "Exasol MCP Server",
    source: `https://pypi.org/project/${config.package}/`,
    current,
    latest,
    suggestedPin: `${config.package}==${latest}`,
    updateAvailable: compareVersions(latest, current) > 0,
    note: compareVersions(latest, current) > 0 ? "Update docker/mcp-server/requirements.txt, rebuild candidate MCP image, and smoke-test." : "Pinned MCP Server package is current."
  };
}

async function checkGitHubTags(config) {
  const release = await fetchLatestGitHubRelease(config.repository).catch(() => null);
  const latest = release?.tag_name || (await fetchLatestGitHubTag(config.repository));
  const current = config.currentRef;
  return {
    name: "Exasol JSON Tables",
    source: `https://github.com/${config.repository}`,
    current,
    latest,
    suggestedPin: latest,
    updateAvailable: normalizeRef(latest) !== normalizeRef(current),
    note: normalizeRef(latest) !== normalizeRef(current) ? "Review JSON Tables changes before changing the bootstrap image." : "Tracked JSON Tables ref is current."
  };
}

async function fetchLatestGitHubRelease(repository) {
  const release = await fetchJson(`https://api.github.com/repos/${repository}/releases/latest`);
  if (!release?.tag_name) throw new Error(`No latest release for ${repository}`);
  return release;
}

async function fetchLatestGitHubTag(repository) {
  const tags = await fetchJson(`https://api.github.com/repos/${repository}/tags?per_page=1`);
  if (!Array.isArray(tags) || !tags[0]?.name) throw new Error(`No tags found for ${repository}`);
  return tags[0].name;
}

async function readRequirementVersion(file, packageName) {
  const source = await readFile(file, "utf8");
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^${escaped}==([^\\s#]+)`, "m"));
  if (!match) throw new Error(`Could not find ${packageName}==... in ${file}`);
  return match[1];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "sheetaldharshan-exasol-json-mcp-upstream-watch",
      "Accept": "application/json"
    }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function imageTag(image) {
  const imageWithoutDigest = image.split("@")[0];
  const slash = imageWithoutDigest.lastIndexOf("/");
  const colon = imageWithoutDigest.lastIndexOf(":");
  if (colon <= slash) return null;
  return imageWithoutDigest.slice(colon + 1);
}

function compareVersions(left, right) {
  const leftParts = String(left).split(/[.-]/).map(versionPart);
  const rightParts = String(right).split(/[.-]/).map(versionPart);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index] ?? 0;
    const b = rightParts[index] ?? 0;
    if (typeof a === "number" && typeof b === "number" && a !== b) return a > b ? 1 : -1;
    const text = String(a).localeCompare(String(b));
    if (text !== 0) return text;
  }
  return 0;
}

function versionPart(value) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function normalizeRef(ref) {
  return String(ref || "").replace(/^refs\/tags\//, "").trim();
}

export function renderMarkdown(report) {
  const lines = [
    "# Upstream Watch Report",
    "",
    `Checked at: ${report.checkedAt}`,
    "",
    report.hasUpdates ? "Updates are available." : "No watched upstream updates found.",
    "",
    "| Component | Current | Latest | Action |",
    "| --- | --- | --- | --- |"
  ];

  for (const check of report.checks) {
    lines.push(`| ${escapeCell(check.name)} | ${escapeCell(check.current)} | ${escapeCell(check.latest)} | ${escapeCell(check.updateAvailable ? check.suggestedPin : "No action")} |`);
  }

  lines.push("", "## Notes", "");
  for (const check of report.checks) {
    lines.push(`- ${check.name}: ${check.note} Source: ${check.source}`);
  }
  lines.push("", "## Safe Update Flow", "", "1. Update candidate pins only.", "2. Run the `docker-compatibility` workflow with `channel=candidate`.", "3. Promote to stable only after compatibility tests pass.", "4. Tell users to run `npx -y @sheetaldharshan/exasol-json-mcp update`.", "5. If needed, tell users to run `npx -y @sheetaldharshan/exasol-json-mcp rollback`.");
  return `${lines.join("\n")}\n`;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    flags[key] = inlineValue ?? argv[index + 1] ?? true;
    if (inlineValue === undefined && argv[index + 1] && !argv[index + 1].startsWith("--")) index += 1;
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const report = await checkUpstreams({
    configPath: flags.config || DEFAULT_CONFIG,
    manifestPath: flags.manifest || DEFAULT_MANIFEST
  });
  const markdown = renderMarkdown(report);

  if (flags.json) await writeFile(String(flags.json), JSON.stringify(report, null, 2) + "\n", "utf8");
  if (flags.markdown) await writeFile(String(flags.markdown), markdown, "utf8");

  console.log(markdown);

  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `has_updates=${report.hasUpdates ? "true" : "false"}\n`, { flag: "a" });
  }

  if (flags["fail-on-updates"] && report.hasUpdates) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
