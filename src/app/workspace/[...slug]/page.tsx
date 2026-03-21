'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authFetch } from '@/services/apiClient';
import { normalizePath } from '@/lib/folder-utils';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

type WorkspaceRecord = {
  id: string;
  name?: string;
};

type DocumentRecord = {
  id: string;
  name?: string;
  folder?: string;
  type?: string;
};

const normalizeRelativeMarkdownPath = (value: string) => {
  const parts = value.split('/');
  const normalized: string[] = [];

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return normalized.join('/');
};

const ensureMarkdownCandidateNames = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const candidates = new Set<string>([trimmed]);
  if (/\.(md|markdown|mdown|mkd)$/i.test(trimmed)) {
    candidates.add(trimmed.replace(/\.(md|markdown|mdown|mkd)$/i, ''));
  } else {
    candidates.add(`${trimmed}.md`);
  }
  return Array.from(candidates);
};

const buildWorkspaceAwarePathCandidates = (value: string) => {
  const cleaned = normalizeRelativeMarkdownPath(value.replace(/^\/+/, ''));
  if (!cleaned) return [];

  const segments = cleaned.split('/').filter(Boolean);
  const candidates = new Set<string>();
  const addCandidate = (candidate: string) => {
    const normalized = normalizeRelativeMarkdownPath(candidate);
    if (!normalized) return;
    ensureMarkdownCandidateNames(normalized).forEach((name) => candidates.add(name));
  };

  addCandidate(cleaned);

  if ((segments[0] === 'workspace' || segments[0] === 'workspaces') && segments.length > 2) {
    addCandidate(segments.slice(2).join('/'));
  }

  if (segments.length > 1) {
    addCandidate(segments.slice(1).join('/'));
  }

  return Array.from(candidates);
};

const normalizeWorkspaceName = (value: string) => decodeURIComponent(value).trim().toLowerCase();

const findMatchingDoc = (docs: DocumentRecord[], targetPath: string) => {
  const candidatePaths = new Set(buildWorkspaceAwarePathCandidates(targetPath));
  const candidateNames = new Set([
    ...ensureMarkdownCandidateNames(targetPath.split('/').pop() || '')
  ]);

  return docs.find((doc) => {
    if (!doc || doc.type === 'folder') return false;
    const docName = typeof doc.name === 'string' ? doc.name : '';
    const docFolder = normalizePath(typeof doc.folder === 'string' ? doc.folder : '');
    const docPath = normalizeRelativeMarkdownPath(docFolder ? `${docFolder}/${docName}` : docName);
    return candidatePaths.has(docPath)
      || Array.from(candidatePaths).some((candidatePath) => docPath.endsWith(`/${candidatePath}`) || docPath === candidatePath)
      || candidateNames.has(docName);
  });
};

export default function WorkspacePathResolverPage() {
  const router = useRouter();
  const params = useParams<{ slug?: string[] | string }>();
  const { user, userEmail, loading } = useAuth();
  const [message, setMessage] = useState('Resolviendo referencia...');

  const slug = useMemo(() => {
    if (Array.isArray(params.slug)) return params.slug;
    if (typeof params.slug === 'string') return [params.slug];
    return [];
  }, [params.slug]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (slug.length < 2) {
      setMessage('La referencia no tiene una ruta válida.');
      return;
    }

    let cancelled = false;

    const resolvePath = async () => {
      try {
        const [workspaceSegment, ...pathSegments] = slug.map((part) => decodeURIComponent(part));
        const normalizedWorkspaceSegment = normalizeWorkspaceName(workspaceSegment);
        const targetPath = normalizeRelativeMarkdownPath(pathSegments.join('/'));

        if (!targetPath) {
          setMessage('La referencia no apunta a un archivo.');
          return;
        }

        let workspaceId = workspaceSegment;
        let workspacePool: WorkspaceRecord[] = [];

        if (normalizedWorkspaceSegment !== PERSONAL_WORKSPACE_ID) {
          const search = new URLSearchParams({ ownerId: user.uid });
          if (userEmail) {
            search.set('email', userEmail);
          }

          const workspaceRes = await authFetch(`/api/workspaces?${search.toString()}`, { cache: 'no-store' });
          if (!workspaceRes.ok) {
            setMessage('No se pudo cargar el workspace de la referencia.');
            return;
          }

          const workspaceData = await workspaceRes.json() as { workspaces?: WorkspaceRecord[]; invites?: WorkspaceRecord[] };
          workspacePool = [
            ...(Array.isArray(workspaceData.workspaces) ? workspaceData.workspaces : []),
            ...(Array.isArray(workspaceData.invites) ? workspaceData.invites : [])
          ];

          const matchedWorkspace = workspacePool.find((workspace) => {
            const workspaceName = typeof workspace.name === 'string' ? workspace.name : '';
            return normalizeWorkspaceName(workspaceName) === normalizedWorkspaceSegment || workspace.id === workspaceSegment;
          });

          if (matchedWorkspace) {
            workspaceId = matchedWorkspace.id;
          }
        } else {
          workspaceId = PERSONAL_WORKSPACE_ID;
        }

        const workspaceIdsToSearch = normalizedWorkspaceSegment === PERSONAL_WORKSPACE_ID
          ? [PERSONAL_WORKSPACE_ID]
          : Array.from(new Set([
              ...(workspaceId && workspaceId !== workspaceSegment ? [workspaceId] : []),
              PERSONAL_WORKSPACE_ID,
              ...workspacePool.map((workspace) => workspace.id)
            ]));

        let matchedDoc: DocumentRecord | undefined;
        for (const candidateWorkspaceId of workspaceIdsToSearch) {
          const search = new URLSearchParams({
            workspaceId: candidateWorkspaceId,
            view: 'list',
            excludeContent: 'true'
          });

          const docsRes = await authFetch(`/api/documents?${search.toString()}`, { cache: 'no-store' });
          if (!docsRes.ok) {
            continue;
          }

          const docs = await docsRes.json() as DocumentRecord[];
          matchedDoc = findMatchingDoc(docs, targetPath);
          if (matchedDoc) {
            break;
          }
        }

        if (!matchedDoc) {
          setMessage('No se encontró el archivo referenciado.');
          return;
        }

        if (!cancelled) {
          router.replace(`/editor/${encodeURIComponent(matchedDoc.id)}`);
        }
      } catch (error) {
        console.error('Error resolving workspace path:', error);
        if (!cancelled) {
          setMessage('Ocurrió un error al resolver la referencia.');
        }
      }
    };

    void resolvePath();

    return () => {
      cancelled = true;
    };
  }, [loading, params.slug, router, slug, user, userEmail]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 px-6 text-center text-slate-300">
      <div>
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Agora</div>
        <h1 className="mb-2 text-xl font-semibold text-slate-100">Abriendo referencia…</h1>
        <p className="text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}
