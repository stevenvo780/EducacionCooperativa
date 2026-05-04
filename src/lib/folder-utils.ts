/**
 * Folder root es `""`. No hay folder default mágico — los docs sin folder
 * cuelgan directamente de la raíz del workspace.
 *
 * `DEFAULT_FOLDER_NAME` queda como alias de `""` para los consumidores que
 * todavía lo importen. Comparar `path === DEFAULT_FOLDER_NAME` significa
 * "está en la raíz".
 */
const DEFAULT_FOLDER_NAME = '';

const normalizePath = (value?: string) => {
  if (!value) return '';
  return value
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join('/');
};

const normalizeFolderPath = (value?: string) => normalizePath(value);

export { DEFAULT_FOLDER_NAME, normalizePath, normalizeFolderPath };
