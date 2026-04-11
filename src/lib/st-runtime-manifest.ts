import {
  ST_RUNTIME_MANIFEST,
  type STRuntimeManifest,
  type STRuntimeProfileManifest
} from '@/generated/st-runtime-manifest';

export { ST_RUNTIME_MANIFEST };
export type { STRuntimeManifest, STRuntimeProfileManifest };

export const ST_RUNTIME_VERSION = ST_RUNTIME_MANIFEST.canonicalVersion;
export const ST_RUNTIME_PACKAGE_VERSION = ST_RUNTIME_MANIFEST.packageVersion;
export const ST_RUNTIME_CLI_VERSION = ST_RUNTIME_MANIFEST.cliVersion;
export const ST_RUNTIME_PROFILE_IDS = [...ST_RUNTIME_MANIFEST.profileIds];
export const ST_RUNTIME_PROFILES: Array<{ id: string; label: string; detail: string; insertText: string }> =
  [...ST_RUNTIME_MANIFEST.profiles].map(
    ({ id, label, detail, insertText }) => ({ id, label, detail, insertText })
  );
export const ST_RUNTIME_KEYWORDS = [...ST_RUNTIME_MANIFEST.keywords];
export const ST_RUNTIME_VALIDATED_COMMANDS = [...ST_RUNTIME_MANIFEST.validatedCommands];

export const ST_RUNTIME_PROFILE_OPTIONS = ST_RUNTIME_PROFILES.map((profile) => ({
  value: profile.id,
  label: profile.detail
    ? `${profile.id} · ${profile.detail}`
    : profile.id,
  shortLabel: profile.id
}));

export const getRuntimeProfileManifest = (profileId: string) => (
  ST_RUNTIME_PROFILES.find((profile) => profile.id === profileId) ?? null
);

export const getRuntimeCommandManifest = (label: string) => (
  ST_RUNTIME_VALIDATED_COMMANDS.find((command) => command === label) ?? null
);
