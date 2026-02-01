#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable ${name}`);
    process.exit(1);
  }
  return value;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function loadServiceAccount() {
  const serviceAccountPath =
    process.env.SERVICE_ACCOUNT_PATH || path.resolve("serviceAccountKey.json");

  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`No existe SERVICE_ACCOUNT_PATH: ${serviceAccountPath}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
}

module.exports = {
  requireEnv,
  hashPassword,
  loadServiceAccount,
};
