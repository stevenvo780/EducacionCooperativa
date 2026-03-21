declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean };
    add(word: string): void;
    remove(word: string): void;
    wordCharacters(): string | null;
    dictionary(dic: string | Buffer): void;
    personal(dic: string): void;
  }

  function nspell(aff: string | Buffer, dic: string | Buffer): NSpell;
  export default nspell;
}
