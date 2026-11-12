/**
 * Catálogo de partidas de EJEMPLO para arrancar. Los precios son orientativos
 * e inventados para la demostración: cada empresa debe sustituirlos por los
 * suyos (pantalla «Mis precios»).
 */
import type { MedicionEstancia } from './mediciones';

/** De qué medición de la estancia sale la cantidad. «fijo» = una unidad. */
export type BaseMedicion = 'suelo' | 'techo' | 'paredNeta' | 'paredBruta' | 'rodapie' | 'perimetro' | 'puertas' | 'ventanas' | 'fijo';

export interface Partida {
  id: string;
  capitulo: string;
  descripcion: string;
  unidad: 'm²' | 'm' | 'ud';
  precio: number;
  base: BaseMedicion;
}

export const CAPITULOS = ['Demoliciones', 'Albañilería', 'Fontanería', 'Electricidad', 'Revestimientos', 'Suelos', 'Techos', 'Pintura', 'Carpintería', 'Varios'];

export const CATALOGO_EJEMPLO: Partida[] = [
  { id: 'dem-alicatado', capitulo: 'Demoliciones', descripcion: 'Picado de alicatado en paredes, con retirada a contenedor', unidad: 'm²', precio: 12, base: 'paredNeta' },
  { id: 'dem-solado', capitulo: 'Demoliciones', descripcion: 'Levantado de solado existente, con retirada a contenedor', unidad: 'm²', precio: 10, base: 'suelo' },
  { id: 'dem-sanitarios', capitulo: 'Demoliciones', descripcion: 'Desmontaje de sanitarios y mobiliario existente', unidad: 'ud', precio: 120, base: 'fijo' },
  { id: 'alb-recrecido', capitulo: 'Albañilería', descripcion: 'Recrecido y nivelado de suelo con mortero', unidad: 'm²', precio: 14, base: 'suelo' },
  { id: 'fon-bano', capitulo: 'Fontanería', descripcion: 'Instalación de fontanería y desagües de baño', unidad: 'ud', precio: 950, base: 'fijo' },
  { id: 'fon-sanitarios', capitulo: 'Fontanería', descripcion: 'Suministro y colocación de sanitarios y grifería', unidad: 'ud', precio: 850, base: 'fijo' },
  { id: 'fon-cocina', capitulo: 'Fontanería', descripcion: 'Instalación de fontanería y desagües de cocina', unidad: 'ud', precio: 600, base: 'fijo' },
  { id: 'ele-estancia', capitulo: 'Electricidad', descripcion: 'Instalación eléctrica de la estancia: puntos de luz, enchufes y mecanismos', unidad: 'ud', precio: 380, base: 'fijo' },
  { id: 'rev-alicatado', capitulo: 'Revestimientos', descripcion: 'Alicatado de paredes con azulejo cerámico, incluso rejuntado', unidad: 'm²', precio: 38, base: 'paredNeta' },
  { id: 'rev-alisado', capitulo: 'Revestimientos', descripcion: 'Alisado de paredes para pintar', unidad: 'm²', precio: 12, base: 'paredNeta' },
  { id: 'sue-ceramico', capitulo: 'Suelos', descripcion: 'Solado con baldosa cerámica o porcelánica, incluso rejuntado', unidad: 'm²', precio: 36, base: 'suelo' },
  { id: 'sue-laminado', capitulo: 'Suelos', descripcion: 'Suelo laminado flotante sobre lámina aislante', unidad: 'm²', precio: 28, base: 'suelo' },
  { id: 'sue-rodapie', capitulo: 'Suelos', descripcion: 'Rodapié colocado', unidad: 'm', precio: 9, base: 'rodapie' },
  { id: 'tec-falso', capitulo: 'Techos', descripcion: 'Falso techo continuo de placa de yeso laminado', unidad: 'm²', precio: 32, base: 'techo' },
  { id: 'pin-paredes', capitulo: 'Pintura', descripcion: 'Pintura plástica lisa en paredes, dos manos', unidad: 'm²', precio: 7, base: 'paredNeta' },
  { id: 'pin-techos', capitulo: 'Pintura', descripcion: 'Pintura plástica lisa en techos, dos manos', unidad: 'm²', precio: 7.5, base: 'techo' },
  { id: 'car-puerta', capitulo: 'Carpintería', descripcion: 'Puerta de paso instalada, con marco, tapajuntas y herrajes', unidad: 'ud', precio: 320, base: 'puertas' },
  { id: 'car-ventana', capitulo: 'Carpintería', descripcion: 'Ventana instalada', unidad: 'ud', precio: 650, base: 'ventanas' },
  { id: 'var-escombros', capitulo: 'Varios', descripcion: 'Contenedor y gestión de escombros', unidad: 'ud', precio: 280, base: 'fijo' },
  { id: 'var-limpieza', capitulo: 'Varios', descripcion: 'Limpieza final de obra', unidad: 'm²', precio: 3, base: 'suelo' },
];

/** Trabajos tipo: qué partidas se aplican a una estancia. */
export const TRABAJOS: { id: string; nombre: string; partidas: string[] }[] = [
  { id: 'pintura', nombre: 'Pintura', partidas: ['pin-paredes', 'pin-techos'] },
  { id: 'suelo', nombre: 'Cambio de suelo', partidas: ['dem-solado', 'sue-laminado', 'sue-rodapie'] },
  { id: 'bano', nombre: 'Reforma de baño', partidas: ['dem-sanitarios', 'dem-alicatado', 'dem-solado', 'fon-bano', 'ele-estancia', 'rev-alicatado', 'sue-ceramico', 'pin-techos', 'fon-sanitarios'] },
  { id: 'cocina', nombre: 'Reforma de cocina', partidas: ['dem-alicatado', 'dem-solado', 'fon-cocina', 'ele-estancia', 'rev-alicatado', 'sue-ceramico', 'pin-techos'] },
  { id: 'completa', nombre: 'Reforma completa de estancia', partidas: ['dem-solado', 'ele-estancia', 'rev-alisado', 'pin-paredes', 'pin-techos', 'sue-laminado', 'sue-rodapie', 'car-puerta'] },
];

/** Cantidad de una partida en una estancia, según su base de medición. */
export function cantidadBase(base: BaseMedicion, e: MedicionEstancia): number {
  switch (base) {
    case 'suelo': return e.suelo ?? 0;
    case 'techo': return e.techo ?? 0;
    case 'paredNeta': return e.paredNeta;
    case 'paredBruta': return e.paredBruta;
    case 'rodapie': return e.rodapie;
    case 'perimetro': return e.perimetro;
    case 'puertas': return e.puertas;
    case 'ventanas': return e.ventanas;
    case 'fijo': return 1;
  }
}
