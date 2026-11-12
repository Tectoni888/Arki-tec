<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { openProject } from '$lib/services/projectOpening';
  import { DIRECCIONES, LADOS, proyectoDesdeCroquis, superficieCroquis, trazarContorno, type EstanciaCroquis, type LecturaCroquis } from '$lib/presupuesto/croquis';

  const vida = new AbortController();
  onDestroy(() => vida.abort());

  let foto = $state<string | null>(null);
  let leyendo = $state(false);
  let error = $state<string | null>(null);
  let notas = $state<string[]>([]);
  let estancias = $state<EstanciaCroquis[]>([]);
  let nombreProyecto = $state('Croquis');
  let creando = $state(false);

  const traza = (e: EstanciaCroquis) => e.contorno?.length ? trazarContorno(e.contorno) : null;
  const validas = $derived(estancias.filter(e => e.contorno?.length ? traza(e)!.cierra : e.ancho >= 30 && e.largo >= 30));
  /** Estancias cuyo contorno no cierra: hay que corregirlas antes de crear el plano. */
  const sinCerrar = $derived(estancias.filter(e => e.contorno?.length && !traza(e)!.cierra));

  /** Cambios de UNA cota que harían cerrar el contorno en un eje. Decide el usuario cuál es la equivocada. */
  function arreglos(e: EstanciaCroquis) {
    const t = traza(e);
    if (!t || t.cierra) return [];
    const lista: { tramo: number; antes: number; nuevo: number }[] = [];
    e.contorno!.forEach((tr, k) => {
      const d = tr.dir === 'derecha' ? -t.desfaseX : tr.dir === 'izquierda' ? t.desfaseX : tr.dir === 'abajo' ? -t.desfaseY : t.desfaseY;
      if (d !== 0 && tr.largo + d > 0) lista.push({ tramo: k, antes: tr.largo, nuevo: tr.largo + d });
    });
    return lista;
  }
  const m2 = (e: EstanciaCroquis) => superficieCroquis(e).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  /** Pasa de rectángulo a contorno editable (para estancias en L, en U…). */
  function formaLibre(e: EstanciaCroquis) {
    e.contorno = [{ dir: 'derecha', largo: e.ancho }, { dir: 'abajo', largo: e.largo }, { dir: 'izquierda', largo: e.ancho }, { dir: 'arriba', largo: e.largo }];
  }
  function añadirTramo(e: EstanciaCroquis) { e.contorno = [...(e.contorno ?? []), { dir: 'derecha', largo: 100 }]; }
  function quitarTramo(e: EstanciaCroquis, i: number) { e.contorno = e.contorno!.filter((_, k) => k !== i); }

  /** Reduce la foto a 1600 px de lado mayor: se lee igual y sube mucho más rápido. */
  async function prepararFoto(archivo: File): Promise<string> {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala); canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  async function alElegirFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    error = null; notas = [];
    try { foto = await prepararFoto(archivo); } catch { error = 'No se pudo abrir la foto. Prueba con otra.'; return; }
    leyendo = true;
    try {
      const r = await fetch(`${base}/api/croquis`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imagen: foto }) });
      const datos = await r.json().catch(() => null);
      if (!r.ok) { error = datos?.error ?? 'No se pudo leer el croquis.'; return; }
      const lectura = datos as LecturaCroquis;
      estancias = [...estancias, ...lectura.estancias];
      notas = lectura.notas;
      if (!lectura.estancias.length && !lectura.notas.length) error = 'No se ha reconocido ninguna estancia con medidas en la foto.';
    } catch {
      error = 'No se pudo leer el croquis. Revisa la conexión.';
    } finally { leyendo = false; }
  }

  function añadir() { estancias = [...estancias, { nombre: `Estancia ${estancias.length + 1}`, ancho: 300, largo: 300, puertas: [{ pared: 'abajo', ancho: 72, alto: 203 }], ventanas: [] }]; }
  function quitar(i: number) { estancias = estancias.filter((_, k) => k !== i); }
  function añadirHueco(e: EstanciaCroquis, tipo: 'puertas' | 'ventanas') {
    e[tipo] = [...e[tipo], tipo === 'puertas' ? { pared: 'abajo', ancho: 72, alto: 203 } : { pared: 'arriba', ancho: 100, alto: 120 }];
  }
  function quitarHueco(e: EstanciaCroquis, tipo: 'puertas' | 'ventanas', i: number) { e[tipo] = e[tipo].filter((_, k) => k !== i); }

  async function crearPlano() {
    if (!validas.length || creando) return;
    creando = true; error = null;
    try {
      const datos = $state.snapshot(validas) as EstanciaCroquis[];
      const proyecto = await openProject(() => proyectoDesdeCroquis(datos, nombreProyecto.trim() || 'Croquis'), 'new', vida.signal);
      if (proyecto) await goto(`${base}/editor?id=${encodeURIComponent(proyecto.id)}`);
    } catch { error = 'No se pudo crear el plano.'; }
    finally { creando = false; }
  }
