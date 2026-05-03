declare module 'mammoth' {
  export function convertToHtml(input: { buffer: Buffer }): Promise<{ value: string }>;
}

declare module 'turndown' {
  export default class TurndownService {
    constructor(options?: unknown);
    turndown(input: string): string;
  }
}
