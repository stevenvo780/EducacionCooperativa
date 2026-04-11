import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { SearchState } from './types';

interface UseEditorSearchOptions {
  externalSearchTerm?: string;
  onSearchStateChange?: (state: SearchState) => void;
  searchNavRef?: React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
}

export function useEditorSearch({
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef
}: UseEditorSearchOptions) {
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const lastReportedSearchStateRef = useRef<SearchState | null>(null);

  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

  const navigateSearch = useCallback((direction: 'next' | 'prev') => {
    if (totalMatches === 0) return;
    setCurrentMatch(prev => {
      let next = direction === 'next' ? prev + 1 : prev - 1;
      if (next >= totalMatches) next = 0;
      if (next < 0) next = totalMatches - 1;
      return next;
    });
  }, [totalMatches]);

  // Notify parent of search state changes
  useEffect(() => {
    if (!onSearchStateChange) return;
    const nextState = { currentMatch, totalMatches };
    const prev = lastReportedSearchStateRef.current;
    if (prev && prev.currentMatch === nextState.currentMatch && prev.totalMatches === nextState.totalMatches) {
      return;
    }
    lastReportedSearchStateRef.current = nextState;
    onSearchStateChange(nextState);
  }, [currentMatch, totalMatches, onSearchStateChange]);

  // Expose navigation to parent via ref
  useEffect(() => {
    if (!searchNavRef) return;
    searchNavRef.current = {
      next: () => navigateSearch('next'),
      prev: () => navigateSearch('prev')
    };
    return () => {
      searchNavRef.current = null;
    };
  }, [searchNavRef, totalMatches, navigateSearch]);

  return {
    searchTerm,
    setSearchTerm: setInternalSearchTerm,
    currentMatch,
    setCurrentMatch,
    totalMatches,
    setTotalMatches,
    navigateSearch
  };
}
