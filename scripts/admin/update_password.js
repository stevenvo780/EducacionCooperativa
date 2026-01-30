#!/usr/bin/env node
const admin = require("firebase-admin");
const { requireEnv, loadServiceAccount } = require("./utils");

const serviceAccount = loadServiceAccount();

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
