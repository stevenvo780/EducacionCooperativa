#!/usr/bin/env node
const admin = require("firebase-admin");
const { requireEnv, hashPassword, loadServiceAccount } = require("./utils");

const serviceAccount = loadServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const uid = requireEnv("UID");
const email = requireEnv("EMAIL");
const displayName = process.env.DISPLAY_NAME || "";
const password =
  process.env.PASSWORD || (process.env.PASSWORD_HASH ? "" : null);
const passwordHash = process.env.PASSWORD_HASH || hashPassword(password || "");

if (!passwordHash) {
  console.error("Falta PASSWORD o PASSWORD_HASH");
  process.exit(1);
}

async function syncUser() {
  const userRef = db.collection("users").doc(uid);
  const doc = await userRef.get();

  const payload = {
    email,
    displayName,
    passwordHash,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!doc.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(payload, { merge: true });

  console.log("Usuario sincronizado en Firestore");
  console.log(`UID: ${uid}`);
  console.log(`Email: ${email}`);
}

syncUser().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
