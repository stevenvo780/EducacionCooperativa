declare module 'pdf-parse' {
  export default function pdfParse(data: Buffer | Uint8Array): Promise<{ text?: string }>;
}

declare module 'mammoth' {
  export function convertToHtml(input: { buffer: Buffer }): Promise<{ value: string }>;
}

declare module 'turndown' {
  export default class TurndownService {
    constructor(options?: unknown);
    turndown(input: string): string;
  }
}
