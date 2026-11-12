import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DOOR_CATALOG, WINDOW_CATALOG } from '$lib/presupuesto/buscador';

describe('buscador', () => {
  it('cubre todos los tipos de puerta y ventana del modelo', () => {
    expect(DOOR_CATALOG.map(d => d.tipo).sort()).toEqual(['bifold', 'double', 'french', 'garage', 'opening', 'pocket', 'single', 'sliding']);
    expect(WINDOW_CATALOG.map(v => v.tipo).sort()).toEqual(['bay', 'casement', 'fixed', 'sliding', 'standard']);
  });
  it('los resultados iniciales existen en el buscador', () => {
    const fuente = readFileSync(new URL('../src/lib/components/editor/CommandPalette.svelte', import.meta.url), 'utf8');
    const inicio = /const INICIO = \[([^\]]+)\]/.exec(fuente)![1].split(',').map(s => s.trim().replace(/'/g, ''));
    for (const id of inicio) {
      const base = id.replace(/^k-(puerta|ventana)-.*/, 'k-$1-');
      expect(fuente, id).toContain(base.endsWith('-') ? `\`${base}\${` : `id: '${id}'`);
    }
  });
});
