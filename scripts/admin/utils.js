#!/usr/bin/env node
/**
 * Shared utilities for admin scripts
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/**
 * Require an environment variable or exit with error
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable ${name}`);
    process.exit(1);
  }
  return value;
}

/**
 * Hash a password using SHA-256 (matches src/lib/crypto.ts)
 */
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Load Firebase Admin service account from env or file
 */
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
