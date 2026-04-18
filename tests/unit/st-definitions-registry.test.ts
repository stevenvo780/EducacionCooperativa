import { describe, expect, it } from 'vitest';

import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';

describe('STDefinitionsRegistry', () => {
  it('does not index definitions from syntactically invalid ST source', () => {
    const source = 'logic modal.k\ndefine DEF_NEC = □P\nclaim CLM_NEC = □P';

    expect(STDefinitionsRegistry.extractFromSource(source, 'invalid.st')).toEqual([]);
  });

  it('indexes interpret aliases using the runtime-visible name', () => {
    const source = 'logic classical.propositional\ninterpret "texto" as E';
    const definitions = STDefinitionsRegistry.extractFromSource(source, 'interpret.st');

    expect(definitions).toEqual([
      expect.objectContaining({
        name: 'E',
        kind: 'interpretation',
        naturalName: 'texto'
      })
    ]);
  });
});
