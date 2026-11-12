/**
 * Mediciones por estancia para presupuestar una reforma.
 *
 * Entrada: un Floor del editor (coordenadas en cm), por ejemplo el que devuelve
 * importRoomPlan() a partir de un escaneo del iPhone. Salida en metros y m².
 *
 * Convenios:
 * - Suelo y techo: superficie interior, entre caras de pared (interiorRoomArea).
 * - Perímetro: interior, recorrido por la cara de las paredes.
 * - Pared bruta: perímetro interior × altura de cada tramo.
 * - Pared neta: bruta menos puertas, pasos y ventanas de la estancia.
 * - Rodapié: perímetro interior menos el ancho de puertas y pasos.
 */
import type { Door, Floor, Point, Wall, Window } from '$lib/models/types';
import { resolveRoomGeometry } from '$lib/utils/roomDetection';
import { roomHoles } from '$lib/utils/roomNesting';
import { interiorRoomArea } from '$lib/utils/interiorArea';

export interface HuecoMedido {
  id: string;
  tipo: 'puerta' | 'paso' | 'ventana';
  ancho: number;
  alto: number;
  superficie: number;
}

export interface MedicionEstancia {
  id: string;
  nombre: string;
  /** m² de suelo entre caras de pared. null si la estancia no está cerrada. */
  suelo: number | null;
  /** m² de techo (igual que el suelo). */
  techo: number | null;
  /** Metros de perímetro interior. */
  perimetro: number;
  /** Altura media de las paredes, en metros. */
  altura: number;
  paredBruta: number;
  paredNeta: number;
  /** Metros de rodapié: perímetro sin los anchos de puertas y pasos. */
  rodapie: number;
  puertas: number;
  ventanas: number;
  superficieHuecos: number;
  huecos: HuecoMedido[];
}

export interface MedicionPlanta {
  planta: string;
  estancias: MedicionEstancia[];
  totales: {
    suelo: number; techo: number; paredBruta: number; paredNeta: number;
    perimetro: number; rodapie: number; puertas: number; ventanas: number;
  };
  /** Avisos para revisar antes de presupuestar. */
  avisos: string[];
}

