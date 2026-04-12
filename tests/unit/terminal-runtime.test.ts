import { describe, expect, it } from 'vitest';
import {
  WORKER_DOWNLOAD_PATH,
  buildWorkerQuickInstallCommand,
  buildWorkerRegistrationCommand,
  resolveWorkerDisplayName,
  resolveWorkerDownloadUrl,
  resolveWorkerHubDisplayUrl
} from '@/lib/terminal-runtime';

describe('terminal-runtime helpers', () => {
  it('uses the stable worker download alias', () => {
    expect(resolveWorkerDownloadUrl('https://agora.humanizar.cloud/')).toBe(`https://agora.humanizar.cloud${WORKER_DOWNLOAD_PATH}`);
    expect(resolveWorkerDownloadUrl(undefined)).toBe(WORKER_DOWNLOAD_PATH);
  });

  it('normalizes hub display URLs without stale IP fallbacks', () => {
    expect(resolveWorkerHubDisplayUrl('http://hub.local:3010/')).toBe('http://hub.local:3010');
    expect(resolveWorkerHubDisplayUrl('')).toBe('No configurado');
  });

  it('builds personal worker registration commands consistently', () => {
    expect(buildWorkerRegistrationCommand({
      isPersonalWorkspace: true,
      userId: 'user-1',
      displayName: 'Mi Espacio'
    })).toBe('sudo edu-worker-manager add user-1 --personal --name "Mi Espacio"');
  });

  it('builds shared worker registration commands consistently', () => {
    expect(buildWorkerRegistrationCommand({
      isPersonalWorkspace: false,
      workspaceId: 'ws-42',
      displayName: 'Seminario'
    })).toBe('sudo edu-worker-manager add ws-42 --name "Seminario"');
  });

  it('escapes names in shell commands and composes quick install', () => {
    const registrationCommand = buildWorkerRegistrationCommand({
      isPersonalWorkspace: false,
      workspaceId: 'ws-42',
      displayName: 'Seminario "A"'
    });

    expect(registrationCommand).toContain('\\"A\\"');
    expect(buildWorkerQuickInstallCommand({
      downloadUrl: 'https://agora.humanizar.cloud/downloads/edu-worker.deb',
      registrationCommand
    })).toContain('sudo apt install -y /tmp/edu-worker.deb');
  });

  it('resolves display names pragmatically', () => {
    expect(resolveWorkerDisplayName({
      isPersonalWorkspace: true,
      workspaceName: '',
      userEmail: 'ana@example.com'
    })).toBe('ana@example.com');

    expect(resolveWorkerDisplayName({
      isPersonalWorkspace: false,
      workspaceName: '',
      userEmail: 'ana@example.com'
    })).toBe('Workspace');
  });
});
