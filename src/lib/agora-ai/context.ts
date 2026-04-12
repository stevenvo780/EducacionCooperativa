import { adminDb } from '@/lib/firebase-admin';

export async function buildAgoraWorkspaceContext(workspaceId: string): Promise<string> {
  const parts: string[] = [];

  try {
    const docsSnap = await adminDb
      .collection('documents')
      .where('workspaceId', '==', workspaceId)
      .limit(30)
      .get();

    if (!docsSnap.empty) {
      type FireDoc = { id: string } & Record<string, unknown>;
      const textDocs = docsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }) as FireDoc)
        .filter(d => d.type === 'text' && d.content);

      if (textDocs.length > 0) {
        parts.push('## Documentos del workspace\n');
        for (const doc of textDocs.slice(0, 10)) {
          const raw = String(doc.content ?? '');
          const excerpt = raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw;
          parts.push(`### ${String(doc.name || 'Sin título')}\n${excerpt}\n`);
        }
      }
    }
  } catch {
    // best-effort context
  }

  try {
    const semSnap = await adminDb
      .collection('workspaceSemanticStates')
      .doc(workspaceId)
      .get();

    if (semSnap.exists) {
      const sem = semSnap.data() as Record<string, unknown>;
      const concepts = (sem.concepts as Array<Record<string, unknown>> | undefined) ?? [];
      const fragments = (sem.fragments as Array<Record<string, unknown>> | undefined) ?? [];

      if (concepts.length > 0) {
        parts.push('\n## Conceptos semánticos del workspace\n');
        for (const concept of concepts.slice(0, 25)) {
          const def = String(concept.definition ?? concept.formula ?? '');
          parts.push(`- **${String(concept.title ?? '')}**${def ? `: ${def}` : ''}`);
        }
      }

      if (fragments.length > 0) {
        parts.push('\n## Fragmentos de texto marcados\n');
        for (const fragment of fragments.slice(0, 20)) {
          const text = String(fragment.text ?? '').slice(0, 250);
          parts.push(`- [${String(fragment.kind ?? '')}] "${text}"`);
        }
      }
    }
  } catch {
    // best-effort context
  }

  if (parts.length === 0) return '';
  return `# Contexto del workspace Agora\n\n${parts.join('\n')}`;
}
