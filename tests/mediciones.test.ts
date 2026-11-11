import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createDefaultFloor } from '$lib/stores/project';
import { importRoomPlanFloors } from '$lib/utils/roomplanImport';
import { medirPlanta } from '$lib/presupuesto/mediciones';
import type { Wall } from '$lib/models/types';

const wall = (id: string, x1: number, y1: number, x2: number, y2: number): Wall =>
  ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 10, height: 250, color: '#fff' });

describe('medirPlanta', () => {
  it('mide un baño rectangular comprobable a mano', () => {
    // Ejes de pared 4,10 × 3,10 m, grosor 10 cm → interior 4,00 × 3,00 m, altura 2,50 m.
    const floor = createDefaultFloor();
    floor.walls = [wall('a', 0, 0, 410, 0), wall('b', 410, 0, 410, 310), wall('c', 410, 310, 0, 310), wall('d', 0, 310, 0, 0)];
    floor.doors = [{ id: 'p', wallId: 'a', position: 0.5, width: 80, height: 200, type: 'single', swingDirection: 'left', flipSide: false }];
    floor.windows = [{ id: 'v', wallId: 'c', position: 0.5, width: 120, height: 120, sillHeight: 90, type: 'standard' }];
    const m = medirPlanta(floor);
    expect(m.estancias).toHaveLength(1);
    const e = m.estancias[0];
    expect(e.suelo).toBeCloseTo(12, 2);          // 4 × 3
    expect(e.perimetro).toBeCloseTo(14, 2);      // 2 × (4 + 3)
    expect(e.paredBruta).toBeCloseTo(35, 2);     // 14 × 2,5
    expect(e.superficieHuecos).toBeCloseTo(3.04, 2); // 0,8×2 + 1,2×1,2
    expect(e.paredNeta).toBeCloseTo(31.96, 2);
    expect(e.rodapie).toBeCloseTo(13.2, 2);      // 14 − 0,8
    expect([e.puertas, e.ventanas]).toEqual([1, 1]);
    expect(m.avisos).toEqual([]);
  });

  it('mide una estancia en L (esquina cóncava)', () => {
    // Interior: 4,00×1,95 + 1,95×2,05 = 11,7975 m²; perímetro 4+1,95+2,05+2,05+1,95+4 = 16 m.
    const floor = createDefaultFloor();
    const p = [[0, 0], [410, 0], [410, 205], [205, 205], [205, 410], [0, 410]];
    floor.walls = p.map(([x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return wall(`w${i}`, x, y, x2, y2); });
    const e = medirPlanta(floor).estancias[0];
    expect(e.suelo).toBeCloseTo(11.8, 2);
    expect(e.perimetro).toBeCloseTo(16, 2);
  });

  it('procesa el escaneo real de ejemplo del repositorio', () => {
    const scan = JSON.parse(readFileSync(new URL('../test-roomplan.json', import.meta.url), 'utf8'));
    for (const floor of importRoomPlanFloors(scan)) {
      const m = medirPlanta(floor);
      console.log(JSON.stringify({ planta: m.planta, totales: m.totales, avisos: m.avisos,
        estancias: m.estancias.map(({ huecos, id, ...e }) => e), paredes: floor.walls.length, puertas: floor.doors.length, ventanas: floor.windows.length }, null, 1));
      for (const e of m.estancias) {
        expect(e.perimetro).toBeGreaterThan(0);
        expect(e.paredNeta).toBeLessThanOrEqual(e.paredBruta);
      }
    }
  });
});
