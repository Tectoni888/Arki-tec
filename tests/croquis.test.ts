import { describe, expect, it } from 'vitest';
import { proyectoDesdeCroquis, validarLectura } from '$lib/presupuesto/croquis';
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
});
