import { describe, expect, it } from 'vitest';
import { CATALOGO_EJEMPLO } from '$lib/presupuesto/catalogo';
import { lineasDeTrabajo, lineaManual, totales, importe, EMPRESA_VACIA } from '$lib/presupuesto/presupuesto';
import { pdfPresupuesto } from '$lib/presupuesto/presupuestoPdf';
import type { MedicionEstancia } from '$lib/presupuesto/mediciones';

const baño: MedicionEstancia = { id: 'b', nombre: 'Baño', suelo: 4.32, techo: 4.32, perimetro: 8.4, altura: 2.5, paredBruta: 21, paredNeta: 19.54, rodapie: 7.68, puertas: 1, ventanas: 0, superficieHuecos: 1.46, huecos: [] };

describe('presupuesto', () => {
  it('genera las partidas de un baño con cantidades medidas y suma bien', () => {
    const lineas = lineasDeTrabajo('bano', baño, CATALOGO_EJEMPLO);
    const de = (id: string) => lineas.find(l => l.partidaId === id)!;
    expect(de('rev-alicatado')).toMatchObject({ cantidad: 19.54, precio: 38, unidad: 'm²', estancia: 'Baño' });
    expect(importe(de('rev-alicatado'))).toBe(742.52);              // 19,54 × 38
    expect(de('sue-ceramico').cantidad).toBe(4.32);
    expect(de('fon-bano').cantidad).toBe(1);
    const t = totales({ lineas, ivaPct: 21 });
    // 120 + 234,48 + 43,20 + 950 + 380 + 742,52 + 155,52 + 32,40 + 850
    expect(t.base).toBe(3508.12);
    expect(t.iva).toBe(736.71);
    expect(t.total).toBe(4244.83);
    expect(t.capitulos.map(c => c.capitulo)).toEqual(['Demoliciones', 'Fontanería', 'Electricidad', 'Revestimientos', 'Suelos', 'Pintura']);
    expect(t.capitulos.reduce((s, c) => s + c.subtotal, 0)).toBeCloseTo(t.base, 2);
  });
  it('omite partidas sin cantidad y admite líneas manuales', () => {
    const sinPuerta = { ...baño, puertas: 0 };
    expect(lineasDeTrabajo('completa', sinPuerta, CATALOGO_EJEMPLO).some(l => l.partidaId === 'car-puerta')).toBe(false);
    const manual = { ...lineaManual(), descripcion: 'Mampara', cantidad: 1, precio: 400 };
    expect(totales({ lineas: [manual], ivaPct: 10 })).toMatchObject({ base: 400, iva: 40, total: 440 });
  });
  it('produce un PDF', () => {
    const lineas = lineasDeTrabajo('bano', baño, CATALOGO_EJEMPLO);
    const pdf = pdfPresupuesto({ numero: '2026-001', fecha: '12/11/2026', cliente: 'Cliente de prueba', obra: 'Reforma de baño', ivaPct: 21, lineas }, { ...EMPRESA_VACIA, nombre: 'Reformas Ejemplo' });
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(2000);
  });
});
