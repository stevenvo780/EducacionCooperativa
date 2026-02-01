import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { requireAuth, isWorkspaceMember } from '@/lib/server-auth';
import { bufferToMarkdown, canConvertToMarkdown } from '@/lib/markdownConversion';
import { normalizeFolderPath } from '@/lib/folder-utils';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const parseBoolean = (value: FormDataEntryValue | null | undefined, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo supera 50MB' }, { status: 413 });
    }

    const workspaceIdInput = formData.get('workspaceId');
    const workspaceId = typeof workspaceIdInput === 'string' && workspaceIdInput.trim() ? workspaceIdInput : 'personal';

    if (workspaceId !== 'personal') {
      const member = await isWorkspaceMember(workspaceId, auth.uid);
      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const folderInput = formData.get('folder');
    const folder = typeof folderInput === 'string' ? normalizeFolderPath(folderInput) : normalizeFolderPath();

    if (!canConvertToMarkdown(file.type, file.name)) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado para conversión' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const conversion = await bufferToMarkdown(buffer, { mimeType: file.type, fileName: file.name });

    const shouldCreate = parseBoolean(formData.get('createDocument'), true);
    const persistOriginal = parseBoolean(formData.get('persistOriginal'), true);
    const ownerId = auth.uid;

    let sourceStoragePath: string | null = null;
    let sourceUrl: string | null = null;

    if (persistOriginal) {
      const bucket = adminStorage.bucket();
      if (!bucket?.name) {
        throw new Error('Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID');
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const prefix = workspaceId === 'personal' ? `users/${ownerId}` : `workspaces/${workspaceId}`;
      sourceStoragePath = `${prefix}/${safeName}`;
      const fileRef = bucket.file(sourceStoragePath);
      await fileRef.save(buffer, {
        contentType: file.type || 'application/octet-stream',
        metadata: {
          metadata: {
            ownerId
          }
        }
      });
      const [url] = await fileRef.getSignedUrl({ action: 'read', expires: '03-01-2500' });
      sourceUrl = url;
    }

    let createdDoc: Record<string, unknown> | null = null;

    if (shouldCreate) {
      const docRef = await adminDb.collection('documents').add({
        name: conversion.suggestedName,
        type: 'text',
        content: conversion.markdown,
        mimeType: 'text/markdown',
        ownerId,
        workspaceId,
        folder,
        sourceName: file.name,
        sourceMimeType: file.type || null,
        sourceStoragePath,
        sourceUrl,
        sourceFormat: conversion.sourceFormat,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      createdDoc = {
        id: docRef.id,
        name: conversion.suggestedName,
        type: 'text',
        mimeType: 'text/markdown',
        ownerId,
        workspaceId,
        folder,
        sourceName: file.name,
        sourceMimeType: file.type || null,
        sourceStoragePath,
        sourceUrl,
        updatedAt: { seconds: Date.now() / 1000 }
      };
    }

    return NextResponse.json({
      markdown: conversion.markdown,
      suggestedName: conversion.suggestedName,
      createdDoc
    });
  } catch (error: any) {
    console.error('Error al convertir a markdown:', error);
    return NextResponse.json({ error: error.message ?? 'Error inesperado' }, { status: 500 });
  }
}
