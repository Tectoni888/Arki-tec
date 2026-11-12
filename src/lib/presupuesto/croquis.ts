/**
 * Croquis a mano → plano.
 *
 * La IA (o el usuario, a mano) da una lista de estancias rectangulares con sus
 * medidas interiores. Aquí se validan y se convierten en paredes, puertas y
 * ventanas del editor. Las estancias se colocan en fila, separadas, para que
 * el usuario las recoloque; las mediciones no dependen de su posición.
 */
import type { Door, Project, Wall, Window } from '$lib/models/types';
import { createDefaultFloor, createDefaultProject } from '$lib/stores/project';
import { detectRooms } from '$lib/utils/roomDetection';

export type LadoPared = 'arriba' | 'derecha' | 'abajo' | 'izquierda';
export const LADOS: LadoPared[] = ['arriba', 'derecha', 'abajo', 'izquierda'];

export interface HuecoCroquis { pared: LadoPared; ancho: number; alto?: number }
export interface EstanciaCroquis {
  nombre: string;
  /** Medidas interiores en centímetros. */
  ancho: number;
  largo: number;
  alto?: number;
  puertas: HuecoCroquis[];
  ventanas: HuecoCroquis[];
  /** La IA no está segura de alguna cota de esta estancia. */
  dudosa?: boolean;
}
export interface LecturaCroquis { estancias: EstanciaCroquis[]; notas: string[] }

export const ALTURA_POR_DEFECTO = 250, GROSOR = 10, SEPARACION = 100;
const MIN_CM = 30, MAX_CM = 5000;

const uid = () => `cr-${Math.random().toString(36).slice(2, 10)}`;
const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function leerHuecos(valor: unknown, altoPorDefecto: number): HuecoCroquis[] {
  if (!Array.isArray(valor)) return [];
  const huecos: HuecoCroquis[] = [];
  for (const h of valor.slice(0, 12)) {
    const ancho = numero(h?.ancho);
    if (ancho == null || ancho < 20 || ancho > 1000) continue;
    const pared = LADOS.includes(h?.pared) ? h.pared as LadoPared : 'abajo';
    const alto = numero(h?.alto);
    huecos.push({ pared, ancho: Math.round(ancho), alto: alto != null && alto >= 20 && alto <= 400 ? Math.round(alto) : altoPorDefecto });
  }
  return huecos;
}

/** Normaliza lo que devuelve la IA. Descarta lo ilegible en vez de inventar medidas. */
export function validarLectura(dato: unknown): LecturaCroquis {
  const fuente = dato as { estancias?: unknown; notas?: unknown } | null;
  const notas = Array.isArray(fuente?.notas) ? fuente!.notas.filter((n): n is string => typeof n === 'string').slice(0, 20) : [];
  const estancias: EstanciaCroquis[] = [];
  if (Array.isArray(fuente?.estancias)) for (const e of fuente!.estancias.slice(0, 40)) {
    const ancho = numero(e?.ancho), largo = numero(e?.largo);
    const nombre = typeof e?.nombre === 'string' && e.nombre.trim() ? e.nombre.trim().slice(0, 60) : `Estancia ${estancias.length + 1}`;
    if (ancho == null || largo == null || ancho < MIN_CM || largo < MIN_CM || ancho > MAX_CM || largo > MAX_CM) {
      notas.push(`"${nombre}": no se pudieron leer sus medidas; añádela a mano.`);
      continue;
    }
    const alto = numero(e?.alto);
    estancias.push({
      nombre, ancho: Math.round(ancho), largo: Math.round(largo),
      alto: alto != null && alto >= 150 && alto <= 600 ? Math.round(alto) : undefined,
      puertas: leerHuecos(e?.puertas, 203), ventanas: leerHuecos(e?.ventanas, 120),
      dudosa: e?.dudosa === true,
    });
  }
  return { estancias, notas };
}

