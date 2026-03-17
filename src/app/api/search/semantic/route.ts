import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { buildSemanticSearchResults, type SearchableDocument } from '@/lib/search/rank';
import { isSearchResultKind, type SearchResultKind, type SemanticSearchRequest } from '@/lib/search/types';
import { isWorkspaceMember, requireAuth } from '@/lib/server-auth';

const MAX_SCAN_DOCS = 500;
const DEFAULT_LIMIT = 18;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await req.json()) as Partial<SemanticSearchRequest>;
    const workspaceId = typeof body.workspaceId === 'string' && body.workspaceId.trim()
      ? body.workspaceId.trim()
      : 'personal';
    const query = typeof body.query === 'string' ? body.query : '';
    const limit = typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT;
    const offset = typeof body.offset === 'number' ? body.offset : 0;
    const kinds = Array.isArray(body.kinds)
      ? body.kinds.filter((kind): kind is SearchResultKind => typeof kind === 'string' && isSearchResultKind(kind))
      : undefined;

    let queryRef: FirebaseFirestore.Query = adminDb.collection('documents');

    if (workspaceId !== 'personal') {
      const member = await isWorkspaceMember(workspaceId, auth.uid);
      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      queryRef = queryRef.where('workspaceId', '==', workspaceId);
    } else {
      queryRef = queryRef.where('ownerId', '==', auth.uid).where('workspaceId', '==', 'personal');
    }

    const snapshot = await queryRef.limit(MAX_SCAN_DOCS).get();
    const rawDocs = snapshot.docs.map(doc => (
      { id: doc.id, ...(doc.data() as Record<string, unknown>) } as Record<string, unknown> & { id: string }
    ));
    const docs = rawDocs
      .filter(item => item.type !== 'folder' && item.type !== 'terminal' && item.type !== 'files' && item.type !== 'board')
      .map(item => ({
        id: item.id,
        name: typeof item.name === 'string' ? item.name : 'Sin titulo',
        type: item.type as SearchableDocument['type'],
        content: typeof item.content === 'string' ? item.content : '',
        folder: typeof item.folder === 'string' ? item.folder : '',
        workspaceId: typeof item.workspaceId === 'string' ? item.workspaceId : workspaceId,
        mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
        url: typeof item.url === 'string' ? item.url : undefined,
        storagePath: typeof item.storagePath === 'string' ? item.storagePath : undefined,
        ownerId: typeof item.ownerId === 'string' ? item.ownerId : auth.uid,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        size: typeof item.size === 'number' ? item.size : undefined
      } satisfies SearchableDocument));

    const { results, totalCandidates, offset: resultOffset, hasMore } = buildSemanticSearchResults({
      docs,
      query,
      limit,
      offset,
      kinds
    });

    return NextResponse.json({
      results,
      meta: {
        query,
        workspaceId,
        scannedDocuments: docs.length,
        totalCandidates,
        offset: resultOffset,
        hasMore,
        mode: 'heuristic-v1'
      }
    });
  } catch (error: any) {
    console.error('Error semantic search:', error);
    return NextResponse.json({ error: error.message ?? 'Search error' }, { status: 500 });
  }
}
