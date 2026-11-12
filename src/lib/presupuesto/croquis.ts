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

/** Un tramo de pared del contorno, recorrido en el sentido de las agujas del
 * reloj empezando por la esquina superior izquierda. */
export type Direccion = 'derecha' | 'abajo' | 'izquierda' | 'arriba';
export const DIRECCIONES: Direccion[] = ['derecha', 'abajo', 'izquierda', 'arriba'];
export interface Tramo { dir: Direccion; largo: number }

export interface HuecoCroquis { pared: LadoPared; ancho: number; alto?: number }
export interface EstanciaCroquis {
  nombre: string;
  /** Medidas interiores en centímetros. */
  ancho: number;
  largo: number;
  alto?: number;
  puertas: HuecoCroquis[];
  ventanas: HuecoCroquis[];
  /** Estancias no rectangulares (en L, en U…): tramos de pared en orden. Si
   * está presente y cierra, manda sobre ancho × largo. */
  contorno?: Tramo[];
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

const PASO: Record<Direccion, [number, number]> = { derecha: [1, 0], abajo: [0, 1], izquierda: [-1, 0], arriba: [0, -1] };

/** Vértices del contorno (cm, y hacia abajo) y lo que le falta para cerrar. */
export function trazarContorno(contorno: Tramo[]) {
  const puntos = [{ x: 0, y: 0 }];
  for (const t of contorno) {
    const u = puntos[puntos.length - 1], [dx, dy] = PASO[t.dir];
    puntos.push({ x: u.x + dx * t.largo, y: u.y + dy * t.largo });
  }
  const fin = puntos.pop()!;
  let area2 = 0;
  for (let i = 0; i < puntos.length; i++) { const a = puntos[i], b = puntos[(i + 1) % puntos.length]; area2 += a.x * b.y - b.x * a.y; }
  const xs = puntos.map(p => p.x), ys = puntos.map(p => p.y);
  return {
    puntos, desfaseX: Math.round(fin.x), desfaseY: Math.round(fin.y),
    cierra: contorno.length >= 4 && Math.abs(fin.x) <= 2 && Math.abs(fin.y) <= 2 && Math.abs(area2) > 0,
    /** m², válido solo si cierra. */
    area: Math.abs(area2) / 2 / 10_000, horario: area2 > 0,
    ancho: Math.max(...xs) - Math.min(...xs), largo: Math.max(...ys) - Math.min(...ys),
  };
}

/** Superficie de suelo de una estancia del croquis, en m². */
export function superficieCroquis(e: EstanciaCroquis): number {
  const t = e.contorno?.length ? trazarContorno(e.contorno) : null;
  return t?.cierra ? t.area : e.ancho * e.largo / 10_000;
}

function leerContorno(valor: unknown): Tramo[] | undefined {
  if (!Array.isArray(valor) || valor.length < 4 || valor.length > 40) return undefined;
  const tramos: Tramo[] = [];
  for (const t of valor) {
    const largo = numero(t?.largo);
    if (!DIRECCIONES.includes(t?.dir) || largo == null || largo <= 0 || largo > MAX_CM) return undefined;
    tramos.push({ dir: t.dir, largo: Math.round(largo) });
  }
  return tramos;
}

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
    const nombre = typeof e?.nombre === 'string' && e.nombre.trim() ? e.nombre.trim().slice(0, 60) : `Estancia ${estancias.length + 1}`;
    const contorno = leerContorno(e?.contorno);
    const traza = contorno ? trazarContorno(contorno) : null;
    // Con contorno, el ancho y el largo son los del rectángulo que lo envuelve.
    const ancho = traza && traza.ancho >= MIN_CM ? traza.ancho : numero(e?.ancho);
    const largo = traza && traza.largo >= MIN_CM ? traza.largo : numero(e?.largo);
    if (traza && !traza.cierra) notas.push(`"${nombre}": las medidas del contorno no cierran (sobran o faltan ${Math.abs(traza.desfaseX)} cm en horizontal y ${Math.abs(traza.desfaseY)} cm en vertical). Revísalas.`);
    if (ancho == null || largo == null || ancho < MIN_CM || largo < MIN_CM || ancho > MAX_CM || largo > MAX_CM) {
      notas.push(`"${nombre}": no se pudieron leer sus medidas; añádela a mano.`);
      continue;
    }
    const alto = numero(e?.alto);
    estancias.push({
      nombre, ancho: Math.round(ancho), largo: Math.round(largo),
      alto: alto != null && alto >= 150 && alto <= 600 ? Math.round(alto) : undefined,
      puertas: leerHuecos(e?.puertas, 203), ventanas: leerHuecos(e?.ventanas, 120),
      ...(contorno ? { contorno } : {}),
      dudosa: e?.dudosa === true || (traza != null && !traza.cierra),
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
    const traza = e.contorno?.length ? trazarContorno(e.contorno) : null;
    if (traza?.cierra) {
      // Estancia con contorno propio: cada tramo es una pared trazada por su
      // cara interior (caraEscaneada), así las mediciones salen exactas.
      const minX = Math.min(...traza.puntos.map(p => p.x)), minY = Math.min(...traza.puntos.map(p => p.y));
      const pts = traza.puntos.map(p => ({ x: x + p.x - minX, y: p.y - minY }));
      const paredes = pts.map((a, k): Wall => ({ id: uid(), start: { ...a }, end: { ...pts[(k + 1) % pts.length] }, thickness: GROSOR, height: alto, startHeight: alto, endHeight: alto, color: '#444444', caraEscaneada: true }));
      floor.walls.push(...paredes);
      nombres.push({ walls: new Set(paredes.map(p => p.id)), nombre: e.nombre });
      // Lado al que da cada tramo: en sentido horario, el que va a la derecha es el de arriba.
      const ladoDe: Record<Direccion, LadoPared> = traza.horario
        ? { derecha: 'arriba', abajo: 'derecha', izquierda: 'abajo', arriba: 'izquierda' }
        : { derecha: 'abajo', abajo: 'izquierda', izquierda: 'arriba', arriba: 'derecha' };
      for (const lado of LADOS) {
        // Los huecos de un lado van al tramo más largo que da a ese lado.
        const candidatos = e.contorno!.map((t, k) => ({ t, k })).filter(c => ladoDe[c.t.dir] === lado).sort((a, b) => b.t.largo - a.t.largo);
        if (!candidatos.length) continue;
        const paredLado = paredes[candidatos[0].k];
        const enPared = [...e.puertas.filter(p => p.pared === lado).map(p => ({ ...p, tipo: 'puerta' as const })), ...e.ventanas.filter(v => v.pared === lado).map(v => ({ ...v, tipo: 'ventana' as const }))];
        enPared.forEach((hueco, i) => {
          const position = (i + 1) / (enPared.length + 1);
          if (hueco.tipo === 'puerta') floor.doors.push({ id: uid(), wallId: paredLado.id, position, width: hueco.ancho, height: Math.min(hueco.alto ?? 203, alto), type: 'single', swingDirection: 'left', flipSide: false });
          else { const av = Math.min(hueco.alto ?? 120, alto - 10); floor.windows.push({ id: uid(), wallId: paredLado.id, position, width: hueco.ancho, height: av, sillHeight: Math.max(0, Math.min(90, alto - av)), type: 'standard' }); }
        });
      }
      x += traza.ancho + GROSOR + SEPARACION;
      continue;
    }
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
- Si una estancia NO es rectangular (en L, en U, con un retranqueo…), añade además "contorno": la lista de sus tramos de pared en orden, en el sentido de las agujas del reloj y empezando por la esquina superior izquierda. Cada tramo es {"dir":"derecha"|"abajo"|"izquierda"|"arriba","largo":cm}. Ejemplo de una L: [{"dir":"derecha","largo":320},{"dir":"abajo","largo":410},{"dir":"izquierda","largo":280},{"dir":"arriba","largo":230},{"dir":"izquierda","largo":40},{"dir":"arriba","largo":180}]. En ese caso "ancho" y "largo" son los del rectángulo que la envuelve.
- En el contorno, si falta la cota de UN tramo y se deduce restando las demás (por ejemplo 410 − 180 = 230), puedes ponerla, pero dilo en "notas" y marca "dudosa": true.
- Si las cotas escritas se contradicen entre sí (el contorno no cierra), pon las cotas tal como están escritas, marca "dudosa": true y explica en "notas" cuáles no cuadran. No las ajustes tú.
- Omite "alto" si la altura no está escrita.
- Pon el nombre que figure en el croquis; si no hay, usa "Estancia 1", "Estancia 2"...
- Sé breve en "notas": como mucho seis, de una frase cada una, solo con lo que el usuario deba revisar.
- La imagen puede ser un croquis a mano o un plano ya dibujado (impreso o fotografiado de una pantalla). Trátalos igual: lee las cotas escritas.
- Si varias estancias comparten paredes, da cada estancia por separado con sus propias medidas interiores.
- Si la imagen no es un croquis de planta con estancias, devuelve "estancias": [] y explícalo en "notas".`;
