export const fold = (value: string): string =>
    value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
