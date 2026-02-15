'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Table2,
  X,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { downloadDocumentBlobApi } from '@/services/dashboardApi';
import { loadXlsx, parseCsv, detectDelimiter } from '@/lib/clientMarkdownConversion';

interface SheetData {
  name: string;
  rows: string[][];
  headers: string[];
}

interface SpreadsheetViewerProps {
  docId: string;
  docName: string;
}

type SortDir = 'asc' | 'desc' | null;

const PAGE_SIZE = 100;

const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({ docId, docName }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const ext = useMemo(() => {
    const parts = docName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }, [docName]);

  // Fetch and parse the file
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { blob } = await downloadDocumentBlobApi(docId);

        if (cancelled) return;

        if (ext === 'csv' || ext === 'tsv') {
          const text = await blob.text();
          const delimiter = ext === 'tsv' ? '\t' : detectDelimiter(text);
          const rows = parseCsv(text, delimiter);

          if (rows.length === 0) {
            setSheets([{ name: 'Datos', headers: [], rows: [] }]);
          } else {
            const headers = rows[0];
            const dataRows = rows.slice(1);
            setSheets([{ name: 'Datos', headers, rows: dataRows }]);
          }
        } else {
          // Excel (xlsx/xls)
          const XLSX = await loadXlsx();
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });

          const parsedSheets: SheetData[] = workbook.SheetNames.map(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const raw: string[][] = XLSX.utils.sheet_to_json<string[]>(sheet, {
              header: 1,
              defval: '',
              blankrows: false
            });

            const maxCols = Math.max(...raw.map(r => r.length), 0);
            const normalized = raw.map(row => {
              const padded = row.map(cell => String(cell ?? ''));
              while (padded.length < maxCols) padded.push('');
              return padded;
            });

            if (normalized.length === 0) {
              return { name: sheetName, headers: [], rows: [] };
            }

            return {
              name: sheetName,
              headers: normalized[0],
              rows: normalized.slice(1)
            };
          });

          setSheets(parsedSheets);
        }
      } catch (err) {
        console.error('SpreadsheetViewer fetch error:', err);
        if (!cancelled) setError('No se pudo cargar el archivo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [docId, ext]);

  // Reset pagination/sort on sheet change
  useEffect(() => {
    setPage(0);
    setSortCol(null);
    setSortDir(null);
    setSearchQuery('');
  }, [activeSheet]);

  const currentSheet = sheets[activeSheet] ?? null;

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!currentSheet) return [];
    if (!searchQuery.trim()) return currentSheet.rows;
    const q = searchQuery.toLowerCase();
    return currentSheet.rows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(q))
    );
  }, [currentSheet, searchQuery]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortCol === null || sortDir === null) return filteredRows;
    const col = sortCol;
    const dir = sortDir;
    return [...filteredRows].sort((a, b) => {
      const valA = a[col] ?? '';
      const valB = b[col] ?? '';
      // Try numeric sort
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
        return dir === 'asc' ? numA - numB : numB - numA;
      }
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  // Paginated rows
  const totalPages = Math.max(Math.ceil(sortedRows.length / PAGE_SIZE), 1);
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const handleSort = useCallback((colIndex: number) => {
    if (sortCol === colIndex) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortCol(colIndex);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortCol, sortDir]);

  const handleDownloadOriginal = useCallback(async () => {
    try {
      const { blob } = await downloadDocumentBlobApi(docId);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
    }
  }, [docId, docName]);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-surface-900 text-surface-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-mandy-400" />
        <span className="text-sm">Cargando hoja de cálculo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-surface-900 text-surface-400 gap-3">
        <Table2 className="w-10 h-10 text-red-400" />
        <span className="text-sm text-red-300">{error}</span>
      </div>
    );
  }

  if (!currentSheet || (currentSheet.headers.length === 0 && currentSheet.rows.length === 0)) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-surface-900 text-surface-400 gap-3">
        <Table2 className="w-10 h-10 text-surface-600" />
        <span className="text-sm">Hoja vacía</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-surface-900 text-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-700 bg-surface-800/80 shrink-0 flex-wrap">
        {/* Sheet tabs */}
        {sheets.length > 1 && (
          <div className="flex items-center gap-0.5 mr-2 overflow-x-auto scrollbar-hide">
            {sheets.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSheet(idx)}
                className={`px-2.5 py-1 text-xs rounded-t whitespace-nowrap transition ${
                  idx === activeSheet
                    ? 'bg-surface-700 text-white font-medium border-b-2 border-mandy-400'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative flex items-center flex-1 min-w-[120px] max-w-[240px]">
          <Search className="absolute left-2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Filtrar..."
            className="w-full pl-7 pr-7 py-1 text-xs bg-surface-800 border border-surface-700 rounded text-surface-200 placeholder-surface-500 focus:outline-none focus:border-sky-500/50 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-surface-500 hover:text-surface-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Row count */}
        <span className="text-[10px] text-surface-500 ml-auto whitespace-nowrap">
          {filteredRows.length.toLocaleString()} filas
          {searchQuery && ` de ${currentSheet.rows.length.toLocaleString()}`}
        </span>

        {/* Download original */}
        <button
          onClick={handleDownloadOriginal}
          className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition"
          title="Descargar original"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      <div ref={tableRef} className="flex-1 min-h-0 overflow-auto scrollbar-hide">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-800">
              <th className="px-2 py-1.5 text-[10px] font-semibold text-surface-500 border-b border-r border-surface-700 w-10 text-center bg-surface-800 sticky left-0 z-20">
                #
              </th>
              {currentSheet.headers.map((header, colIdx) => (
                <th
                  key={colIdx}
                  onClick={() => handleSort(colIdx)}
                  className="px-3 py-1.5 text-left text-[11px] font-semibold text-surface-300 border-b border-r border-surface-700 cursor-pointer select-none hover:bg-surface-700/60 transition whitespace-nowrap bg-surface-800"
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[200px]">{header || `Col ${colIdx + 1}`}</span>
                    {sortCol === colIdx ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-mandy-400 shrink-0" />
                        : <ArrowDown className="w-3 h-3 text-mandy-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-surface-600 shrink-0" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIdx) => {
              const globalIdx = page * PAGE_SIZE + rowIdx;
              return (
                <tr
                  key={globalIdx}
                  className={`${
                    rowIdx % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/30'
                  } hover:bg-surface-700/40 transition-colors`}
                >
                  <td className="px-2 py-1 text-[10px] text-surface-600 border-r border-surface-700/50 text-center tabular-nums sticky left-0 bg-inherit">
                    {globalIdx + 1}
                  </td>
                  {row.map((cell, colIdx) => {
                    const isMatch = searchQuery && cell.toLowerCase().includes(searchQuery.toLowerCase());
                    return (
                      <td
                        key={colIdx}
                        className={`px-3 py-1 border-r border-surface-700/30 text-surface-300 whitespace-nowrap max-w-[300px] truncate ${
                          isMatch ? 'bg-amber-500/15 text-amber-200' : ''
                        }`}
                        title={cell.length > 50 ? cell : undefined}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface-700 bg-surface-800/80 shrink-0">
          <span className="text-[10px] text-surface-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedRows.length)} de {sortedRows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-surface-400 min-w-[3rem] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpreadsheetViewer;
