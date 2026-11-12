import { describe, expect, it } from 'vitest';
import { proyectoDesdeCroquis, superficieCroquis, validarLectura } from '$lib/presupuesto/croquis';
import { medirPlanta } from '$lib/presupuesto/mediciones';

describe('croquis', () => {
  it('convierte estancias del croquis en un plano con las mismas medidas interiores', () => {
    const lectura = validarLectura({ estancias: [
      { nombre: 'Baño', ancho: 240, largo: '180', alto: 250, puertas: [{ pared: 'abajo', ancho: 72 }], ventanas: [{ pared: 'arriba', ancho: 100, alto: 120 }] },
      { nombre: 'Cocina', ancho: 3.2, largo: 300 }, // 3,2 cm: ilegible, se descarta con aviso
      { nombre: 'Salón', ancho: 500, largo: 400, puertas: [{ pared: 'izquierda', ancho: 82 }, { pared: 'izquierda', ancho: 82 }] },
    ], notas: ['cota borrosa'] });
    expect(lectura.estancias.map(e => e.nombre)).toEqual(['Baño', 'Salón']);
    expect(lectura.notas).toHaveLength(2);

    const floor = proyectoDesdeCroquis(lectura.estancias).floors[0];
    const m = medirPlanta(floor);
    const baño = m.estancias.find(e => e.nombre === 'Baño')!, salon = m.estancias.find(e => e.nombre === 'Salón')!;
    expect(baño.suelo).toBeCloseTo(4.32, 2);       // 2,40 × 1,80
    expect(baño.perimetro).toBeCloseTo(8.4, 2);
    expect(baño.paredBruta).toBeCloseTo(21, 2);    // 8,4 × 2,5
    expect(baño.paredNeta).toBeCloseTo(21 - 0.72 * 2.03 - 1.2, 1);
    expect([baño.puertas, baño.ventanas]).toEqual([1, 1]);
    expect(salon.suelo).toBeCloseTo(20, 2);
    expect(salon.puertas).toBe(2);
    expect(m.avisos).toEqual([]);
  });
  it('no inventa nada si la lectura no trae estancias', () => {
    expect(validarLectura(null)).toEqual({ estancias: [], notas: [] });
    expect(validarLectura({ estancias: 'x', notas: ['no es un plano'] })).toEqual({ estancias: [], notas: ['no es un plano'] });
  });
  it('mide una estancia en L por su contorno y avisa si las cotas no cierran', () => {
    const L = [{ dir: 'derecha', largo: 320 }, { dir: 'abajo', largo: 410 }, { dir: 'izquierda', largo: 280 }, { dir: 'arriba', largo: 230 }, { dir: 'izquierda', largo: 40 }, { dir: 'arriba', largo: 180 }];
    const ok = validarLectura({ estancias: [{ nombre: 'Salón', contorno: L, puertas: [{ pared: 'abajo', ancho: 80 }] }] });
    expect(ok.notas).toEqual([]);
    expect(ok.estancias[0]).toMatchObject({ ancho: 320, largo: 410, dudosa: false });
    expect(superficieCroquis(ok.estancias[0])).toBeCloseTo(12.2, 2);   // 3,20×4,10 − 0,40×2,30
    const e = medirPlanta(proyectoDesdeCroquis(ok.estancias).floors[0]).estancias[0];
    expect(e.suelo).toBeCloseTo(12.2, 2);
    expect(e.perimetro).toBeCloseTo(14.6, 2);                          // 2 × (3,20 + 4,10)
    expect(e.puertas).toBe(1);

    const mal = validarLectura({ estancias: [{ nombre: 'Salón', contorno: L.map((t, i) => i === 4 ? { ...t, largo: 120 } : t) }] });
    expect(mal.estancias[0].dudosa).toBe(true);
    expect(mal.notas[0]).toContain('80 cm en horizontal');
    // Sin contorno cerrado se usa el rectángulo envolvente, marcado como dudoso.
    expect(medirPlanta(proyectoDesdeCroquis(mal.estancias).floors[0]).estancias).toHaveLength(1);
  });
});
