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

const buildPathForName = ({ workspaceId, ownerId, folder, name, storagePath }) => {
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
  const groups = new Map();

  let query = db.collection('documents').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
  let lastDoc = null;
  while (true) {
    const snap = await query.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      totalDocs++;

      const workspaceId = data.workspaceId || 'personal';
      const ownerId = data.ownerId || '';
      const folder = normalizeFolderPath(data.folder || 'No estructurado');
      const nameKey = String(data.name || '').trim().toLowerCase();
      const scopeKey = workspaceId === 'personal'
        ? `personal:${ownerId || 'unknown'}`
        : `workspace:${workspaceId}`;
      const key = `${scopeKey}|${folder}|${nameKey}`;

      const list = groups.get(key) || [];
      list.push({ id: docSnap.id, data });
      groups.set(key, list);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    query = db.collection('documents')
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(lastDoc)
      .limit(PAGE_SIZE);
  }

  let dupGroups = 0;
  let archived = 0;
  let keepUpdated = 0;
  let copied = 0;
  let uploaded = 0;
  let missingStorage = 0;
  let conflicts = 0;

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    dupGroups++;

    const sorted = list.slice().sort((a, b) => {
      const aTs = parseTimestamp(a.data.updatedAt) || parseTimestamp(a.data.createdAt);
      const bTs = parseTimestamp(b.data.updatedAt) || parseTimestamp(b.data.createdAt);
      return bTs - aTs;
    });
    const keep = sorted[0];

    // Archive older items first
    for (const item of sorted.slice(1)) {
      const data = item.data;
      const workspaceId = data.workspaceId || 'personal';
      const ownerId = data.ownerId || '';
      const folder = normalizeFolderPath(data.folder || 'No estructurado');
      const newFolder = `Duplicados/${folder}`;
      const newName = `${data.name || 'Sin titulo'}__dup__${item.id.slice(0, 6)}`;
      const hasStorage = Boolean(data.storagePath);
      const newStoragePath = hasStorage
        ? buildPathForName({
          workspaceId,
          ownerId,
          folder: newFolder,
          name: newName,
          storagePath: data.storagePath,
        })
        : '';

      if (apply) {
        if (hasStorage) {
          const status = await copyOrUpload(data.storagePath, newStoragePath, data.content);
          if (status === 'copied') copied++;
          if (status === 'uploaded') uploaded++;
          if (status === 'missing') missingStorage++;
        }
        await db.collection('documents').doc(item.id).update({
          name: newName,
          folder: newFolder,
          storagePath: hasStorage ? newStoragePath : '',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      archived++;
    }

    // Normalize keep storagePath if needed
    const keepData = keep.data;
    if (keepData.storagePath) {
      const expected = buildPathForName({
        workspaceId: keepData.workspaceId || 'personal',
        ownerId: keepData.ownerId || '',
        folder: keepData.folder || 'No estructurado',
        name: keepData.name || 'Sin titulo',
        storagePath: keepData.storagePath,
      });
      if (expected !== keepData.storagePath) {
        if (apply) {
          const existing = await db.collection('documents').where('storagePath', '==', expected).get();
          if (!existing.empty) {
            conflicts++;
          } else {
            const status = await copyOrUpload(keepData.storagePath, expected, keepData.content);
            if (status === 'copied') copied++;
            if (status === 'uploaded') uploaded++;
            if (status === 'missing') missingStorage++;
            await db.collection('documents').doc(keep.id).update({
              storagePath: expected,
              folder: normalizeFolderPath(keepData.folder || 'No estructurado'),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            keepUpdated++;
          }
        }
      }
    }
  }

  console.log(JSON.stringify({
    dryRun: !apply,
    totalDocs,
    dupGroups,
    archived,
    keepUpdated,
    copied,
    uploaded,
    missingStorage,
    conflicts,
  }, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
