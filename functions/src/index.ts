/**
 * Cloud Functions para Agora — sync de custom claims de workspace membership.
 *
 * Forma del claim:
 *   request.auth.token.workspaces = { [wsId]: true }
 *
 * Es un mapa booleano (no string de rol) porque las reglas existentes en
 * firestore.rules y database.rules.json usan `wsId in auth.token.workspaces`
 * (operador `in` de Firebase rules → requiere keys del mapa, no values).
 *
 * El backend (AgoraBack) ya invoca `syncWorkspaceClaims` en los puntos de
 * mutación (create, accept invite, remove member, duplicate, login). Estas
 * Cloud Functions actúan como defensa-en-profundidad idempotente: si alguien
 * muta `workspaces/{wsId}.members` por fuera del backend (Admin SDK, consola
 * Firebase, batch jobs), el trigger reconcilia los claims automáticamente.
 *
 * Diseño:
 * - `onWorkspaceWritten`: trigger Firestore v2 sobre create/update/delete.
 *   Diff `before.members` vs `after.members`, actualiza claims sólo para
 *   los uids cuyo set cambió. Idempotente.
 * - `backfillWorkspaceClaims`: callable HTTPS para reconstruir claims de
 *   TODOS los users existentes (1 ejecución antes del deploy de rules).
 * - `syncMyWorkspaceClaims`: callable HTTPS que cualquier user puede invocar
 *   para forzar refresh de sus propios claims (útil para debug).
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {initializeApp, getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const REGION = "us-central1";
const PROJECT_ID = "udea-filosofia";

type WorkspaceDoc = {
  ownerId?: string;
  members?: string[];
  type?: string;
  name?: string;
};

const PERSONAL_TYPE = "personal";

const isPersonalWorkspace = (wsId: string, data: WorkspaceDoc | undefined) =>
  data?.type === PERSONAL_TYPE || wsId.startsWith("personal_") || wsId.startsWith("personal:");

const toUidSet = (members: unknown): Set<string> => {
  if (!Array.isArray(members)) return new Set();
  return new Set(
    members
      .filter((m): m is string => typeof m === "string" && m.length > 0)
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
  );
};

const setUnion = (a: Set<string>, b: Set<string>): Set<string> => {
  const out = new Set(a);
  b.forEach((x) => out.add(x));
  return out;
};

const setDifference = (a: Set<string>, b: Set<string>): Set<string> => {
  const out = new Set<string>();
  a.forEach((x) => { if (!b.has(x)) out.add(x); });
  return out;
};

/**
 * Recompute the `workspaces` claim for a single uid from Firestore (source of
 * truth). Preserves any other claims (e.g. `role`, `workspaceId` for sync-agent).
 *
 * Returns true if the claim actually changed (so we only revoke refresh tokens
 * when there's a real delta — avoids unnecessary client re-auth churn).
 */
async function rebuildClaimsForUser(uid: string): Promise<boolean> {
  const db = getFirestore();
  const auth = getAuth();

  const snap = await db
    .collection("workspaces")
    .where("members", "array-contains", uid)
    .select() // doc IDs only — saves reads on large workspaces
    .get();

  const workspaces: Record<string, boolean> = {};
  snap.docs.forEach((doc) => {
    workspaces[doc.id] = true;
  });

  let existing: Record<string, unknown> = {};
  try {
    const user = await auth.getUser(uid);
    existing = (user.customClaims ?? {}) as Record<string, unknown>;
  } catch (err) {
    // Usuario en Firestore pero no en Auth → log y salir sin error
    logger.warn("rebuildClaimsForUser: user not found in Auth", {uid, err: String(err)});
    return false;
  }

  const existingWorkspaces = (existing.workspaces ?? {}) as Record<string, boolean>;
  const sameKeys =
    Object.keys(existingWorkspaces).length === Object.keys(workspaces).length &&
    Object.keys(workspaces).every((k) => existingWorkspaces[k] === true);

  if (sameKeys) return false;

  const nextClaims = {...existing, workspaces};

  // Firebase impone ~1000 bytes en customClaims. ~50 chars por wsId → ~20 ws/user.
  // Si vemos workspaces gigantes, registramos un warning para revisar.
  const sizeBytes = Buffer.byteLength(JSON.stringify(nextClaims));
  if (sizeBytes > 900) {
    logger.warn("rebuildClaimsForUser: claims payload close to 1KB limit", {
      uid,
      sizeBytes,
      workspaceCount: Object.keys(workspaces).length,
    });
  }

  await auth.setCustomUserClaims(uid, nextClaims);
  await auth.revokeRefreshTokens(uid);

  logger.info("rebuildClaimsForUser: claims updated", {
    uid,
    workspaceCount: Object.keys(workspaces).length,
  });
  return true;
}

/**
 * Firestore trigger: reconcilia claims cuando workspaces/{wsId} cambia.
 *
 * Casos:
 * - create: members iniciales → add wsId a sus claims
 * - update: diff members; uids añadidos/quitados → recompute claims
 * - delete: ex-members → recompute claims (wsId desaparece del mapa)
 *
 * Es idempotente: si el backend ya disparó setCustomUserClaims, el segundo
 * write detecta sameKeys=true y no hace nada.
 */
