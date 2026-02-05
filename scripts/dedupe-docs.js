#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const strategyArg = argv.find(arg => arg.startsWith('--strategy='));
const strategy = strategyArg ? strategyArg.split('=')[1] : 'archive'; // archive | delete
const pageSizeArg = argv.find(arg => arg.startsWith('--page-size='));
const PAGE_SIZE = pageSizeArg ? Number(pageSizeArg.split('=')[1]) : 500;

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || '/datos/repos/Personal/ProyectoEducacionCooperativa/EducacionCooperativa/services/worker/packaging/serviceAccountKey.json';
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'udea-filosofia.appspot.com';

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: STORAGE_BUCKET,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const SAFE_NAME_REGEX = /[\\/]/g;
const sanitizeFileName = (value) => String(value || 'Sin titulo').replace(SAFE_NAME_REGEX, '_');
const ensureMarkdownFileName = (value) => {
  const safe = sanitizeFileName(value || 'Sin titulo');
  return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
};
const normalizeFolderPath = (value) => {
  if (!value) return 'No estructurado';
  const normalized = String(value)
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join('/');
  return normalized || 'No estructurado';
};
const buildStoragePrefix = (workspaceId, ownerId) => {
  return workspaceId === 'personal' ? `users/${ownerId}` : `workspaces/${workspaceId}`;
};

const parseTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const getExt = (storagePath) => {
  const idx = storagePath.lastIndexOf('.');
  return idx >= 0 ? storagePath.slice(idx) : '';
};

const buildNewStoragePath = ({ workspaceId, ownerId, folder, name, storagePath }) => {
  const prefix = buildStoragePrefix(workspaceId, ownerId);
  const normalizedFolder = normalizeFolderPath(folder);
  const ext = getExt(storagePath || '');
  if (ext && ext !== '.md') {
    const safe = sanitizeFileName(name || 'Sin titulo');
    return `${prefix}/${normalizedFolder}/${safe}${ext}`;
  }
  const fileName = ensureMarkdownFileName(name || 'Sin titulo');
  return `${prefix}/${normalizedFolder}/${fileName}`;
};

const copyStorageObject = async (fromPath, toPath) => {
  const fromFile = bucket.file(fromPath);
  const toFile = bucket.file(toPath);
  const [exists] = await fromFile.exists();
  if (!exists) return { ok: false, reason: 'not_found' };
  await fromFile.copy(toFile);
  return { ok: true };
};

(async () => {
  let totalDocs = 0;
  const storageMap = new Map();

  let query = db.collection('documents').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
  let lastDoc = null;
  while (true) {
    const snap = await query.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const storagePath = data.storagePath || '';
      if (!storagePath) continue;

      const list = storageMap.get(storagePath) || [];
      list.push({ id: docSnap.id, data });
      storageMap.set(storagePath, list);
      totalDocs++;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    query = db.collection('documents')
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(lastDoc)
      .limit(PAGE_SIZE);
  }

  const dupes = [];
  for (const [storagePath, list] of storageMap.entries()) {
    if (list.length > 1) dupes.push({ storagePath, list });
  }

  let kept = 0;
  let archived = 0;
  let deleted = 0;
  let copyFailures = 0;

  for (const dupe of dupes) {
    const sorted = dupe.list.slice().sort((a, b) => {
      const aTs = parseTimestamp(a.data.updatedAt) || parseTimestamp(a.data.createdAt);
      const bTs = parseTimestamp(b.data.updatedAt) || parseTimestamp(b.data.createdAt);
      return bTs - aTs;
    });
    const keep = sorted[0];
    kept++;

    for (const item of sorted.slice(1)) {
      const data = item.data;
      const name = data.name || 'Sin titulo';
      const folder = data.folder || 'No estructurado';
      const workspaceId = data.workspaceId || 'personal';
      const ownerId = data.ownerId || '';
      const originalPath = data.storagePath;

      if (strategy === 'delete') {
        if (apply) {
          await db.collection('documents').doc(item.id).delete();
        }
        deleted++;
        continue;
      }

      const newFolder = `Duplicados/${normalizeFolderPath(folder)}`;
      const newName = `${name}__dup__${item.id.slice(0, 6)}`;
      const newStoragePath = buildNewStoragePath({
        workspaceId,
        ownerId,
        folder: newFolder,
        name: newName,
        storagePath: originalPath,
      });

      if (apply) {
        let copied = false;
        try {
          const copyResult = await copyStorageObject(originalPath, newStoragePath);
          copied = copyResult.ok;
        } catch (e) {
          copied = false;
        }
        if (!copied && typeof data.content === 'string') {
          await bucket.file(newStoragePath).save(data.content, { contentType: 'text/markdown' });
          copied = true;
        }
        if (!copied) {
          copyFailures++;
        }
        await db.collection('documents').doc(item.id).update({
          name: newName,
          folder: newFolder,
          storagePath: newStoragePath,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      archived++;
    }
  }

  console.log(JSON.stringify({
    totalDocsWithStoragePath: totalDocs,
    duplicateGroups: dupes.length,
    kept,
    archived,
    deleted,
    copyFailures,
    dryRun: !apply,
    strategy,
  }, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
