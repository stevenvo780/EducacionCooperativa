'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { Workspace } from '@/components/dashboard/types';
import { fetchWorkspacesApi } from '@/services/dashboardApi';
import { normalizeWorkspace } from '@/services/dashboardUtils';
import type { User as FirebaseUser } from 'firebase/auth';
import { PERSONAL_WORKSPACE_ID, WorkspaceType } from '@/types/workspace';

interface RouterLike {
  replace: (href: string, options?: { scroll?: boolean }) => void;
}

interface UseDashboardWorkspacesParams {
  user: FirebaseUser | null;
  userEmail?: string | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | undefined;
  requestedWorkspaceId: string | null;
  router: RouterLike;
  searchParams: ReadonlyURLSearchParams | null;
  personalWorkspaceId: string;
  setWorkspaces: (value: Workspace[]) => void;
  setInvites: (value: Workspace[]) => void;
  setCurrentWorkspace: (value: Workspace | null) => void;
  subscribeToWorkspace: (workspaceToken: string) => void;
}

export const useDashboardWorkspaces = ({
  user,
  userEmail,
  workspaces,
  currentWorkspace,
  currentWorkspaceId,
  requestedWorkspaceId,
  router,
  searchParams,
  personalWorkspaceId,
  setWorkspaces,
  setInvites,
  setCurrentWorkspace,
  subscribeToWorkspace
}: UseDashboardWorkspacesParams) => {
  const urlSyncInProgressRef = useRef(false);
  const lastSubscribedWorkspaceRef = useRef<string | null>(null);
  const requestedWorkspaceIdRef = useRef<string | null>(requestedWorkspaceId);
  const currentWorkspaceRef = useRef<Workspace | null>(currentWorkspace);

  useEffect(() => {
    requestedWorkspaceIdRef.current = requestedWorkspaceId;
  }, [requestedWorkspaceId]);

  useEffect(() => {
    currentWorkspaceRef.current = currentWorkspace;
  }, [currentWorkspace]);

  useEffect(() => {
    if (!user || !currentWorkspace) return;
    const workerToken = currentWorkspace.type === WorkspaceType.Personal || currentWorkspace.id === personalWorkspaceId
      ? `${PERSONAL_WORKSPACE_ID}:${user.uid}`
      : currentWorkspace.id;
    if (lastSubscribedWorkspaceRef.current === workerToken) return;
    lastSubscribedWorkspaceRef.current = workerToken;
    subscribeToWorkspace(workerToken);
  }, [user, currentWorkspace, personalWorkspaceId, subscribeToWorkspace]);

  const selectWorkspace = useCallback((workspace: Workspace | null) => {
    if (!workspace) {
      setCurrentWorkspace(null);
      return;
    }

    urlSyncInProgressRef.current = true;
    currentWorkspaceRef.current = workspace;
    setCurrentWorkspace(workspace);
  }, [setCurrentWorkspace]);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;

    const personalSpace: Workspace = {
      id: personalWorkspaceId,
      name: 'Espacio Personal',
      ownerId: user.uid,
      members: [user.uid],
      type: WorkspaceType.Personal
    };

    let fetched: Workspace[] = [];
    let fetchedInvites: Workspace[] = [];
    try {
      const data = await fetchWorkspacesApi({ ownerId: user.uid, email: userEmail || undefined });
      fetched = data.workspaces.map(normalizeWorkspace);
      fetchedInvites = data.invites.map(normalizeWorkspace);
    } catch (error) {
      console.error('Error fetching workspaces', error);
    }

    const allWorkspaces = [personalSpace, ...fetched.filter(ws => ws.id !== personalWorkspaceId)];
    setWorkspaces(allWorkspaces);
    setInvites(fetchedInvites);

    const previousWorkspace = currentWorkspaceRef.current;
    const requestedId = requestedWorkspaceIdRef.current;
    const resolvedWorkspace = (() => {
      if (requestedId) {
        const requestedWorkspace = allWorkspaces.find(ws => ws.id === requestedId);
        if (requestedWorkspace) return requestedWorkspace;
      }
      if (previousWorkspace) {
        return allWorkspaces.find(ws => ws.id === previousWorkspace.id) ?? personalSpace;
      }
      return personalSpace;
    })();

    if (previousWorkspace?.id !== resolvedWorkspace.id) {
      setCurrentWorkspace(resolvedWorkspace);
    }
  }, [user, userEmail, personalWorkspaceId, setCurrentWorkspace, setInvites, setWorkspaces]);

  useEffect(() => {
    if (urlSyncInProgressRef.current) return;
    if (!requestedWorkspaceId || workspaces.length === 0) return;
    if (currentWorkspace?.id === requestedWorkspaceId) return;
    const matchingWorkspace = workspaces.find(ws => ws.id === requestedWorkspaceId);
    if (matchingWorkspace) {
      setCurrentWorkspace(matchingWorkspace);
    }
  }, [requestedWorkspaceId, workspaces, currentWorkspace?.id, setCurrentWorkspace]);

  const currentSearchParams = searchParams?.toString() ?? '';

  useEffect(() => {
    if (!currentWorkspaceId) return;

    const currentParam = searchParams?.get('workspaceId') || '';
    if (currentParam === currentWorkspaceId) return;

    urlSyncInProgressRef.current = true;
    const params = new URLSearchParams(currentSearchParams);
    params.set('workspaceId', currentWorkspaceId);
    params.delete('workspace');
    const query = params.toString();
    const nextUrl = query ? `/dashboard?${query}` : '/dashboard';
    router.replace(nextUrl, { scroll: false });

    const timeoutId = setTimeout(() => {
      urlSyncInProgressRef.current = false;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentWorkspaceId, currentSearchParams, router, searchParams]);

  return {
    fetchWorkspaces,
    selectWorkspace
  };
};
