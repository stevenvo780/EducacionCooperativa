#!/usr/bin/env node
const fs = require("fs");

function getArg(name, defaultValue) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return defaultValue;
  return process.argv[idx + 1] || defaultValue;
}

function readEnvValue(envPath, key) {
  if (!fs.existsSync(envPath)) return null;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith(`${key}=`)) continue;
    return line.split("=", 1)[0].length === key.length
      ? line.slice(key.length + 1)
      : null;
  }
  return null;
}

function decodeEscapes(input) {
  const escaped = input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return JSON.parse(`"${escaped}"`);
}

function normalizeJson(raw) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (_err) {
    const decoded = decodeEscapes(value);
    parsed = JSON.parse(decoded);
  }
  if (typeof parsed === "string") {
    parsed = JSON.parse(parsed);
  }
  return JSON.stringify(parsed, null, 2);
}

const envFile = getArg("--env-file", ".env.local");
const key = getArg("--key", "FIREBASE_SERVICE_ACCOUNT");
const out = getArg("--out", "-");

const raw = readEnvValue(envFile, key);
if (!raw) {
  console.error(`No se encontro ${key} en ${envFile}`);
  process.exit(1);
}

let jsonPayload;
try {
  jsonPayload = normalizeJson(raw);
} catch (err) {
  console.error(`No se pudo parsear JSON: ${err.message}`);
  process.exit(1);
}

if (out === "-") {
  console.log(jsonPayload);
} else {
  fs.writeFileSync(out, `${jsonPayload}\n`, "utf8");
}
