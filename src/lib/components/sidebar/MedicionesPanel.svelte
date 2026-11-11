<script lang="ts">
  import { activeFloor } from '$lib/stores/project';
  import { medirPlanta, type MedicionPlanta } from '$lib/presupuesto/mediciones';

  // Mediciones de la planta activa, recalculadas con cada cambio del plano.
  let medicion = $derived.by<MedicionPlanta | null>(() => {
    if (!$activeFloor) return null;
    try { return medirPlanta($activeFloor); } catch { return null; }
  });

  const n = (v: number | null) => v == null ? '—' : v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function descargarCSV() {
    if (!medicion) return;
    const c = (v: number | null) => v == null ? '' : v.toFixed(2).replace('.', ',');
    const filas = [
      ['Estancia', 'Suelo m2', 'Techo m2', 'Perímetro m', 'Altura m', 'Pared bruta m2', 'Pared neta m2', 'Rodapié m', 'Puertas', 'Ventanas'],
      ...medicion.estancias.map(e => [e.nombre, c(e.suelo), c(e.techo), c(e.perimetro), c(e.altura), c(e.paredBruta), c(e.paredNeta), c(e.rodapie), String(e.puertas), String(e.ventanas)]),
      ['TOTAL', c(medicion.totales.suelo), c(medicion.totales.techo), c(medicion.totales.perimetro), '', c(medicion.totales.paredBruta), c(medicion.totales.paredNeta), c(medicion.totales.rodapie), String(medicion.totales.puertas), String(medicion.totales.ventanas)],
    ];
    // Punto y coma y BOM: así Excel en español lo abre directamente en columnas.
    const texto = '﻿' + filas.map(f => f.map(v => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `mediciones-${medicion.planta}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="p-4 border-t border-gray-200" aria-label="Mediciones para presupuesto">
  <div class="flex items-center justify-between mb-2">
    <h3 class="text-sm font-semibold text-gray-800">Mediciones para presupuesto</h3>
    {#if medicion?.estancias.length}
      <button class="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onclick={descargarCSV}>Descargar Excel (CSV)</button>
    {/if}
  </div>
  {#if !medicion || !medicion.estancias.length}
    <p class="text-sm text-gray-500">Aún no hay estancias cerradas. Dibuja paredes o importa un escaneo.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full text-xs text-right text-gray-700">
        <thead>
          <tr class="text-gray-500 border-b border-gray-200">
            <th class="text-left py-1 pr-2 font-medium">Estancia</th>
            <th class="py-1 px-1 font-medium">Suelo m²</th>
            <th class="py-1 px-1 font-medium">Pared neta m²</th>
            <th class="py-1 px-1 font-medium">Pared bruta m²</th>
            <th class="py-1 px-1 font-medium">Perímetro m</th>
            <th class="py-1 px-1 font-medium">Rodapié m</th>
            <th class="py-1 px-1 font-medium">Altura m</th>
            <th class="py-1 pl-1 font-medium">P / V</th>
          </tr>
        </thead>
        <tbody>
          {#each medicion.estancias as e (e.id)}
            <tr class="border-b border-gray-100">
              <td class="text-left py-1 pr-2">{e.nombre}</td>
              <td class="py-1 px-1">{n(e.suelo)}</td>
              <td class="py-1 px-1">{n(e.paredNeta)}</td>
              <td class="py-1 px-1">{n(e.paredBruta)}</td>
              <td class="py-1 px-1">{n(e.perimetro)}</td>
              <td class="py-1 px-1">{n(e.rodapie)}</td>
              <td class="py-1 px-1">{n(e.altura)}</td>
              <td class="py-1 pl-1">{e.puertas} / {e.ventanas}</td>
            </tr>
          {/each}
          <tr class="font-semibold text-gray-900">
            <td class="text-left py-1 pr-2">Total</td>
            <td class="py-1 px-1">{n(medicion.totales.suelo)}</td>
            <td class="py-1 px-1">{n(medicion.totales.paredNeta)}</td>
            <td class="py-1 px-1">{n(medicion.totales.paredBruta)}</td>
            <td class="py-1 px-1">{n(medicion.totales.perimetro)}</td>
            <td class="py-1 px-1">{n(medicion.totales.rodapie)}</td>
            <td class="py-1 px-1"></td>
            <td class="py-1 pl-1">{medicion.totales.puertas} / {medicion.totales.ventanas}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-gray-500">Techo = suelo. Suelo medido entre caras de pared. La pared neta descuenta puertas y ventanas; el rodapié descuenta el ancho de las puertas.</p>
    {#each medicion.avisos as aviso}
      <p class="mt-1 text-xs text-amber-700">⚠ {aviso}</p>
    {/each}
  {/if}
</section>
