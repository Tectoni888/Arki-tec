<script lang="ts">
  import { activeFloor, currentProject } from '$lib/stores/project';
  import { medirPlanta } from '$lib/presupuesto/mediciones';
  import { CAPITULOS, CATALOGO_EJEMPLO, TRABAJOS, type Partida } from '$lib/presupuesto/catalogo';
  import { EMPRESA_VACIA, euros, importe, lineaManual, lineasDeTrabajo, totales, type DatosEmpresa, type Presupuesto } from '$lib/presupuesto/presupuesto';

  // Hasta que haya cuentas en la nube, todo esto se guarda en este dispositivo.
  const leer = <T,>(clave: string, defecto: T): T => {
    try { const v = localStorage.getItem(clave); return v ? { ...defecto, ...JSON.parse(v) } : defecto; } catch { return defecto; }
  };
  const guardar = (clave: string, valor: unknown) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } };

  const proyectoId = $currentProject?.id ?? 'sin-proyecto';
  const hoy = new Date().toLocaleDateString('es-ES');
  let empresa = $state<DatosEmpresa>(leer('arkitec.empresa', EMPRESA_VACIA));
  let precios = $state<Record<string, number>>(leer('arkitec.precios', {}));
  let p = $state<Presupuesto>(leer(`arkitec.presupuesto.${proyectoId}`, { numero: '', fecha: hoy, cliente: '', obra: $currentProject?.name ?? '', ivaPct: 21, lineas: [] }));

  $effect(() => guardar('arkitec.empresa', empresa));
  $effect(() => guardar('arkitec.precios', precios));
  $effect(() => guardar(`arkitec.presupuesto.${proyectoId}`, p));

  const catalogo = $derived<Partida[]>(CATALOGO_EJEMPLO.map(c => ({ ...c, precio: precios[c.id] ?? c.precio })));
  const medicion = $derived.by(() => { try { return $activeFloor ? medirPlanta($activeFloor) : null; } catch { return null; } });
  const t = $derived(totales(p));
  let trabajoPorEstancia = $state<Record<string, string>>({});
  let generando = $state(false);
  let error = $state('');

  function aplicarTrabajos() {
    if (!medicion) return;
    const nuevas = medicion.estancias.flatMap(e => trabajoPorEstancia[e.id] ? lineasDeTrabajo(trabajoPorEstancia[e.id], e, catalogo) : []);
    if (!nuevas.length) return;
    // Regenerar una estancia sustituye sus líneas automáticas; las manuales se conservan.
    const regeneradas = new Set(medicion.estancias.filter(e => trabajoPorEstancia[e.id]).map(e => e.nombre));
    p.lineas = [...p.lineas.filter(l => !(l.partidaId && regeneradas.has(l.estancia))), ...nuevas];
  }
  function quitar(id: string) { p.lineas = p.lineas.filter(l => l.id !== id); }

  async function descargarPdf() {
    generando = true; error = '';
    try {
      const { pdfPresupuesto } = await import('$lib/presupuesto/presupuestoPdf');
      pdfPresupuesto($state.snapshot(p) as Presupuesto, $state.snapshot(empresa) as DatosEmpresa)
        .save(`presupuesto-${(p.numero || p.obra || 'obra').replace(/[^\p{L}\p{N}_-]+/gu, '-')}.pdf`);
    } catch { error = 'No se pudo generar el PDF.'; }
    finally { generando = false; }
  }
  const campo = 'mt-1 block w-full rounded border border-gray-300 p-1.5 text-sm text-gray-800';
</script>