/** Nombres que pone el importador de escaneos, en español. */
const NOMBRES: Record<string, string> = {
  'Living Room': 'Salón', Bedroom: 'Dormitorio', Kitchen: 'Cocina', Bathroom: 'Baño', 'Dining Room': 'Comedor',
  Laundry: 'Lavadero', Office: 'Despacho', Hallway: 'Pasillo', Garage: 'Garaje', Closet: 'Armario',
  Pantry: 'Despensa', Entryway: 'Recibidor', unidentified: 'Estancia',
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Distancia de un punto a un segmento (cm). */
function distSegmento(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function areaConSigno(poly: Point[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Pared de la estancia sobre la que cae un tramo del contorno. */
function paredDelTramo(a: Point, b: Point, candidatas: Wall[]): Wall | undefined {
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let mejor: Wall | undefined, d = Infinity;
  for (const w of candidatas) {
    const dw = distSegmento(m, w.start, w.end);
    if (dw < d) { d = dw; mejor = w; }
  }
  return mejor && d <= Math.max(2, mejor.thickness) ? mejor : undefined;
}

export function medirPlanta(floor: Floor): MedicionPlanta {
  const avisos: string[] = [];
  const geometria = resolveRoomGeometry(floor);
  const agujeros = roomHoles(geometria.map(g => g.polygon));
  const paredPorId = new Map(floor.walls.map(w => [w.id, w]));
  const asignados = new Set<string>();
  const estancias: MedicionEstancia[] = [];

  geometria.forEach((cara, i) => {
    const { room, polygon } = cara;
    if (room.floorOpening) return;
    const paredes = room.walls.map(id => paredPorId.get(id)).filter((w): w is Wall => !!w);
    const candidatas = paredes.length ? paredes : floor.walls;
    const antihorario = areaConSigno(polygon) > 0;
    const n = polygon.length;

    // Tramos del contorno con su pared (altura y grosor).
    const tramos = polygon.map((a, k) => {
      const b = polygon[(k + 1) % n];
      const w = paredDelTramo(a, b, candidatas);
      // Pared de escaneo sin grosor: su línea ya es la cara interior.
      return { a, b, largo: dist(a, b), alto: w?.height ?? 250, grosor: w?.caraEscaneada ? 0 : w?.thickness ?? 15 };
    });

    // Perímetro interior: cada esquina acorta (convexa) o alarga (cóncava) el
    // recorrido por la cara de la pared en 2·d·tan(giro/2), d = medio grosor.
    let perimetroCm = 0, brutaCm2 = 0;
    tramos.forEach((t, k) => {
      const ant = tramos[(k - 1 + n) % n], sig = tramos[(k + 1) % n];
      const giro = (u: typeof t, v: typeof t) => {
        const ux = u.b.x - u.a.x, uy = u.b.y - u.a.y, vx = v.b.x - v.a.x, vy = v.b.y - v.a.y;
        const ang = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        return antihorario ? ang : -ang;
      };
      const recorte = (ang: number, d: number) => d * Math.tan(Math.max(-1.4, Math.min(1.4, ang / 2)));
      const interior = Math.max(0, t.largo
        - recorte(giro(ant, t), (ant.grosor + t.grosor) / 4)
        - recorte(giro(t, sig), (t.grosor + sig.grosor) / 4));
      perimetroCm += interior;
      brutaCm2 += interior * t.alto;
    });

    // Huecos: los de las paredes de la estancia cuyo centro cae sobre su contorno.
    const huecos: HuecoMedido[] = [];
    const sobreContorno = (wallId: string, position: number) => {
      const w = paredPorId.get(wallId);
      if (!w || (paredes.length && !room.walls.includes(wallId))) return false;
      const p = { x: w.start.x + (w.end.x - w.start.x) * position, y: w.start.y + (w.end.y - w.start.y) * position };
      return tramos.some(t => distSegmento(p, t.a, t.b) <= Math.max(2, w.thickness));
    };
    for (const d of floor.doors as Door[]) if (sobreContorno(d.wallId, d.position)) {
      asignados.add(d.id);
      huecos.push({ id: d.id, tipo: d.type === 'opening' ? 'paso' : 'puerta', ancho: r2(d.width / 100), alto: r2(d.height / 100), superficie: r2(d.width * d.height / 10_000) });
    }
    for (const v of floor.windows as Window[]) if (sobreContorno(v.wallId, v.position)) {
      asignados.add(v.id);
      huecos.push({ id: v.id, tipo: 'ventana', ancho: r2(v.width / 100), alto: r2(v.height / 100), superficie: r2(v.width * v.height / 10_000) });
    }

    // En un escaneo sin grosores el contorno ya es la cara interior: el suelo es
    // el polígono tal cual, sin descontar medio grosor de pared.
    const escaneada = paredes.length > 0 && paredes.every(w => w.caraEscaneada);
    const suelo = escaneada
      ? (Math.abs(areaConSigno(polygon)) - agujeros[i].reduce((s, h) => s + Math.abs(areaConSigno(h)), 0)) / 10_000
      : interiorRoomArea(polygon, agujeros[i], floor.walls);
    if (suelo == null) avisos.push(`"${room.name}": no se pudo calcular el suelo (estancia no cerrada).`);
    const supHuecos = huecos.reduce((s, h) => s + h.ancho * h.alto, 0);
    const anchoPasos = huecos.filter(h => h.tipo !== 'ventana').reduce((s, h) => s + h.ancho, 0);
    const bruta = brutaCm2 / 10_000, perimetro = perimetroCm / 100;
    estancias.push({
      id: room.id, nombre: NOMBRES[room.name] ?? room.name,
      suelo: suelo == null ? null : r2(suelo), techo: suelo == null ? null : r2(suelo),
      perimetro: r2(perimetro), altura: r2(perimetro > 0 ? bruta / perimetro : 0),
      paredBruta: r2(bruta), paredNeta: r2(Math.max(0, bruta - supHuecos)),
      rodapie: r2(Math.max(0, perimetro - anchoPasos)),
      puertas: huecos.filter(h => h.tipo !== 'ventana').length,
      ventanas: huecos.filter(h => h.tipo === 'ventana').length,
      superficieHuecos: r2(supHuecos), huecos,
    });
  });

  const sueltos = [...floor.doors, ...floor.windows].filter(h => !asignados.has(h.id)).length;
  if (sueltos) avisos.push(`${sueltos} puerta(s)/ventana(s) no pertenecen a ninguna estancia cerrada y no se han descontado.`);
  if (!estancias.length && floor.walls.length) avisos.push('No hay ninguna estancia cerrada: revisa que las paredes se toquen en las esquinas.');

  const unicos = (f: (h: HuecoMedido) => boolean) => new Set(estancias.flatMap(e => e.huecos.filter(f).map(h => h.id))).size;
  const suma = (f: (e: MedicionEstancia) => number) => r2(estancias.reduce((s, e) => s + f(e), 0));
  return {
    planta: floor.name, estancias, avisos,
    totales: {
      suelo: suma(e => e.suelo ?? 0), techo: suma(e => e.techo ?? 0),
      paredBruta: suma(e => e.paredBruta), paredNeta: suma(e => e.paredNeta),
      perimetro: suma(e => e.perimetro), rodapie: suma(e => e.rodapie),
      // Una puerta entre dos estancias cuenta en ambas, pero una sola vez en el total.
      puertas: unicos(h => h.tipo !== 'ventana'), ventanas: unicos(h => h.tipo === 'ventana'),
    },
  };
}
