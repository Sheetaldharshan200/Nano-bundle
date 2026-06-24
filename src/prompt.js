import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DEFAULTS } from "./constants.js";
import { generatePassword } from "./config.js";

export async function promptForConfig({ existing = {}, manifest, stateDir, nonInteractive = false } = {}) {
  const defaults = {
    exasolNanoImage: manifest.versions.exasolNanoImage,
    sysPassword: DEFAULTS.sysPassword,
    mcpReadonlyPassword: generatePassword(),
    sqlHost: DEFAULTS.sqlHost,
    sqlPort: DEFAULTS.sqlPort,
    mcpHost: DEFAULTS.mcpHost,
    mcpPort: DEFAULTS.mcpPort,
    datasetName: DEFAULTS.datasetName,
    useSampleData: DEFAULTS.useSampleData,
    mcpReadonlyUser: DEFAULTS.mcpReadonlyUser,
    ...existing
  };

  if (nonInteractive || !process.stdin.isTTY) return defaults;

  const rl = readline.createInterface({ input, output });
  try {
    const answers = { ...defaults };
    answers.workDir = await ask(rl, "Work directory", stateDir);
    answers.exasolNanoImage = await ask(rl, "Exasol Nano image", defaults.exasolNanoImage);
    answers.sysPassword = await ask(rl, "Exasol SYS password", defaults.sysPassword);
    const mcpPassword = await ask(rl, "MCP readonly password", "generate random");
    answers.mcpReadonlyPassword = mcpPassword === "generate random" ? defaults.mcpReadonlyPassword : mcpPassword;
    answers.sqlPort = await ask(rl, "Exasol SQL port", defaults.sqlPort);
    answers.mcpPort = await ask(rl, "MCP HTTP port", defaults.mcpPort);
    answers.datasetName = await ask(rl, "Dataset name", defaults.datasetName);
    answers.useSampleData = normalizeBoolean(await ask(rl, "Use sample JSON data? [Y/n]", defaults.useSampleData));
    return answers;
  } finally {
    rl.close();
  }
}

export async function waitForCompletionInput({ nonInteractive = false } = {}) {
  if (nonInteractive || !process.stdin.isTTY) return "exit";
  const rl = readline.createInterface({ input, output });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(value);
    };
    rl.on("SIGINT", () => finish("exit"));
    const askLoop = async () => {
      for (;;) {
        const answer = (await rl.question("> ")).trim().toLowerCase();
        if (answer === "completed" || answer === "exit") return finish(answer);
        console.log("Type completed or exit.");
      }
    };
    askLoop().catch(() => finish("exit"));
  });
}

async function ask(rl, label, defaultValue) {
  const answer = await rl.question(`${label} [default: ${defaultValue}] `);
  return answer.trim() || String(defaultValue);
}

function normalizeBoolean(value) {
  const normalized = String(value).trim().toLowerCase();
  if (["n", "no", "false", "0"].includes(normalized)) return "false";
  return "true";
}