/** Crea un proyecto del editor con una estancia rectangular por cada entrada. */
export function proyectoDesdeCroquis(estancias: EstanciaCroquis[], nombre = 'Croquis'): Project {
  const project = createDefaultProject(nombre);
  const floor = createDefaultFloor(0);
  floor.name = 'Planta';
  const nombres: { walls: Set<string>; nombre: string }[] = [];
  let x = 0;
  for (const e of estancias) {
    const alto = e.alto ?? ALTURA_POR_DEFECTO;
    // Las medidas del croquis son interiores: los ejes van medio grosor por fuera.
    const w = e.ancho + GROSOR, h = e.largo + GROSOR;
    const tl = { x, y: 0 }, tr = { x: x + w, y: 0 }, br = { x: x + w, y: h }, bl = { x, y: h };
    const pared = (start: typeof tl, end: typeof tl): Wall =>
      ({ id: uid(), start: { ...start }, end: { ...end }, thickness: GROSOR, height: alto, startHeight: alto, endHeight: alto, color: '#444444' });
    const lados: Record<LadoPared, Wall> = { arriba: pared(tl, tr), derecha: pared(tr, br), abajo: pared(br, bl), izquierda: pared(bl, tl) };
    floor.walls.push(...Object.values(lados));
    nombres.push({ walls: new Set(Object.values(lados).map(l => l.id)), nombre: e.nombre });

    // Reparte los huecos de cada pared a distancias iguales.
    for (const lado of LADOS) {
      const enPared = [
        ...e.puertas.filter(p => p.pared === lado).map(p => ({ ...p, tipo: 'puerta' as const })),
        ...e.ventanas.filter(v => v.pared === lado).map(v => ({ ...v, tipo: 'ventana' as const })),
      ];
      enPared.forEach((hueco, i) => {
        const position = (i + 1) / (enPared.length + 1);
        if (hueco.tipo === 'puerta') {
          const door: Door = { id: uid(), wallId: lados[lado].id, position, width: hueco.ancho, height: Math.min(hueco.alto ?? 203, alto), type: 'single', swingDirection: 'left', flipSide: false };
          floor.doors.push(door);
        } else {
          const altoVentana = Math.min(hueco.alto ?? 120, alto - 10);
          const win: Window = { id: uid(), wallId: lados[lado].id, position, width: hueco.ancho, height: altoVentana, sillHeight: Math.max(0, Math.min(90, alto - altoVentana)), type: 'standard' };
          floor.windows.push(win);
        }
      });
    }
    x += w + SEPARACION;
  }
  // Estancias detectadas con el nombre que traía el croquis.
  floor.rooms = detectRooms(floor.walls).map(room => {
    const origen = nombres.find(n => room.walls.every(id => n.walls.has(id)));
    return origen ? { ...room, name: origen.nombre } : room;
  });
  project.floors = [floor];
  project.activeFloorId = floor.id;
  return project;
}

/** Instrucciones para el modelo de visión. */
export const PROMPT_CROQUIS = `Eres un técnico de reformas que pasa a limpio croquis hechos a mano.
En la imagen hay un croquis de una o varias estancias con cotas escritas a mano.

Devuelve SOLO un objeto JSON, sin texto alrededor, con esta forma:
{"estancias":[{"nombre":"Baño","ancho":240,"largo":180,"alto":250,"puertas":[{"pared":"abajo","ancho":72}],"ventanas":[{"pared":"arriba","ancho":100,"alto":120}],"dudosa":false}],"notas":["..."]}

Reglas:
- Todas las medidas en CENTÍMETROS, como números. Convierte metros a centímetros (3,45 m → 345).
- "ancho" es la medida horizontal de la estancia tal como está dibujada y "largo" la vertical. Son medidas interiores.
- "pared" es uno de: "arriba", "derecha", "abajo", "izquierda", según la posición en el dibujo.
- Usa únicamente cotas que estén ESCRITAS en el croquis. No midas el dibujo ni estimes a ojo.
- Si una cota es ilegible o falta, pon null en ese campo, marca "dudosa": true y explica en "notas" qué falta.
- Si una estancia no es rectangular, da el rectángulo que la envuelve, marca "dudosa": true y descríbelo en "notas".
- Omite "alto" si la altura no está escrita.
- Pon el nombre que figure en el croquis; si no hay, usa "Estancia 1", "Estancia 2"...
- Si la imagen no es un croquis de planta con estancias, devuelve "estancias": [] y explícalo en "notas".`;
