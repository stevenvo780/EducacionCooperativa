#!/usr/bin/env node
/**
 * Backfill claims usando admin SDK directo (sin pasar por el callable).
 *
 * USO:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/backfill-claims.mjs
 *
 * o con cuenta gcloud:
 *   gcloud auth application-default login
 *   node scripts/backfill-claims.mjs --project=udea-filosofia
 *
 * Ventaja sobre el callable: no necesita autenticar como admin via IDToken,
 * funciona offline con service account local, y es 100% idempotente.
 *
 * Salida ejemplo:
 *   [backfill] scanned 47 workspaces, 23 unique uids
 *   [backfill] claims updated: 18, already correct: 5, errors: 0
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [[m[1], m[2] ?? "true"]] : [];
  })
);

const projectId = args.project || process.env.FIREBASE_PROJECT_ID || "udea-filosofia";
const saPath = args["service-account"] || process.env.GOOGLE_APPLICATION_CREDENTIALS;

initializeApp({
  credential: saPath ? cert(saPath) : applicationDefault(),
  projectId,
});

const db = getFirestore();
const auth = getAuth();

const PERSONAL_TYPE = "personal";
const isPersonal = (id, data) =>
  data?.type === PERSONAL_TYPE || id.startsWith("personal_") || id.startsWith("personal:");

const toUidSet = (members) => {
  if (!Array.isArray(members)) return new Set();
  return new Set(
    members.filter((m) => typeof m === "string" && m.trim().length > 0).map((m) => m.trim())
  );
};

async function rebuildClaimsForUser(uid) {
  const snap = await db
    .collection("workspaces")
    .where("members", "array-contains", uid)
    .select()
    .get();
  const workspaces = {};
  snap.docs.forEach((d) => { workspaces[d.id] = true; });

  let existing = {};
  try {
    const u = await auth.getUser(uid);
    existing = u.customClaims ?? {};
  } catch (err) {
    return { uid, status: "skipped", reason: `auth.getUser failed: ${err.message}` };
  }

  const existingWs = existing.workspaces ?? {};
  const sameKeys =
    Object.keys(existingWs).length === Object.keys(workspaces).length &&
    Object.keys(workspaces).every((k) => existingWs[k] === true);

  if (sameKeys) return { uid, status: "already-correct", workspaceCount: Object.keys(workspaces).length };

  const next = { ...existing, workspaces };
  await auth.setCustomUserClaims(uid, next);
  await auth.revokeRefreshTokens(uid);
  return { uid, status: "updated", workspaceCount: Object.keys(workspaces).length };
}

async function main() {
  console.log(`[backfill] project=${projectId}`);
  const uidSet = new Set();
  const workspaceIds = [];
  let lastDoc;
  const BATCH = 500;

  for (;;) {
    let q = db.collection("workspaces").orderBy("__name__").limit(BATCH);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (isPersonal(doc.id, data)) continue;
      workspaceIds.push(doc.id);
      toUidSet(data.members).forEach((u) => uidSet.add(u));
    }
    if (snap.size < BATCH) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`[backfill] scanned ${workspaceIds.length} workspaces, ${uidSet.size} unique uids`);

  const uids = [...uidSet];
  const CONCURRENCY = 10;
  let updated = 0;
  let alreadyCorrect = 0;
  const errors = [];

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, uids.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= uids.length) return;
        const uid = uids[i];
        try {
          const r = await rebuildClaimsForUser(uid);
          if (r.status === "updated") updated++;
          else if (r.status === "already-correct") alreadyCorrect++;
          else errors.push(r);
        } catch (err) {
          errors.push({ uid, error: err.message });
        }
      }
    })
  );

  console.log(
    `[backfill] claims updated: ${updated}, already correct: ${alreadyCorrect}, errors: ${errors.length}`
  );
  if (errors.length) {
    console.warn("[backfill] errors:", errors.slice(0, 10));
  }
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
