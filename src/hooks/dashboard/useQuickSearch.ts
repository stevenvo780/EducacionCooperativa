'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { semanticSearchApi } from '@/services/searchApi';
import { ALL_SEARCH_RESULT_FILTER, SearchKind, type SearchResultFilter, type SearchResultItem } from '@/lib/search/types';
import type { DocItem } from '@/components/dashboard/types';

interface UseQuickSearchOptions {
    showQuickSearch: boolean;
    quickSearchQuery: string;
    quickSearchIndex: number;
    currentWorkspaceId: string | undefined;
    docs: DocItem[];
    setShowQuickSearch: (value: boolean) => void;
    setQuickSearchQuery: (value: string) => void;
    setQuickSearchIndex: (value: number) => void;
    onSelectDoc: (doc: DocItem) => Promise<void>;
}

interface UseQuickSearchResult {
    quickSearchInputRef: React.RefObject<HTMLInputElement>;
    semanticSearchResults: SearchResultItem[];
    semanticSearchLoading: boolean;
    semanticSearchError: string | null;
    quickSearchFilter: SearchResultFilter;
    setQuickSearchFilter: (filter: SearchResultFilter) => void;
    quickSearchResults: SearchResultItem[];
    closeQuickSearch: () => void;
    handleQuickSearchSelect: (result: SearchResultItem) => Promise<void>;
    handleQuickSearchKeyDown: (e: ReactKeyboardEvent) => void;
}

export function useQuickSearch({
    showQuickSearch,
    quickSearchQuery,
    quickSearchIndex,
    currentWorkspaceId,
    docs,
    setShowQuickSearch,
    setQuickSearchQuery,
    setQuickSearchIndex,
    onSelectDoc
}: UseQuickSearchOptions): UseQuickSearchResult {
    const quickSearchInputRef = useRef<HTMLInputElement>(null);
    const deferredQuickSearchQuery = useDeferredValue(quickSearchQuery);

    const [semanticSearchResults, setSemanticSearchResults] = useState<SearchResultItem[]>([]);
    const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);
    const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);
    const [quickSearchFilter, setQuickSearchFilter] = useState<SearchResultFilter>(ALL_SEARCH_RESULT_FILTER);

    const buildLocalQuickSearchFallback = useCallback((query: string): SearchResultItem[] => {
        const normalizedQuery = query.trim().toLowerCase();
        const fallbackDocs = docs
            .filter(doc => doc.type !== 'folder')
            .filter(doc => {
                if (!normalizedQuery) return true;
                const name = doc.name.toLowerCase();
                const folder = (doc.folder || '').toLowerCase();
                return name.includes(normalizedQuery) || folder.includes(normalizedQuery);
            })
            .slice(0, normalizedQuery ? 12 : 8);

        return fallbackDocs.map((doc, index) => ({
            id: `fallback-document:${doc.id}:${index}`,
            kind: SearchKind.Document,
            title: doc.name,
            subtitle: doc.folder || 'Raiz del espacio',
            preview: doc.mimeType || 'Documento',
            badge: 'DOC',
            score: fallbackDocs.length - index,
            matchedTerms: normalizedQuery ? [normalizedQuery] : [],
            sourceDoc: {
                id: doc.id,
                name: doc.name,
                type: doc.type,
                folder: doc.folder,
                workspaceId: doc.workspaceId,
                mimeType: doc.mimeType,
                url: doc.url,
                storagePath: doc.storagePath,
                ownerId: doc.ownerId,
                updatedAt: doc.updatedAt,
                size: doc.size
            }
        }));
    }, [docs]);

    useEffect(() => {
        if (!showQuickSearch || !currentWorkspaceId) {
            setSemanticSearchLoading(false);
            return;
        }

        const controller = new AbortController();
        const query = deferredQuickSearchQuery.trim();
        const timeout = setTimeout(() => {
            setSemanticSearchLoading(true);
            setSemanticSearchError(null);

            semanticSearchApi(
                { query, workspaceId: currentWorkspaceId, limit: 18 },
                { signal: controller.signal }
            )
                .then(data => {
                    if (controller.signal.aborted) return;
                    setSemanticSearchResults(data.results);
                })
                .catch(error => {
                    if (controller.signal.aborted) return;
                    const aborted = error instanceof DOMException && error.name === 'AbortError';
                    if (aborted) return;
                    setSemanticSearchError('Se mostró una búsqueda local de respaldo porque el índice semántico no respondió.');
                    setSemanticSearchResults(buildLocalQuickSearchFallback(query));
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setSemanticSearchLoading(false);
                    }
                });
        }, query ? 140 : 0);

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [buildLocalQuickSearchFallback, currentWorkspaceId, deferredQuickSearchQuery, showQuickSearch]);

    const quickSearchResults = useMemo(() => {
        if (quickSearchFilter === ALL_SEARCH_RESULT_FILTER) return semanticSearchResults;
        return semanticSearchResults.filter(result => result.kind === quickSearchFilter);
    }, [quickSearchFilter, semanticSearchResults]);

    const closeQuickSearch = useCallback(() => {
        setShowQuickSearch(false);
        setQuickSearchQuery('');
        setQuickSearchIndex(0);
    }, [setQuickSearchIndex, setQuickSearchQuery, setShowQuickSearch]);

    const handleQuickSearchSelect = useCallback(async (result: SearchResultItem) => {
        const docFromState = docs.find(item => item.id === result.sourceDoc.id);
        const sourceDoc = docFromState ?? result.sourceDoc as DocItem;
        await onSelectDoc(sourceDoc);
        closeQuickSearch();
    }, [closeQuickSearch, docs, onSelectDoc]);

    const handleQuickSearchKeyDown = useCallback((e: ReactKeyboardEvent) => {
        if (e.key === 'ArrowDown' && quickSearchResults.length > 0) {
            e.preventDefault();
            setQuickSearchIndex(Math.min(quickSearchIndex + 1, quickSearchResults.length - 1));
        } else if (e.key === 'ArrowUp' && quickSearchResults.length > 0) {
            e.preventDefault();
            setQuickSearchIndex(Math.max(quickSearchIndex - 1, 0));
        } else if (e.key === 'Enter' && quickSearchResults[quickSearchIndex]) {
            e.preventDefault();
            void handleQuickSearchSelect(quickSearchResults[quickSearchIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeQuickSearch();
        }
    }, [closeQuickSearch, handleQuickSearchSelect, quickSearchIndex, quickSearchResults, setQuickSearchIndex]);

    useEffect(() => {
        if (!showQuickSearch) return;
        if (quickSearchResults.length === 0 && quickSearchIndex !== 0) {
            setQuickSearchIndex(0);
            return;
        }
        if (quickSearchIndex >= quickSearchResults.length && quickSearchResults.length > 0) {
            setQuickSearchIndex(quickSearchResults.length - 1);
        }
    }, [quickSearchIndex, quickSearchResults, setQuickSearchIndex, showQuickSearch]);

    return {
        quickSearchInputRef,
        semanticSearchResults,
        semanticSearchLoading,
        semanticSearchError,
        quickSearchFilter,
        setQuickSearchFilter,
        quickSearchResults,
        closeQuickSearch,
        handleQuickSearchSelect,
        handleQuickSearchKeyDown
    };
}
