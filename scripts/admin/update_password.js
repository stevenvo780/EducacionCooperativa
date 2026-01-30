#!/usr/bin/env node
const admin = require("firebase-admin");
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

const serviceAccountPath =
  process.env.SERVICE_ACCOUNT_PATH || path.resolve("serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`No existe SERVICE_ACCOUNT_PATH: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = requireEnv("UID");
const password = requireEnv("PASSWORD");

admin
  .auth()
  .updateUser(uid, { password })
  .then(() => {
    console.log("Contrasena actualizada en Firebase Auth");
    process.exit(0);
  })
  .catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
