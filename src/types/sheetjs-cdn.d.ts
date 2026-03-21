declare module 'https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs' {
  export interface WorkSheet {}

  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export const utils: {
    sheet_to_json<T extends unknown[]>(sheet: WorkSheet, options: { header: 1; defval: string; blankrows: boolean }): T[];
    aoa_to_sheet(rows: string[][]): WorkSheet;
    sheet_to_csv(sheet: WorkSheet, options: { FS: string }): string;
    book_new(): unknown;
    book_append_sheet(workbook: unknown, worksheet: WorkSheet, name: string): void;
  };

  export function read(data: ArrayBuffer, options: { type: 'array' }): WorkBook;
  export function write(workbook: unknown, options: { type: 'array'; bookType: 'xls' | 'xlsx' }): ArrayBuffer | Uint8Array;
}
