import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_TAGS = new Set(["latest", "main", "master"]);
const DIGEST_PATTERN = /@sha256:[a-f0-9]{64}$/;

export async function loadBundledManifest(channel = "stable") {
  const here = dirname(fileURLToPath(import.meta.url));
  const manifestPath = join(here, "..", "manifests", `${channel}.json`);
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (!manifest.channel || typeof manifest.channel !== "string") errors.push("channel is required");
  if (!manifest.versions || typeof manifest.versions !== "object") errors.push("versions is required");
  if (!manifest.minimums || typeof manifest.minimums !== "object") errors.push("minimums is required");

  const requiredImages = ["exasolNanoImage", "jsonBootstrapImage", "mcpServerImage"];
  for (const key of requiredImages) {
    const value = manifest?.versions?.[key];
    if (!value || typeof value !== "string") {
      errors.push(`${key} is required`);
      continue;
    }
    const digestPinned = DIGEST_PATTERN.test(value);
    const tag = imageTag(value);
    if (!digestPinned && !tag) errors.push(`${key} must include an explicit tag or sha256 digest`);
    if (tag && FORBIDDEN_TAGS.has(tag) && !digestPinned) errors.push(`${key} must not use ${tag}`);
  }

  for (const key of ["docker", "compose"]) {
    if (!manifest?.minimums?.[key] || typeof manifest.minimums[key] !== "string") {
      errors.push(`minimums.${key} is required`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid release manifest:\n- ${errors.join("\n- ")}`);
  }
  return manifest;
}

function imageTag(image) {
  const imageWithoutDigest = image.split("@")[0];
  const slash = imageWithoutDigest.lastIndexOf("/");
  const colon = imageWithoutDigest.lastIndexOf(":");
  if (colon <= slash) return null;
  return imageWithoutDigest.slice(colon + 1);
}
