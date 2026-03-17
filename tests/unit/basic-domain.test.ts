import {
  getErrorCode,
  getErrorMessage,
  isAbortError,
  withErrorCode
} from '@/lib/error-utils';
import {
  DEFAULT_FOLDER_NAME,
  normalizeFolderPath,
  normalizePath
} from '@/lib/folder-utils';
import {
  SEARCH_KIND_BADGES,
  SEARCH_KIND_LABELS,
  SEARCH_RESULT_KINDS,
  SearchKind,
  isSearchResultKind
} from '@/lib/search/types';
import {
  buildStoragePath,
  buildStoragePrefix,
  ensureMarkdownFileName,
  getStorageBaseName,
  sanitizeFileName
} from '@/lib/storage-path';
import {
  DocumentType,
  isDocumentType
} from '@/types/documents';
import {
  isCancelledMercadoPagoPaymentStatus,
  isPendingMercadoPagoPaymentStatus,
  MercadoPagoPaymentStatus
} from '@/types/payments';
import {
  Plan,
  PLANS,
  canAccessTerminals,
  formatStorageSize,
  getPlanById,
  getStorageLimitMB,
  isPlanId
} from '@/types/subscription';
import {
  PERSONAL_WORKSPACE_ID,
  WorkspaceType,
  isPersonalWorkspaceId,
  isWorkspaceType
} from '@/types/workspace';

describe('basic domain helpers', () => {
  it('validates workspace and document types', () => {
    expect(isWorkspaceType(WorkspaceType.Personal)).toBe(true);
    expect(isWorkspaceType(WorkspaceType.Shared)).toBe(true);
    expect(isWorkspaceType('otro')).toBe(false);

    expect(isPersonalWorkspaceId(undefined)).toBe(true);
    expect(isPersonalWorkspaceId(null)).toBe(true);
    expect(isPersonalWorkspaceId(PERSONAL_WORKSPACE_ID)).toBe(true);
    expect(isPersonalWorkspaceId('workspace-1')).toBe(false);

    expect(isDocumentType(DocumentType.Text)).toBe(true);
    expect(isDocumentType(DocumentType.Board)).toBe(true);
    expect(isDocumentType('desconocido')).toBe(false);
  });

  it('validates payment and subscription helpers', () => {
    expect(isPendingMercadoPagoPaymentStatus(MercadoPagoPaymentStatus.Pending)).toBe(true);
    expect(isPendingMercadoPagoPaymentStatus(MercadoPagoPaymentStatus.InProcess)).toBe(true);
    expect(isPendingMercadoPagoPaymentStatus(MercadoPagoPaymentStatus.Approved)).toBe(false);
    expect(isPendingMercadoPagoPaymentStatus(null)).toBe(false);

    expect(isCancelledMercadoPagoPaymentStatus(MercadoPagoPaymentStatus.Rejected)).toBe(true);
    expect(isCancelledMercadoPagoPaymentStatus(MercadoPagoPaymentStatus.Cancelled)).toBe(true);
    expect(isCancelledMercadoPagoPaymentStatus('approved')).toBe(false);
    expect(isCancelledMercadoPagoPaymentStatus(undefined)).toBe(false);

    expect(isPlanId(Plan.Free)).toBe(true);
    expect(isPlanId(Plan.Pro)).toBe(true);
    expect(isPlanId('custom')).toBe(false);

    expect(canAccessTerminals(Plan.Free)).toBe(false);
    expect(canAccessTerminals(Plan.Pro)).toBe(true);
    expect(canAccessTerminals(Plan.Enterprise)).toBe(true);

    expect(getPlanById(Plan.Basic)).toEqual(PLANS[Plan.Basic]);
    expect(getPlanById('invalid' as Plan)).toEqual(PLANS[Plan.Free]);

    expect(getStorageLimitMB(Plan.Enterprise)).toBe(10240);
    expect(getStorageLimitMB('invalid' as Plan)).toBe(PLANS[Plan.Free].storageLimitMB);

    expect(formatStorageSize(512)).toBe('512 MB');
    expect(formatStorageSize(1024)).toBe('1 GB');
    expect(formatStorageSize(1536)).toBe('1.5 GB');
  });

  it('handles error helpers', () => {
    const nativeError = new Error('fallo');
    const codedError = withErrorCode(nativeError, 'E_TEST');

    expect(getErrorMessage(nativeError)).toBe('fallo');
    expect(getErrorMessage(' mensaje ')).toBe(' mensaje ');
    expect(getErrorMessage({ message: 'desde objeto' })).toBe('desde objeto');
    expect(getErrorMessage({})).toBe('Error desconocido');
    expect(getErrorMessage('', 'fallback')).toBe('fallback');

    expect(getErrorCode(codedError)).toBe('E_TEST');
    expect(getErrorCode({ code: 'OBJ' })).toBe('OBJ');
    expect(getErrorCode({})).toBeUndefined();

    expect(isAbortError(new DOMException('cancelado', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('otro'))).toBe(false);
    expect(codedError.code).toBe('E_TEST');
  });

  it('handles folder and storage helpers', () => {
    expect(DEFAULT_FOLDER_NAME).toBe('No estructurado');
    expect(normalizePath(undefined)).toBe('');
    expect(normalizePath('  unidad  /  tema  //  subtema  ')).toBe('unidad/tema/subtema');
    expect(normalizeFolderPath(undefined)).toBe(DEFAULT_FOLDER_NAME);
    expect(normalizeFolderPath(' carpeta / interna ')).toBe('carpeta/interna');

    expect(sanitizeFileName('a/b\\c.md')).toBe('a_b_c.md');
    expect(ensureMarkdownFileName('nota')).toBe('nota.md');
    expect(ensureMarkdownFileName('NOTA.MD')).toBe('NOTA.MD');
    expect(ensureMarkdownFileName('')).toBe('Sin titulo.md');

    expect(buildStoragePrefix(PERSONAL_WORKSPACE_ID, 'owner-1')).toBe('users/owner-1');
    expect(buildStoragePrefix('workspace-2', 'owner-1')).toBe('workspaces/workspace-2');
    expect(buildStoragePath({
      workspaceId: PERSONAL_WORKSPACE_ID,
      ownerId: 'owner-1',
      fileName: 'nota.md'
    })).toBe('users/owner-1/No estructurado/nota.md');
    expect(buildStoragePath({
      workspaceId: 'workspace-2',
      ownerId: 'owner-1',
      folder: ' curso / tema ',
      fileName: 'nota.md'
    })).toBe('workspaces/workspace-2/curso/tema/nota.md');
    expect(getStorageBaseName('workspaces/workspace-2/curso/tema/nota.md')).toBe('nota.md');
  });

  it('validates semantic search kinds metadata', () => {
    expect(SEARCH_RESULT_KINDS).toEqual([
      SearchKind.Document,
      SearchKind.Concept,
      SearchKind.Fragment,
      SearchKind.Author,
      SearchKind.Work
    ]);
    expect(isSearchResultKind(SearchKind.Document)).toBe(true);
    expect(isSearchResultKind('all')).toBe(false);
    expect(SEARCH_KIND_LABELS[SearchKind.Author]).toBe('Autor');
    expect(SEARCH_KIND_BADGES[SearchKind.Work]).toBe('OBR');
  });
});
