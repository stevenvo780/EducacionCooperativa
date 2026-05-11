import { describe, expect, it, beforeEach } from 'vitest';
import { purgeUserScopedStorage } from '@/lib/auth-storage-purge';

describe('purgeUserScopedStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('elimina claves que matchean prefijos del user previo', () => {
    window.localStorage.setItem('dashboard_state_ws1', '{"a":1}');
    window.localStorage.setItem('dashboard_favorites_uid123', '["doc-1"]');
    window.localStorage.setItem('agora_user_email', 'old@example.com');
    window.localStorage.setItem('agora-ai-chats:current', 'chat-1');
    window.localStorage.setItem('editor-fullscreen', '1');
    window.localStorage.setItem('workspace-last', 'ws1');
    window.localStorage.setItem('semantic-cache', 'x');
    window.localStorage.setItem('agora_user', '{"uid":"old"}');
    window.localStorage.setItem('agora_local_dev_token', 'tok');
    window.localStorage.setItem('linter_personal_dictionary', '["foo"]');

    purgeUserScopedStorage();

    expect(window.localStorage.getItem('dashboard_state_ws1')).toBeNull();
    expect(window.localStorage.getItem('dashboard_favorites_uid123')).toBeNull();
    expect(window.localStorage.getItem('agora_user_email')).toBeNull();
    expect(window.localStorage.getItem('agora-ai-chats:current')).toBeNull();
    expect(window.localStorage.getItem('editor-fullscreen')).toBeNull();
    expect(window.localStorage.getItem('workspace-last')).toBeNull();
    expect(window.localStorage.getItem('semantic-cache')).toBeNull();
    expect(window.localStorage.getItem('agora_user')).toBeNull();
    expect(window.localStorage.getItem('agora_local_dev_token')).toBeNull();
    expect(window.localStorage.getItem('linter_personal_dictionary')).toBeNull();
  });

  it('preserva claves que NO pertenecen al user (theme, locale, firebase SDK)', () => {
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('locale', 'es');
    window.localStorage.setItem('firebase:host:udea-filosofia', '{}');
    window.localStorage.setItem('firebase:authUser:apikey:[DEFAULT]', '{}');

    purgeUserScopedStorage();

    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(window.localStorage.getItem('locale')).toBe('es');
    expect(window.localStorage.getItem('firebase:host:udea-filosofia')).toBe('{}');
    expect(window.localStorage.getItem('firebase:authUser:apikey:[DEFAULT]')).toBe('{}');
  });

  it('no falla si localStorage está vacío', () => {
    expect(() => purgeUserScopedStorage()).not.toThrow();
  });
});
