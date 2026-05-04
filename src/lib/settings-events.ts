export const OPEN_SETTINGS_EVENT = 'agora:open-settings' as const;

export type SettingsSectionId = 'editor-md' | 'editor-st' | 'semantic' | 'ai' | 'linter' | 'cuenta' | 'git-access';

export interface OpenSettingsEventDetail {
  section?: SettingsSectionId;
}

const SETTINGS_SECTIONS = new Set<SettingsSectionId>([
  'editor-md',
  'editor-st',
  'semantic',
  'ai',
  'linter',
  'cuenta',
  'git-access'
]);

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return typeof value === 'string' && SETTINGS_SECTIONS.has(value as SettingsSectionId);
}

export function dispatchOpenSettings(section: SettingsSectionId = 'editor-md') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenSettingsEventDetail>(OPEN_SETTINGS_EVENT, {
    detail: { section }
  }));
}
