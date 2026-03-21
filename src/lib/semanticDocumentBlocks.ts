const START_PREFIX = '<!-- agora-semantic:start:';
const END_PREFIX = '<!-- agora-semantic:end:';

export const wrapSemanticDocumentBlock = (blockId: string, markdown: string) => {
  const trimmed = markdown.trim();
  return `${START_PREFIX}${blockId} -->\n${trimmed}\n${END_PREFIX}${blockId} -->`;
};

export const removeSemanticDocumentBlock = (content: string, blockId: string) => {
  const escapedId = blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockPattern = new RegExp(
    `(?:\\n{0,2})?<!-- agora-semantic:start:${escapedId} -->([\\s\\S]*?)<!-- agora-semantic:end:${escapedId} -->(?:\\n{0,2})?`,
    'g'
  );

  const nextContent = content.replace(blockPattern, '\n');

  return nextContent
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
};