</script>

<svelte:head><title>Leer croquis · Arki-Tec</title></svelte:head>

<main class="min-h-screen bg-gray-50 text-gray-800">
  <header class="bg-slate-800 text-white px-4 py-3 flex items-center gap-3">
    <a href="{base}/" class="text-sm text-slate-300 hover:text-white">← Proyectos</a>
    <h1 class="text-lg font-semibold">Leer croquis a mano</h1>
  </header>

  <div class="max-w-3xl mx-auto p-4 space-y-4">
    <section class="bg-white rounded-xl border border-gray-200 p-4">
      <h2 class="font-semibold mb-1">1. Foto del croquis</h2>
      <p class="text-sm text-gray-500 mb-3">Haz la foto de frente, con buena luz y con las medidas escritas legibles. La IA lee las cotas escritas; no mide el dibujo.</p>
      <div class="flex flex-wrap gap-2">
        <label class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium cursor-pointer hover:bg-blue-700">
          📷 Hacer foto
          <input type="file" accept="image/*" capture="environment" class="hidden" onchange={alElegirFoto} disabled={leyendo} />
        </label>
        <label class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-100">
          🖼 Elegir de la galería
          <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange={alElegirFoto} disabled={leyendo} />
        </label>
        <button class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100" onclick={añadir}>＋ Añadir estancia a mano</button>
      </div>
      {#if leyendo}<p class="mt-3 text-sm text-blue-700" role="status">Leyendo el croquis… puede tardar medio minuto.</p>{/if}
      {#if error}<p class="mt-3 text-sm text-red-700" role="alert">{error}</p>{/if}
      {#if foto}<img src={foto} alt="Foto del croquis" class="mt-3 max-h-72 rounded-lg border border-gray-200" />{/if}
    </section>

    {#if notas.length}
      <section class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <h2 class="font-semibold mb-1">Notas de la lectura</h2>
        <ul class="list-disc pl-5 space-y-1">{#each notas as nota}<li>{nota}</li>{/each}</ul>
      </section>
    {/if}

    {#if estancias.length}
      <section class="bg-white rounded-xl border border-gray-200 p-4">
        <h2 class="font-semibold mb-1">2. Revisa las medidas</h2>
        <p class="text-sm text-gray-500 mb-3">Compáralas con el croquis y corrige lo que haga falta. Medidas interiores, en centímetros.</p>
        <div class="space-y-3">
          {#each estancias as e, i}
            <div class="rounded-lg border p-3 {e.dudosa ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}">
              <div class="flex flex-wrap items-end gap-2">
                <label class="text-xs text-gray-500 grow min-w-32">Nombre
                  <input class="mt-1 block w-full rounded border border-gray-300 p-1.5 text-sm text-gray-800" bind:value={e.nombre} />
                </label>
                {#if !e.contorno?.length}
                <label class="text-xs text-gray-500 w-20">Ancho cm
                  <input type="number" min="30" class="mt-1 block w-full rounded border border-gray-300 p-1.5 text-sm text-gray-800" bind:value={e.ancho} />
                </label>
                <label class="text-xs text-gray-500 w-20">Largo cm
                  <input type="number" min="30" class="mt-1 block w-full rounded border border-gray-300 p-1.5 text-sm text-gray-800" bind:value={e.largo} />
                </label>
                {/if}
                <label class="text-xs text-gray-500 w-20">Alto cm
                  <input type="number" min="150" placeholder="250" class="mt-1 block w-full rounded border border-gray-300 p-1.5 text-sm text-gray-800" bind:value={e.alto} />
                </label>
                <span class="text-sm font-medium w-20 text-right pb-1.5">{m2(e)} m²</span>
                <button class="text-sm text-red-600 hover:underline pb-1.5" onclick={() => quitar(i)} aria-label="Quitar {e.nombre}">Quitar</button>
              </div>
              {#if e.contorno?.length}
                {@const t = traza(e)!}
                <div class="mt-3">
                  <p class="text-xs text-gray-500 mb-1">Contorno: paredes en orden, en el sentido de las agujas del reloj, desde la esquina superior izquierda.</p>
                  <div class="flex flex-wrap gap-2">
                    {#each e.contorno as tramo, k}
                      <span class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                        {k + 1}.
                        <select class="rounded border border-gray-300 bg-white p-0.5" bind:value={tramo.dir} aria-label="Dirección del tramo {k + 1}">
                          {#each DIRECCIONES as d}<option value={d}>{d === 'derecha' ? '→ derecha' : d === 'abajo' ? '↓ abajo' : d === 'izquierda' ? '← izquierda' : '↑ arriba'}</option>{/each}
                        </select>
                        <input type="number" min="1" class="w-16 rounded border border-gray-300 p-0.5" bind:value={tramo.largo} aria-label="Longitud del tramo {k + 1} en cm" /> cm
                        <button class="text-red-600" onclick={() => quitarTramo(e, k)} aria-label="Quitar tramo {k + 1}">×</button>
                      </span>
                    {/each}
                    <button class="text-xs text-blue-700 hover:underline" onclick={() => añadirTramo(e)}>＋ Tramo</button>
                  </div>
                  {#if t.cierra}
                    <p class="mt-2 text-xs text-green-700">✓ El contorno cierra. Superficie: {m2(e)} m².</p>
                  {:else}
                    <div class="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800" role="alert">
                      <p class="font-semibold">✗ Las medidas no cuadran entre sí: {t.desfaseX === 0 ? '' : `${Math.abs(t.desfaseX)} cm de diferencia en horizontal`}{t.desfaseX !== 0 && t.desfaseY !== 0 ? ' y ' : ''}{t.desfaseY === 0 ? '' : `${Math.abs(t.desfaseY)} cm en vertical`}.</p>
                      <p class="mt-1">Con estas cotas la estancia no se puede dibujar. Alguna está mal apuntada o mal leída. Elige cuál corregir (o cámbiala a mano arriba):</p>
                      <div class="mt-2 flex flex-wrap gap-2">
                        {#each arreglos(e) as a}
                          <button class="rounded bg-white border border-red-300 px-2 py-1 hover:bg-red-100" onclick={() => { e.contorno![a.tramo].largo = a.nuevo; }}>Tramo {a.tramo + 1}: {a.antes} → {a.nuevo} cm</button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  <button class="mt-1 text-xs text-gray-500 hover:underline" onclick={() => { e.contorno = undefined; }}>Volver a rectángulo</button>
                </div>
              {:else}
                <button class="mt-2 text-xs text-blue-700 hover:underline" onclick={() => formaLibre(e)}>No es rectangular (en L, en U…)</button>
              {/if}
              {#if e.dudosa}<p class="mt-2 text-xs text-amber-800">⚠ La IA no está segura de alguna medida de esta estancia.</p>{/if}
              {#each [['puertas', 'Puerta'], ['ventanas', 'Ventana']] as const as [tipo, etiqueta]}
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {#each e[tipo] as h, k}
                    <span class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1">
                      {etiqueta}
                      <select class="rounded border border-gray-300 bg-white p-0.5" bind:value={h.pared} aria-label="Pared">
                        {#each LADOS as lado}<option value={lado}>{lado}</option>{/each}
                      </select>
                      <input type="number" min="20" class="w-14 rounded border border-gray-300 p-0.5" bind:value={h.ancho} aria-label="Ancho en cm" />×
                      <input type="number" min="20" class="w-14 rounded border border-gray-300 p-0.5" bind:value={h.alto} aria-label="Alto en cm" /> cm
                      <button class="text-red-600" onclick={() => quitarHueco(e, tipo, k)} aria-label="Quitar {etiqueta.toLowerCase()}">×</button>
                    </span>
                  {/each}
                  <button class="text-blue-700 hover:underline" onclick={() => añadirHueco(e, tipo)}>＋ {etiqueta}</button>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </section>

      <section class="bg-white rounded-xl border border-gray-200 p-4">
        <h2 class="font-semibold mb-2">3. Crear el plano</h2>
        <div class="flex flex-wrap items-end gap-2">
          <label class="text-xs text-gray-500 grow">Nombre del proyecto
            <input class="mt-1 block w-full rounded border border-gray-300 p-2 text-sm text-gray-800" bind:value={nombreProyecto} />
          </label>
          <button class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50" onclick={crearPlano} disabled={!validas.length || creando}>
            {creando ? 'Creando…' : `Crear plano con ${validas.length} estancia${validas.length === 1 ? '' : 's'}`}
          </button>
        </div>
        {#if sinCerrar.length}
          <p class="mt-2 text-sm text-red-700" role="alert">Falta corregir {sinCerrar.length === 1 ? `"${sinCerrar[0].nombre}"` : `${sinCerrar.length} estancias`}: sus medidas no cuadran y no {sinCerrar.length === 1 ? 'se incluirá' : 'se incluirán'} en el plano hasta que cierren.</p>
        {/if}
        <p class="mt-2 text-xs text-gray-500">Las estancias se colocan en fila para que las muevas a su sitio en el editor. Las mediciones están en «Resumen de superficies».</p>
      </section>
    {/if}
  </div>
</main>
