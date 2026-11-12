/** Presupuesto: líneas generadas desde las mediciones y totales. */
import { CAPITULOS, TRABAJOS, cantidadBase, type Partida } from './catalogo';
import type { MedicionEstancia } from './mediciones';

export interface Linea {
  id: string;
  partidaId: string | null;
  capitulo: string;
  descripcion: string;
  /** Estancia a la que corresponde; vacío en líneas generales. */
  estancia: string;
  unidad: string;
  cantidad: number;
  precio: number;
}

export interface DatosEmpresa { nombre: string; nif: string; direccion: string; telefono: string; email: string; condiciones: string }
export interface Presupuesto {
  numero: string;
  fecha: string;
  cliente: string;
  obra: string;
  ivaPct: number;
  lineas: Linea[];
}

export const EMPRESA_VACIA: DatosEmpresa = {
  nombre: '', nif: '', direccion: '', telefono: '', email: '',
  condiciones: 'Validez de la oferta: 30 días. Forma de pago: 40 % a la aceptación, 40 % a mitad de obra y 20 % a la finalización. Cualquier trabajo no descrito se presupuestará aparte.',
};

export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const uid = () => `l-${Math.random().toString(36).slice(2, 10)}`;
export const importe = (l: Linea) => r2(l.cantidad * l.precio);

/** Líneas de un trabajo tipo aplicado a una estancia. Omite las de cantidad cero. */
export function lineasDeTrabajo(trabajoId: string, estancia: MedicionEstancia, catalogo: Partida[]): Linea[] {
  const trabajo = TRABAJOS.find(t => t.id === trabajoId);
  if (!trabajo) return [];
  const lineas: Linea[] = [];
  for (const partidaId of trabajo.partidas) {
    const p = catalogo.find(c => c.id === partidaId);
    if (!p) continue;
    const cantidad = r2(cantidadBase(p.base, estancia));
    if (cantidad <= 0) continue;
    lineas.push({ id: uid(), partidaId: p.id, capitulo: p.capitulo, descripcion: p.descripcion, estancia: estancia.nombre, unidad: p.unidad, cantidad, precio: p.precio });
  }
  return lineas;
}

export function lineaManual(capitulo = 'Varios'): Linea {
  return { id: uid(), partidaId: null, capitulo, descripcion: '', estancia: '', unidad: 'ud', cantidad: 1, precio: 0 };
}

export interface Totales { capitulos: { capitulo: string; lineas: Linea[]; subtotal: number }[]; base: number; iva: number; total: number }

/** Agrupa por capítulo, en el orden habitual de obra, y calcula base, IVA y total. */
export function totales(p: Pick<Presupuesto, 'lineas' | 'ivaPct'>): Totales {
  const orden = (c: string) => { const i = CAPITULOS.indexOf(c); return i < 0 ? CAPITULOS.length : i; };
  const nombres = [...new Set(p.lineas.map(l => l.capitulo))].sort((a, b) => orden(a) - orden(b) || a.localeCompare(b));
  const capitulos = nombres.map(capitulo => {
    const lineas = p.lineas.filter(l => l.capitulo === capitulo);
    return { capitulo, lineas, subtotal: r2(lineas.reduce((s, l) => s + importe(l), 0)) };
  });
  const base = r2(capitulos.reduce((s, c) => s + c.subtotal, 0));
  const iva = r2(base * p.ivaPct / 100);
  return { capitulos, base, iva, total: r2(base + iva) };
}

export const euros = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
export const cantidadTexto = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
