#!/usr/bin/env node
/* eslint-disable no-console */
const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const PAGE_SIZE = Number((argv.find(a => a.startsWith('--page-size=')) || '').split('=')[1]) || 500;

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || '/datos/repos/Personal/ProyectoEducacionCooperativa/EducacionCooperativa/services/worker/packaging/serviceAccountKey.json';
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'udea-filosofia.firebasestorage.app';

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
const getExt = (storagePath) => {
  const idx = storagePath.lastIndexOf('.');
  return idx >= 0 ? storagePath.slice(idx) : '';
};
const parseTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const buildExpectedPath = (data) => {
  const workspaceId = data.workspaceId || 'personal';
  const ownerId = data.ownerId || '';
  const folder = normalizeFolderPath(data.folder || 'No estructurado');
  const prefix = buildStoragePrefix(workspaceId, ownerId);
  const ext = getExt(data.storagePath || '');
  if (ext && ext !== '.md') {
    const safe = sanitizeFileName(data.name || 'Sin titulo');
    return `${prefix}/${folder}/${safe}${ext}`;
  }
  const fileName = ensureMarkdownFileName(data.name || 'Sin titulo');
  return `${prefix}/${folder}/${fileName}`;
};

const copyOrUpload = async (fromPath, toPath, content) => {
  const fromFile = bucket.file(fromPath);
  const toFile = bucket.file(toPath);
  const [exists] = await fromFile.exists();
  if (exists) {
    await fromFile.copy(toFile);
    return 'copied';
  }
  if (typeof content === 'string') {
    await toFile.save(content, { contentType: 'text/markdown' });
    return 'uploaded';
  }
  return 'missing';
};

(async () => {
  let totalDocs = 0;
  let mismatches = 0;
  let fixed = 0;
  let skippedConflict = 0;
  let storageMissing = 0;
  let uploaded = 0;
  let copied = 0;
  let updated = 0;

  const noStorageDocs = [];

  let query = db.collection('documents').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
  let lastDoc = null;
  while (true) {
    const snap = await query.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      totalDocs++;

      const storagePath = data.storagePath || '';
      if (!storagePath) {
        noStorageDocs.push({ id: docSnap.id, data });
        continue;
      }

      const expected = buildExpectedPath(data);
      if (expected !== storagePath) {
        mismatches++;
        if (!apply) continue;

        const existing = await db.collection('documents').where('storagePath', '==', expected).get();
        if (!existing.empty) {
          skippedConflict++;
          continue;
        }

        const status = await copyOrUpload(storagePath, expected, data.content);
        if (status === 'missing') storageMissing++;
        if (status === 'uploaded') uploaded++;
        if (status === 'copied') copied++;

        await db.collection('documents').doc(docSnap.id).update({
          storagePath: expected,
          folder: normalizeFolderPath(data.folder || 'No estructurado'),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updated++;
        fixed++;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    query = db.collection('documents')
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(lastDoc)
      .limit(PAGE_SIZE);
  }

  // Deduplicate docs without storagePath by name+folder
  let noStorageDupes = 0;
  let noStorageArchived = 0;
  if (noStorageDocs.length) {
    const map = new Map();
    for (const item of noStorageDocs) {
      const data = item.data;
      const workspaceId = data.workspaceId || 'personal';
      const ownerId = data.ownerId || '';
      const folder = normalizeFolderPath(data.folder || 'No estructurado');
      const nameKey = String(data.name || '').trim().toLowerCase();
      const scopeKey = workspaceId === 'personal'
        ? `personal:${ownerId || 'unknown'}`
        : `workspace:${workspaceId}`;
      const key = `${scopeKey}|${folder}|${nameKey}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }

    for (const list of map.values()) {
      if (list.length < 2) continue;
      noStorageDupes++;
      const sorted = list.slice().sort((a, b) => {
        const aTs = parseTimestamp(a.data.updatedAt) || parseTimestamp(a.data.createdAt);
        const bTs = parseTimestamp(b.data.updatedAt) || parseTimestamp(b.data.createdAt);
        return bTs - aTs;
      });
      const keep = sorted[0];
      for (const item of sorted.slice(1)) {
        const data = item.data;
        const folder = normalizeFolderPath(data.folder || 'No estructurado');
        const newFolder = `Duplicados/${folder}`;
        const newName = `${data.name || 'Sin titulo'}__dup__${item.id.slice(0, 6)}`;
        if (apply) {
          await db.collection('documents').doc(item.id).update({
            name: newName,
            folder: newFolder,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        noStorageArchived++;
      }
      void keep;
    }
  }

  console.log(JSON.stringify({
    dryRun: !apply,
    totalDocs,
    mismatches,
    fixed,
    updated,
    skippedConflict,
    copied,
    uploaded,
    storageMissing,
    noStorageDocs: noStorageDocs.length,
    noStorageDupes,
    noStorageArchived,
  }, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
