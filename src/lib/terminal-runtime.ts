export const WORKER_DOWNLOAD_PATH = '/downloads/edu-worker.deb';
export const UNCONFIGURED_HUB_LABEL = 'No configurado';

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const escapeShellDoubleQuotes = (value: string) => value.replace(/(["\\$`])/g, '\\$1');

export const resolveWorkerDownloadUrl = (origin?: string | null) => {
  const trimmed = origin?.trim();
  if (!trimmed) return WORKER_DOWNLOAD_PATH;
  return `${stripTrailingSlashes(trimmed)}${WORKER_DOWNLOAD_PATH}`;
};

export const resolveWorkerHubDisplayUrl = (nexusUrl?: string | null) => {
  const trimmed = nexusUrl?.trim();
  return trimmed ? stripTrailingSlashes(trimmed) : UNCONFIGURED_HUB_LABEL;
};

export const resolveWorkerDisplayName = (options: {
  isPersonalWorkspace: boolean;
  workspaceName?: string;
  userEmail?: string | null;
}) => {
  const workspaceName = options.workspaceName?.trim();
  if (workspaceName) return workspaceName;
  if (options.isPersonalWorkspace) {
    const userEmail = options.userEmail?.trim();
    if (userEmail) return userEmail;
    return 'Mi Espacio';
  }
  return 'Workspace';
};

export const buildWorkerRegistrationCommand = (options: {
  isPersonalWorkspace: boolean;
  workspaceId?: string;
  userId?: string | null;
  displayName: string;
}) => {
  const targetId = options.isPersonalWorkspace
    ? options.userId || '<userId>'
    : options.workspaceId || '<workspaceId>';
  const modeFlag = options.isPersonalWorkspace ? ' --personal' : '';
  return `sudo edu-worker-manager add ${targetId}${modeFlag} --name "${escapeShellDoubleQuotes(options.displayName)}"`;
};

export const buildWorkerQuickInstallCommand = (options: {
  downloadUrl: string;
  registrationCommand: string;
}) => (
  `curl -fsSL ${options.downloadUrl} -o /tmp/edu-worker.deb && sudo apt install -y /tmp/edu-worker.deb && ${options.registrationCommand}`
);
