'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Table2,
  Trash2,
  X
} from 'lucide-react';
import { downloadDocumentBlobApi, replaceDocumentFileApi } from '@/services/dashboardApi';
import { loadXlsx, parseCsv, detectDelimiter } from '@/lib/clientMarkdownConversion';
import { getFileExtension } from '@/lib/document-format';

interface SheetRow {
  id: string;
  cells: string[];
}

interface SheetData {
  name: string;
  headers: string[];
  rows: SheetRow[];
}

interface SpreadsheetViewerProps {
  docId: string;
  docName: string;
  onClose?: () => void;
}

type SortDir = 'asc' | 'desc' | null;

const PAGE_SIZE = 100;

const createRowId = () => `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeShape = (headers: string[], rows: string[][]) => {
  const width = Math.max(headers.length, ...rows.map((row) => row.length), 0);
  const normalizedHeaders = Array.from({ length: width }, (_, index) => String(headers[index] ?? ''));
  const normalizedRows = rows.map((row) => (
    Array.from({ length: width }, (_, index) => String(row[index] ?? ''))
  ));

  return {
    headers: normalizedHeaders,
    rows: normalizedRows
  };
};

const buildSheet = (name: string, headers: string[], rows: string[][]): SheetData => {
  const normalized = normalizeShape(headers, rows);
  return {
    name,
    headers: normalized.headers,
    rows: normalized.rows.map((cells) => ({
      id: createRowId(),
      cells
    }))
  };
};

const cloneSheets = (sheets: SheetData[]) => sheets.map((sheet) => ({
  name: sheet.name,
  headers: [...sheet.headers],
  rows: sheet.rows.map((row) => ({
    id: row.id,
    cells: [...row.cells]
  }))
}));

const trimTrailingEmptyCells = (row: string[]) => {
  let lastIndex = row.length - 1;
  while (lastIndex >= 0 && row[lastIndex] === '') {
    lastIndex -= 1;
  }
  return row.slice(0, lastIndex + 1);
};

const buildExportMatrix = (sheet: SheetData) => {
  const rawRows = [
    [...sheet.headers],
    ...sheet.rows.map((row) => [...row.cells])
  ].map(trimTrailingEmptyCells);

  while (rawRows.length > 0 && rawRows[rawRows.length - 1].length === 0) {
    rawRows.pop();
  }

  return rawRows.length > 0 ? rawRows : [[]];
};

const getSpreadsheetMimeType = (extension: string) => {
  if (extension === 'csv') return 'text/csv';
  if (extension === 'tsv') return 'text/tab-separated-values';
  if (extension === 'xls') return 'application/vnd.ms-excel';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
};

export default function SpreadsheetViewer({
  docId,
  docName,
  onClose
}: SpreadsheetViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [savedSheets, setSavedSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);

  const ext = useMemo(() => getFileExtension(docName), [docName]);
  const currentSheet = sheets[activeSheet] ?? null;

  const applySheetUpdate = useCallback((updater: (sheet: SheetData) => SheetData) => {
    setSheets((current) => {
      const next = cloneSheets(current);
      const target = next[activeSheet];
      if (!target) return current;
      next[activeSheet] = updater(target);
      return next;
    });
    setDirty(true);
    setSaveMessage(null);
  }, [activeSheet]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSaveMessage(null);
      try {
        const { blob } = await downloadDocumentBlobApi(docId);
        if (cancelled) return;

        let parsedSheets: SheetData[];

        if (ext === 'csv' || ext === 'tsv') {
          const text = await blob.text();
          const delimiter = ext === 'tsv' ? '\t' : detectDelimiter(text);
          const rows = parseCsv(text, delimiter);
          parsedSheets = rows.length === 0
            ? [buildSheet('Datos', [], [])]
            : [buildSheet('Datos', rows[0].map((cell) => String(cell ?? '')), rows.slice(1))];
        } else {
          const XLSX = await loadXlsx();
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });

          parsedSheets = workbook.SheetNames.map((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const raw = XLSX.utils.sheet_to_json<string[]>(sheet, {
              header: 1,
              defval: '',
              blankrows: true
            });

            if (raw.length === 0) {
              return buildSheet(sheetName, [], []);
            }

            const headers = raw[0].map((cell) => String(cell ?? ''));
            const rows = raw.slice(1).map((row) => row.map((cell) => String(cell ?? '')));
            return buildSheet(sheetName, headers, rows);
          });
        }

        if (!cancelled) {
          const nextSheets = parsedSheets.length > 0 ? parsedSheets : [buildSheet('Datos', [], [])];
          setSheets(nextSheets);
          setSavedSheets(cloneSheets(nextSheets));
          setActiveSheet(0);
          setDirty(false);
        }
      } catch (fetchError) {
        console.error('SpreadsheetViewer fetch error:', fetchError);
        if (!cancelled) {
          setError('No se pudo cargar el archivo.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [docId, ext]);

  useEffect(() => {
    setPage(0);
    setSortCol(null);
    setSortDir(null);
    setSearchQuery('');
    setSaveMessage(null);
  }, [activeSheet]);

  const filteredRows = useMemo(() => {
    if (!currentSheet) return [];
    if (!searchQuery.trim()) return currentSheet.rows;
    const query = searchQuery.toLowerCase();
    return currentSheet.rows.filter((row) => (
      row.cells.some((cell) => cell.toLowerCase().includes(query))
    ));
  }, [currentSheet, searchQuery]);

  const sortedRows = useMemo(() => {
    if (sortCol === null || sortDir === null) return filteredRows;

    return [...filteredRows].sort((left, right) => {
      const leftValue = left.cells[sortCol] ?? '';
      const rightValue = right.cells[sortCol] ?? '';
      const leftNumber = Number(leftValue);
      const rightNumber = Number(rightValue);

      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftValue !== '' && rightValue !== '') {
        return sortDir === 'asc' ? leftNumber - rightNumber : rightNumber - leftNumber;
      }

      const comparison = leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortCol, sortDir]);

  useEffect(() => {
    const maxPage = Math.max(Math.ceil(sortedRows.length / PAGE_SIZE) - 1, 0);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, sortedRows.length]);

  const totalPages = Math.max(Math.ceil(sortedRows.length / PAGE_SIZE), 1);
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [page, sortedRows]);

  const handleSort = useCallback((colIndex: number) => {
    if (sortCol === colIndex) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') {
        setSortCol(null);
        setSortDir(null);
      } else {
        setSortDir('asc');
      }
    } else {
      setSortCol(colIndex);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortCol, sortDir]);

  const handleHeaderChange = useCallback((colIndex: number, value: string) => {
    applySheetUpdate((sheet) => {
      sheet.headers[colIndex] = value;
      return sheet;
    });
  }, [applySheetUpdate]);

  const handleCellChange = useCallback((rowId: string, colIndex: number, value: string) => {
    applySheetUpdate((sheet) => {
      const row = sheet.rows.find((item) => item.id === rowId);
      if (row) {
        row.cells[colIndex] = value;
      }
      return sheet;
    });
  }, [applySheetUpdate]);

  const handleAddRow = useCallback(() => {
    applySheetUpdate((sheet) => {
      sheet.rows.push({
        id: createRowId(),
        cells: Array.from({ length: sheet.headers.length }, () => '')
      });
      return sheet;
    });
  }, [applySheetUpdate]);

  const handleDeleteRow = useCallback((rowId: string) => {
    applySheetUpdate((sheet) => {
      sheet.rows = sheet.rows.filter((row) => row.id !== rowId);
      return sheet;
    });
  }, [applySheetUpdate]);

  const handleAddColumn = useCallback(() => {
    applySheetUpdate((sheet) => {
      sheet.headers.push(`Col ${sheet.headers.length + 1}`);
      sheet.rows = sheet.rows.map((row) => ({
        ...row,
        cells: [...row.cells, '']
      }));
      return sheet;
    });
  }, [applySheetUpdate]);

  const handleDeleteColumn = useCallback((colIndex: number) => {
    applySheetUpdate((sheet) => {
      sheet.headers = sheet.headers.filter((_, index) => index !== colIndex);
      sheet.rows = sheet.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, index) => index !== colIndex)
      }));
      return sheet;
    });

    setSortCol((current) => {
      if (current === null) return current;
      if (current === colIndex) return null;
      return current > colIndex ? current - 1 : current;
    });
    setSortDir((current) => (sortCol === colIndex ? null : current));
  }, [applySheetUpdate, sortCol]);

  const buildExportBlob = useCallback(async () => {
    const mimeType = getSpreadsheetMimeType(ext);
    const XLSX = await loadXlsx();

    if (ext === 'csv' || ext === 'tsv') {
      const sheet = currentSheet ?? buildSheet('Datos', [], []);
      const csvSheet = XLSX.utils.aoa_to_sheet(buildExportMatrix(sheet));
      const text = XLSX.utils.sheet_to_csv(csvSheet, {
        FS: ext === 'tsv' ? '\t' : ','
      });
      return {
        blob: new Blob([`\ufeff${text}`], { type: mimeType }),
        mimeType
      };
    }

    const workbook = XLSX.utils.book_new();
    const exportSheets = sheets.length > 0 ? sheets : [buildSheet('Datos', [], [])];

    exportSheets.forEach((sheetData, index) => {
      const worksheet = XLSX.utils.aoa_to_sheet(buildExportMatrix(sheetData));
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetData.name || `Hoja ${index + 1}`);
    });

    const data = XLSX.write(workbook, {
      type: 'array',
      bookType: ext === 'xls' ? 'xls' : 'xlsx'
    });

    return {
      blob: new Blob([data], { type: mimeType }),
      mimeType
    };
  }, [currentSheet, ext, sheets]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      const { blob, mimeType } = await buildExportBlob();
      await replaceDocumentFileApi({
        docId,
        blob,
        mimeType
      });
      const snapshot = cloneSheets(sheets);
      setSavedSheets(snapshot);
      setSheets(snapshot);
      setDirty(false);
      setSaveMessage('Cambios guardados');
    } catch (saveError) {
      console.error('Spreadsheet save error:', saveError);
      setError('No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }, [buildExportBlob, docId, sheets]);

  const handleRevert = useCallback(() => {
    setSheets(cloneSheets(savedSheets));
    setDirty(false);
    setError(null);
    setSaveMessage('Cambios descartados');
  }, [savedSheets]);

  const handleDownload = useCallback(async () => {
    try {
      const { blob } = await buildExportBlob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      console.error('Spreadsheet export error:', downloadError);
      setError('No se pudo exportar la hoja.');
    }
  }, [buildExportBlob, docName]);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-900 text-surface-400">
        <Loader2 className="h-8 w-8 animate-spin text-mandy-400" />
        <span className="text-sm">Cargando hoja de cálculo...</span>
      </div>
    );
  }

  if (error && sheets.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-900 text-surface-400">
        <Table2 className="h-10 w-10 text-red-400" />
        <span className="text-sm text-red-300">{error}</span>
      </div>
    );
  }

  if (!currentSheet) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-900 text-surface-400">
        <Table2 className="h-10 w-10 text-surface-600" />
        <span className="text-sm">Hoja vacía</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-900 text-slate-200">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-surface-700 bg-surface-950 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
          )}
          {onClose && <div className="h-4 w-px bg-slate-700" />}
          <span className="truncate text-xs font-medium text-slate-400" title={docName}>
            {docName}
          </span>
          {dirty && <span className="text-[11px] text-amber-300">Editando</span>}
          {!dirty && saveMessage && <span className="text-[11px] text-emerald-300">{saveMessage}</span>}
          {error && sheets.length > 0 && <span className="text-[11px] text-red-300">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddColumn}
            className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-surface-200 hover:bg-surface-700"
            title="Agregar columna"
          >
            <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Columna</span>
          </button>
          <button
            onClick={handleAddRow}
            className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-surface-200 hover:bg-surface-700"
            title="Agregar fila"
          >
            <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Fila</span>
          </button>
          <button
            onClick={handleRevert}
            disabled={!dirty || saving}
            className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-surface-200 hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-40"
            title="Descartar cambios"
          >
            <span className="inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Descartar</span>
          </button>
          <button
            onClick={handleDownload}
            className="rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-surface-200 hover:bg-surface-700"
            title="Descargar copia"
          >
            <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Descargar</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Guardar cambios"
          >
            <span className="inline-flex items-center gap-1">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-surface-700 bg-surface-800/80 px-3 py-1.5">
        {sheets.length > 1 && (
          <div className="mr-2 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
            {sheets.map((sheet, index) => (
              <button
                key={`${sheet.name}-${index}`}
                onClick={() => setActiveSheet(index)}
                className={`whitespace-nowrap rounded-t px-2.5 py-1 text-xs transition ${
                  index === activeSheet
                    ? 'border-b-2 border-mandy-400 bg-surface-700 font-medium text-white'
                    : 'text-surface-400 hover:bg-surface-700/50 hover:text-surface-200'
                }`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex min-w-[140px] max-w-[260px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-surface-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Filtrar..."
            className="w-full rounded border border-surface-700 bg-surface-800 py-1 pl-7 pr-7 text-xs text-surface-200 placeholder-surface-500 focus:border-sky-500/50 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-surface-500 hover:text-surface-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <span className="ml-auto whitespace-nowrap text-[10px] text-surface-500">
          {filteredRows.length.toLocaleString()} filas
          {searchQuery && ` de ${currentSheet.rows.length.toLocaleString()}`}
        </span>
      </div>

      {currentSheet.headers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-900 px-6 text-center">
          <Table2 className="h-10 w-10 text-surface-600" />
          <div className="space-y-1">
            <p className="text-sm text-slate-200">La hoja no tiene columnas todavía.</p>
            <p className="text-xs text-slate-500">Agrega columnas para empezar a editar este archivo.</p>
          </div>
          <button
            onClick={handleAddColumn}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
          >
            Agregar primera columna
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto scrollbar-hide">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-800">
                <th className="sticky left-0 z-30 w-16 border-b border-r border-surface-700 bg-surface-800 px-2 py-1.5 text-center text-[10px] font-semibold text-surface-500">
                  #
                </th>
                {currentSheet.headers.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    className="border-b border-r border-surface-700 bg-surface-800 px-2 py-1.5 text-left text-[11px] font-semibold text-surface-300"
                  >
                    <div className="flex min-w-[180px] items-center gap-1">
                      <button
                        onClick={() => handleSort(colIndex)}
                        className="rounded p-1 text-surface-500 hover:bg-surface-700 hover:text-surface-200"
                        title="Ordenar columna"
                      >
                        {sortCol === colIndex ? (
                          sortDir === 'asc'
                            ? <ArrowUp className="h-3 w-3 text-mandy-400" />
                            : <ArrowDown className="h-3 w-3 text-mandy-400" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                      <input
                        value={header}
                        onChange={(event) => handleHeaderChange(colIndex, event.target.value)}
                        className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-[11px] text-surface-100 outline-none ring-0 placeholder:text-surface-500"
                        placeholder={`Col ${colIndex + 1}`}
                      />
                      <button
                        onClick={() => handleDeleteColumn(colIndex)}
                        className="rounded p-1 text-surface-500 hover:bg-red-500/15 hover:text-red-300"
                        title="Eliminar columna"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, rowIndex) => {
                const globalIndex = page * PAGE_SIZE + rowIndex;
                return (
                  <tr
                    key={row.id}
                    className={`group ${
                      rowIndex % 2 === 0 ? 'bg-surface-900' : 'bg-surface-800/30'
                    } transition-colors hover:bg-surface-700/40`}
                  >
                    <td className="sticky left-0 border-r border-surface-700/50 bg-inherit px-2 py-1 text-center text-[10px] text-surface-600 tabular-nums">
                      <div className="flex items-center justify-center gap-1">
                        <span>{globalIndex + 1}</span>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="rounded p-0.5 text-surface-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-300"
                          title="Eliminar fila"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    {row.cells.map((cell, colIndex) => {
                      const isMatch = searchQuery && cell.toLowerCase().includes(searchQuery.toLowerCase());
                      return (
                        <td
                          key={`${row.id}-${colIndex}`}
                          className={`border-r border-surface-700/30 px-1 py-1 align-top ${
                            isMatch ? 'bg-amber-500/10' : ''
                          }`}
                        >
                          <input
                            value={cell}
                            onChange={(event) => handleCellChange(row.id, colIndex, event.target.value)}
                            className={`w-full min-w-[180px] rounded bg-transparent px-2 py-1 text-surface-200 outline-none placeholder:text-surface-500 ${
                              isMatch ? 'text-amber-200' : ''
                            }`}
                            placeholder="Vacío"
                            title={cell.length > 50 ? cell : undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-surface-700 bg-surface-800/80 px-3 py-1.5">
          <span className="text-[10px] text-surface-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedRows.length)} de {sortedRows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="rounded p-1 text-surface-400 transition hover:bg-surface-700 hover:text-surface-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[3rem] text-center text-[10px] text-surface-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="rounded p-1 text-surface-400 transition hover:bg-surface-700 hover:text-surface-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
