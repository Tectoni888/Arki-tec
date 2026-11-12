/** Datos del buscador general de Arki-Tec: nombres, sinónimos y ayuda en el lenguaje de una reforma. */
import type { Door, Window } from '$lib/models/types';

export interface Atajo { id: string; nombre: string; icono: string; grupo: string; sinonimos: string[]; ayuda: string }

export const DOOR_CATALOG: { tipo: Door['type']; nombre: string; sinonimos: string[]; ayuda: string }[] = [
  { tipo: 'single', nombre: 'sencilla', sinonimos: ['abatible', 'normal', 'paso', 'una hoja'], ayuda: 'Una hoja abatible, 90 cm' },
  { tipo: 'double', nombre: 'doble', sinonimos: ['dos hojas'], ayuda: 'Dos hojas abatibles, 150 cm' },
  { tipo: 'sliding', nombre: 'corredera', sinonimos: ['deslizante', 'corrediza'], ayuda: 'Corredera, 180 cm' },
  { tipo: 'french', nombre: 'francesa', sinonimos: ['acristalada', 'vidriera', 'balconera'], ayuda: 'Dos hojas acristaladas, 150 cm' },
  { tipo: 'pocket', nombre: 'empotrada', sinonimos: ['corredera oculta', 'casoneto', 'escondida'], ayuda: 'Corredera oculta en el tabique, 90 cm' },
  { tipo: 'bifold', nombre: 'plegable', sinonimos: ['acordeon', 'armario'], ayuda: 'Plegable, 180 cm' },
  { tipo: 'opening', nombre: 'de paso (sin hoja)', sinonimos: ['hueco', 'arco', 'vano', 'abertura'], ayuda: 'Hueco libre sin puerta, 100 cm' },
  { tipo: 'garage', nombre: 'de garaje', sinonimos: ['basculante', 'cochera', 'porton'], ayuda: 'Basculante, 240 cm' },
];

export const WINDOW_CATALOG: { tipo: Window['type']; nombre: string; sinonimos: string[]; ayuda: string }[] = [
  { tipo: 'standard', nombre: 'estándar', sinonimos: ['normal', 'hueco'], ayuda: '120 × 120 cm' },
  { tipo: 'fixed', nombre: 'fija', sinonimos: ['fijo', 'no practicable', 'cristal fijo'], ayuda: '100 × 100 cm, no se abre' },
  { tipo: 'casement', nombre: 'abatible', sinonimos: ['practicable', 'oscilobatiente', 'batiente'], ayuda: '80 × 130 cm' },
  { tipo: 'sliding', nombre: 'corredera', sinonimos: ['deslizante', 'corrediza'], ayuda: '180 × 120 cm' },
  { tipo: 'bay', nombre: 'mirador', sinonimos: ['galeria', 'saliente', 'bow window'], ayuda: 'Ventana saliente' },
];

/** Otras formas de llamar a los muebles y sanitarios más habituales en una reforma. */
export const SINONIMOS_MUEBLES: Record<string, string[]> = {
  toilet: ['wc', 'vater', 'retrete', 'taza', 'sanitario'],
  sink_b: ['lavamanos', 'pila', 'sanitario', 'mueble de baño'],
  bathtub: ['baño', 'sanitario'],
  shower: ['plato de ducha', 'mampara', 'sanitario'],
  sink_k: ['pila', 'fregadera'],
  fridge: ['nevera', 'refrigerador'],
  stove: ['vitroceramica', 'placa', 'fogones', 'induccion', 'hornillo'],
  counter: ['bancada', 'encimera', 'mueble de cocina'],
  washer_dryer: ['lavadora', 'secadora'],
  dishwasher: ['lavaplatos'],
  wardrobe: ['ropero', 'armario empotrado'],
  storage: ['trastero', 'mueble'],
  sofa: ['tresillo', 'sillon'],
  bed_queen: ['cama doble', 'cama grande', 'dormitorio'],
  bed_twin: ['cama pequeña', 'dormitorio'],
  nightstand: ['mesita'],
  tv_stand: ['television', 'tele'],
  television: ['tele', 'tv', 'pantalla'],
  bookshelf: ['libreria', 'estante'],
  desk: ['mesa de trabajo', 'despacho'],
  fireplace: ['estufa'],
  sym_outlet: ['toma de corriente', 'electricidad'],
  sym_switch: ['llave de luz', 'electricidad'],
  sym_water_supply: ['fontaneria', 'grifo'],
  sym_drain: ['fontaneria', 'sumidero', 'bajante'],
  sym_water_heater: ['termo', 'caldera'],
};