export const onWorkspaceWritten = onDocumentWritten(
  {
    document: "workspaces/{wsId}",
    region: REGION,
    // Concurrency razonable para una operación leve. Si una creación masiva
    // dispara muchos triggers, Firestore los serializa por documento.
    concurrency: 20,
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const wsId = event.params.wsId;
    if (!wsId) return;

    const beforeData = event.data?.before.exists ? (event.data.before.data() as WorkspaceDoc) : undefined;
    const afterData = event.data?.after.exists ? (event.data.after.data() as WorkspaceDoc) : undefined;

    // Personal workspaces no usan el claim (las rules ya filtran por prefijo).
    // Pero si en algún momento el wsId era shared y pasó a personal, igual
    // limpiamos. Caso esperado: nunca pasa.
    if (isPersonalWorkspace(wsId, afterData ?? beforeData)) {
      logger.debug("onWorkspaceWritten: skipping personal workspace", {wsId});
      return;
    }

    const beforeMembers = toUidSet(beforeData?.members);
    const afterMembers = toUidSet(afterData?.members);

    // Quitamos prefix '/' por compatibilidad: array-contains nunca matchea
    // strings vacíos pero el toUidSet ya los filtra.
    const added = setDifference(afterMembers, beforeMembers);
    const removed = setDifference(beforeMembers, afterMembers);

    const affectedUids = setUnion(added, removed);
    if (affectedUids.size === 0) {
      logger.debug("onWorkspaceWritten: no membership delta", {wsId});
      return;
    }

    logger.info("onWorkspaceWritten: reconciling claims", {
      wsId,
      added: [...added],
      removed: [...removed],
    });

    // Procesamos en paralelo pero con allSettled para no abortar todo si
    // alguno falla (e.g. user borrado en Auth).
    const results = await Promise.allSettled(
      [...affectedUids].map((uid) => rebuildClaimsForUser(uid))
    );

    const failures = results
      .map((r, i) => ({uid: [...affectedUids][i], status: r.status, reason: r.status === "rejected" ? String(r.reason) : null}))
      .filter((x) => x.status === "rejected");

    if (failures.length > 0) {
      logger.error("onWorkspaceWritten: some claim updates failed", {wsId, failures});
    }
  }
);

/**
 * HTTPS callable: backfill de claims para todos los workspaces existentes.
 *
 * USO: 1 sola vez antes del deploy de rules estrictas. Sin esto, los users
 * existentes no tienen `workspaces` claim y las rules nuevas los rechazan
 * con permission_denied.
 *
 * Sólo accesible para admins (uid en `adminUids` de envVars o claim `role:admin`).
 * Para evitar un loop infinito de invocar la function recursivamente, este
 * callable hace UNA pasada lineal y devuelve un resumen.
 *
 * Llamado típico (desde Firebase shell o un script con admin SDK):
 *   curl -X POST https://<region>-<project>.cloudfunctions.net/backfillWorkspaceClaims \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer <admin-id-token>" \
 *     -d '{"data": {}}'
 */
export const backfillWorkspaceClaims = onCall(
  {
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 540, // 9min — suficiente para miles de workspaces
    cors: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Auth requerida");
    }
    const token = request.auth.token as {role?: string; admin?: boolean};
    if (token.role !== "admin" && token.admin !== true) {
      throw new HttpsError("permission-denied", "Solo admins pueden ejecutar el backfill");
    }

    const db = getFirestore();

    // Recolectamos todos los uids miembros de algún workspace shared.
    // Paginamos por seguridad ante colecciones grandes.
    const uidSet = new Set<string>();
    const workspaceIds: string[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const BATCH = 500;

    for (;;) {
      let q: FirebaseFirestore.Query = db
        .collection("workspaces")
        .orderBy("__name__")
        .limit(BATCH);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const data = doc.data() as WorkspaceDoc;
        if (isPersonalWorkspace(doc.id, data)) continue;
        workspaceIds.push(doc.id);
        toUidSet(data.members).forEach((uid) => uidSet.add(uid));
      }

      if (snap.size < BATCH) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    logger.info("backfillWorkspaceClaims: scanning", {
      workspaceCount: workspaceIds.length,
      uniqueUidCount: uidSet.size,
    });

    // Procesamos uids con concurrencia controlada para no saturar Auth.
    const uids = [...uidSet];
    const CONCURRENCY = 10;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{uid: string; error: string}> = [];

    let cursor = 0;
    const workers = Array.from({length: Math.min(CONCURRENCY, uids.length)}, async () => {
      for (;;) {
        const idx = cursor++;
        if (idx >= uids.length) return;
        const uid = uids[idx];
        if (!uid) continue;
        try {
          const changed = await rebuildClaimsForUser(uid);
          if (changed) updated++;
          else skipped++;
        } catch (err) {
          errors.push({uid, error: String(err)});
        }
      }
    });

    await Promise.all(workers);

    const result = {
      workspaceCount: workspaceIds.length,
      uidsScanned: uids.length,
      claimsUpdated: updated,
      claimsAlreadyCorrect: skipped,
      errors,
    };
    logger.info("backfillWorkspaceClaims: done", result);
    return result;
  }
);

/**
 * HTTPS callable: cualquier user autenticado puede forzar refresh de sus claims.
 *
 * Caso típico: el cliente acaba de aceptar una invitación pero el `getIdToken()`
 * cacheado todavía no tiene el claim. Llamar `syncMyWorkspaceClaims()` y luego
 * `getIdToken(true)` devuelve el token con claim actualizado.
 *
 * Defensa-en-profundidad: si el trigger Firestore aún no se ejecutó (latencia ~1s),
 * el callable lo fuerza síncrono.
 */
export const syncMyWorkspaceClaims = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Auth requerida");
    }
    const uid = request.auth.uid;
    const changed = await rebuildClaimsForUser(uid);
    return {uid, changed};
  }
);

// Re-export para que `firebase deploy --only functions:<name>` funcione individualmente.
export {PROJECT_ID};