<div class="p-4 space-y-4 text-gray-800">
  <section class="grid grid-cols-2 sm:grid-cols-4 gap-2">
    <label class="text-xs text-gray-500 col-span-2">Cliente<input class={campo} bind:value={p.cliente} /></label>
    <label class="text-xs text-gray-500 col-span-2">Obra<input class={campo} bind:value={p.obra} /></label>
    <label class="text-xs text-gray-500">N.º<input class={campo} bind:value={p.numero} placeholder="2026-001" /></label>
    <label class="text-xs text-gray-500">Fecha<input class={campo} bind:value={p.fecha} /></label>
    <label class="text-xs text-gray-500">IVA %<input type="number" min="0" max="21" class={campo} bind:value={p.ivaPct} /></label>
  </section>

  <section class="rounded-lg border border-gray-200 p-3">
    <h3 class="text-sm font-semibold mb-1">Generar desde las mediciones</h3>
    {#if !medicion?.estancias.length}
      <p class="text-sm text-gray-500">Este plano aún no tiene estancias cerradas. Puedes añadir líneas a mano.</p>
    {:else}
      <p class="text-xs text-gray-500 mb-2">Elige qué se hace en cada estancia. Las cantidades salen del plano.</p>
      <div class="space-y-1.5">
        {#each medicion.estancias as e (e.id)}
          <label class="flex items-center gap-2 text-sm">
            <span class="grow truncate">{e.nombre} <span class="text-xs text-gray-400">· {e.suelo?.toLocaleString('es-ES') ?? '—'} m² de suelo · {e.paredNeta.toLocaleString('es-ES')} m² de pared</span></span>
            <select class="rounded border border-gray-300 bg-white p-1 text-sm" bind:value={trabajoPorEstancia[e.id]} aria-label="Trabajo en {e.nombre}">
              <option value="">Nada</option>
              {#each TRABAJOS as tr}<option value={tr.id}>{tr.nombre}</option>{/each}
            </select>
          </label>
        {/each}
      </div>
      <button class="mt-3 px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700" onclick={aplicarTrabajos}>Generar partidas</button>
    {/if}
  </section>

  <section>
    {#if !p.lineas.length}
      <p class="text-sm text-gray-500">El presupuesto está vacío.</p>
    {/if}
    {#each t.capitulos as cap, i (cap.capitulo)}
      <div class="mb-3">
        <div class="flex justify-between bg-slate-100 rounded px-2 py-1 text-sm font-semibold"><span>{i + 1}. {cap.capitulo}</span><span>{euros(cap.subtotal)}</span></div>
        {#each cap.lineas as l (l.id)}
          <div class="flex flex-wrap items-end gap-2 border-b border-gray-100 py-1.5">
            <label class="grow basis-64 text-[11px] text-gray-400">{l.estancia || 'General'}
              <input class="block w-full rounded border border-gray-200 p-1 text-sm text-gray-800" bind:value={l.descripcion} placeholder="Descripción" />
            </label>
            <label class="w-20 text-[11px] text-gray-400">Cantidad ({l.unidad})
              <input type="number" step="0.01" min="0" class="block w-full rounded border border-gray-200 p-1 text-sm text-right text-gray-800" bind:value={l.cantidad} />
            </label>
            <label class="w-20 text-[11px] text-gray-400">Precio €
              <input type="number" step="0.01" min="0" class="block w-full rounded border border-gray-200 p-1 text-sm text-right text-gray-800" bind:value={l.precio} />
            </label>
            <span class="w-24 text-right text-sm font-medium pb-1">{euros(importe(l))}</span>
            <button class="text-red-600 pb-1" onclick={() => quitar(l.id)} aria-label="Quitar línea">×</button>
          </div>
        {/each}
      </div>
    {/each}
    <div class="flex flex-wrap items-center gap-2">
      <button class="text-sm text-blue-700 hover:underline" onclick={() => { p.lineas = [...p.lineas, lineaManual()]; }}>＋ Añadir línea a mano</button>
      {#if p.lineas.length}<button class="text-sm text-gray-500 hover:underline" onclick={() => { p.lineas = []; }}>Vaciar presupuesto</button>{/if}
    </div>
  </section>

  <section class="ml-auto w-full sm:w-72 text-sm space-y-1">
    <div class="flex justify-between"><span>Base imponible</span><span>{euros(t.base)}</span></div>
    <div class="flex justify-between"><span>IVA {p.ivaPct} %</span><span>{euros(t.iva)}</span></div>
    <div class="flex justify-between text-base font-bold border-t border-gray-300 pt-1"><span>Total</span><span>{euros(t.total)}</span></div>
    <button class="mt-2 w-full px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50" onclick={descargarPdf} disabled={!p.lineas.length || generando}>{generando ? 'Generando…' : 'Descargar PDF'}</button>
    {#if error}<p class="text-red-700 text-xs" role="alert">{error}</p>{/if}
  </section>

  <details class="rounded-lg border border-gray-200 p-3">
    <summary class="text-sm font-semibold cursor-pointer">Datos de mi empresa</summary>
    <div class="grid grid-cols-2 gap-2 mt-2">
      <label class="text-xs text-gray-500 col-span-2">Nombre o razón social<input class={campo} bind:value={empresa.nombre} /></label>
      <label class="text-xs text-gray-500">NIF<input class={campo} bind:value={empresa.nif} /></label>
      <label class="text-xs text-gray-500">Teléfono<input class={campo} bind:value={empresa.telefono} /></label>
      <label class="text-xs text-gray-500 col-span-2">Dirección<input class={campo} bind:value={empresa.direccion} /></label>
      <label class="text-xs text-gray-500 col-span-2">Correo<input class={campo} bind:value={empresa.email} /></label>
      <label class="text-xs text-gray-500 col-span-2">Condiciones al pie del presupuesto<textarea rows="3" class={campo} bind:value={empresa.condiciones}></textarea></label>
    </div>
  </details>

  <details class="rounded-lg border border-gray-200 p-3">
    <summary class="text-sm font-semibold cursor-pointer">Mis precios</summary>
    <p class="text-xs text-amber-700 mt-2">Los precios que vienen puestos son de ejemplo. Cámbialos por los tuyos: se usarán al generar partidas.</p>
    {#each CAPITULOS as capitulo}
      {#if catalogo.some(c => c.capitulo === capitulo)}
        <p class="mt-2 text-xs font-semibold text-gray-600">{capitulo}</p>
        {#each catalogo.filter(c => c.capitulo === capitulo) as c (c.id)}
          <label class="flex items-center gap-2 text-sm py-0.5">
            <span class="grow">{c.descripcion}</span>
            <input type="number" step="0.01" min="0" class="w-20 rounded border border-gray-300 p-1 text-right" value={c.precio} onchange={(e) => { precios[c.id] = Number(e.currentTarget.value); }} aria-label="Precio de {c.descripcion}" />
            <span class="w-10 text-xs text-gray-500">€/{c.unidad}</span>
          </label>
        {/each}
      {/if}
    {/each}
  </details>
  <p class="text-xs text-gray-400">Los presupuestos, tus precios y los datos de empresa se guardan en este dispositivo.</p>
</div>
