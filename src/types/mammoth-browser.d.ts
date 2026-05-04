declare module 'mammoth/mammoth.browser' {
  export interface MammothMessage {
    type?: string;
    message?: string;
  }
  export interface MammothResult {
    value: string;
    messages?: MammothMessage[];
  }
  export interface MammothOptions {
    styleMap?: string[];
  }
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: MammothOptions
  ): Promise<MammothResult>;
}
