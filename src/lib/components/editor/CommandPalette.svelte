<script lang="ts">
  import { t, locale } from '$lib/i18n';
  import { furnitureName } from '$lib/i18n/furnitureNames';
  import { catalogCategoryLabels } from '$lib/i18n/catalogCategories';
  import { exportPNGWithFeedback, exportPDFWithFeedback as exportPDF, exportSVGWithFeedback, exportDXFWithFeedback } from '$lib/stores/exportNotice';
  import { tick } from 'svelte';
  import { modalDialog } from '$lib/utils/modalDialog';
  import { furnitureCatalog } from '$lib/utils/furnitureCatalog';
  import { selectedTool, snapEnabled, placingFurnitureId, placingDoorType, placingWindowType, placingStair, placingColumn, placingColumnShape, undo, redo, currentProject, viewMode } from '$lib/stores/project';
  import { DOOR_CATALOG, WINDOW_CATALOG, SINONIMOS_MUEBLES, type Atajo } from '$lib/presupuesto/buscador';
  import { exportAsJSON } from '$lib/utils/export';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  type ResultItem = {
    id: string;
    name: string;
    icon: string;
    category: 'furniture' | 'tool' | 'action' | 'arkitec';
    categoryLabel: string;
    searchAliases?: string[];
    /** Una línea que explica qué hace o cómo se usa. */
    help?: string;
    action: () => void;
  };

  const tools: ResultItem[] = $derived([
    { id: 't-select', searchAliases: ['flecha','elegir','mover','cursor'], help: 'Haz clic en un elemento para moverlo o ver sus propiedades', name: $t('commandPalette.selectTool'), icon: '🔧', category: 'tool', categoryLabel: `🔧 ${$t('commandPalette.tool')}`, action: () => selectedTool.set('select') },
    { id: 't-wall', searchAliases: ['tabique','muro','pared','dibujar','trazar'], help: 'Clic para empezar, clic en cada esquina y doble clic para terminar', name: $t('commandPalette.wallTool'), icon: '🔧', category: 'tool', categoryLabel: `🔧 ${$t('commandPalette.tool')}`, action: () => selectedTool.set('wall') },
    { id: 't-door', searchAliases: ['puerta','paso','entrada'], help: 'Haz clic sobre una pared para colocarla', name: $t('commandPalette.doorTool'), icon: '🔧', category: 'tool', categoryLabel: `🔧 ${$t('commandPalette.tool')}`, action: () => selectedTool.set('door') },
    { id: 't-window', searchAliases: ['ventana','hueco','cristal'], help: 'Haz clic sobre una pared para colocarla', name: $t('commandPalette.windowTool'), icon: '🔧', category: 'tool', categoryLabel: `🔧 ${$t('commandPalette.tool')}`, action: () => selectedTool.set('window') },
    { id: 't-furniture', searchAliases: ['mueble','mobiliario','objeto','sanitario'], help: 'Abre el catálogo de muebles y sanitarios', name: $t('commandPalette.furnitureTool'), icon: '🔧', category: 'tool', categoryLabel: `🔧 ${$t('commandPalette.tool')}`, action: () => selectedTool.set('furniture') },
    { id: 't-text', searchAliases: ['nota','rotulo','escribir','etiqueta','anotar'], help: 'Haz clic en el plano para escribir una nota', name: $t('commandPalette.textTool'), icon: '🔧', category: 'tool', categoryLabel: `🔧 ${$t('commandPalette.tool')}`, action: () => selectedTool.set('text') },
  ]);

  const actions: ResultItem[] = $derived([
    { id: 'a-export-svg', searchAliases: ['vectorial','ilustrador'], help: 'Descarga el plano como dibujo vectorial', name: $t('commandPalette.exportSvg'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { const p = get(currentProject); if (p) exportSVGWithFeedback(p, get(locale)); } },
    { id: 'a-export-dxf', searchAliases: ['autocad','cad','dwg','plano tecnico'], help: 'Descarga el plano para abrirlo en AutoCAD', name: $t('commandPalette.exportDxf'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { const p = get(currentProject); if (p) exportDXFWithFeedback(p, get(locale)); } },
    { id: 'a-export-pdf', searchAliases: ['imprimir','plano pdf','documento'], help: 'Descarga el plano en PDF con el cuadro de superficies', name: $t('commandPalette.exportPdf'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { const p = get(currentProject); if (p) exportPDF(p, get(locale)); } },
    { id: 'a-export-png', searchAliases: ['imagen','foto','captura','jpg'], help: 'Descarga el plano como imagen', name: $t('commandPalette.exportPng'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { const p = get(currentProject); if (p) void exportPNGWithFeedback(p); } },
    { id: 'a-export-json', searchAliases: ['copia','respaldo','guardar archivo'], help: 'Descarga una copia del proyecto', name: $t('commandPalette.exportJson'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { const p = get(currentProject); if (p) exportAsJSON(p); } },
    { id: 'a-toggle-grid', searchAliases: ['cuadricula','malla'], help: 'Muestra u oculta la rejilla del plano', name: $t('commandPalette.toggleGrid'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); } },
    { id: 'a-toggle-snap', searchAliases: ['iman','alinear','ajustar a rejilla'], help: 'Hace que los elementos se alineen solos al moverlos', name: $t('commandPalette.toggleSnap'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { snapEnabled.update(v => !v); } },
    { id: 'a-zoom-fit', searchAliases: ['centrar','ver todo','encuadrar','zoom'], help: 'Encuadra el plano completo en pantalla', name: $t('commandPalette.zoomToFit'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })); } },
    { id: 'a-undo', searchAliases: ['atras','deshacer','ctrl z'], help: 'Deshace el último cambio', name: $t('commandPalette.undo'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => undo() },
    { id: 'a-redo', searchAliases: ['adelante','rehacer'], help: 'Vuelve a aplicar el cambio deshecho', name: $t('commandPalette.redo'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => redo() },
    { id: 'a-settings', searchAliases: ['ajustes','opciones','idioma','unidades','tema'], help: 'Unidades, cotas, apariencia e idioma', name: $t('settings.title'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { window.dispatchEvent(new CustomEvent('open-settings')); } },
    { id: 'a-new-project', searchAliases: ['inicio','proyectos','salir','biblioteca','nuevo'], help: 'Vuelve a la lista de proyectos', name: $t('library.new'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => goto(base || '/') },
    { id: 'a-toggle-3d', searchAliases: ['3d','tres dimensiones','perspectiva','volumen','render','vista'], help: 'Cambia entre el plano y la vista en 3D', name: $t('commandPalette.toggle2d3d'), icon: '⚡', category: 'action', categoryLabel: `⚡ ${$t('commandPalette.action')}`, action: () => { viewMode.update(m => m === '2d' ? '3d' : '2d'); } },
  ]);

  const furnitureItems: ResultItem[] = $derived(furnitureCatalog.map(f => ({
    id: `f-${f.id}`,
    name: furnitureName(f.id, $locale),
    icon: f.icon,
    category: 'furniture' as const,
    categoryLabel: `🪑 ${catalogCategoryLabels[f.category] ? $t(catalogCategoryLabels[f.category]) : f.category}`,
    searchAliases: [f.name, f.category, f.id, ...(SINONIMOS_MUEBLES[f.id] ?? [])],
    action: () => {
      selectedTool.set('furniture');
      placingFurnitureId.set(f.id);
    },
  })));

  const abrir = (que: string) => window.dispatchEvent(new CustomEvent('arkitec-abrir', { detail: que }));
  const deAtajo = (a: Atajo, action: () => void): ResultItem => ({ id: a.id, name: a.nombre, icon: a.icono, category: 'arkitec', categoryLabel: a.grupo, searchAliases: a.sinonimos, help: a.ayuda, action });

  // Funciones propias de Arki-Tec y herramientas que antes solo estaban en los paneles.
  const arkitec: ResultItem[] = $derived([
    deAtajo({ id: 'k-presupuesto', nombre: 'Presupuesto', icono: '€', grupo: '€ Presupuesto', sinonimos: ['precio', 'presupuestar', 'coste', 'importe', 'partidas', 'iva', 'factura', 'oferta', 'valorar', 'euros'], ayuda: 'Genera las partidas desde las mediciones y descarga el PDF' }, () => abrir('presupuesto')),
    deAtajo({ id: 'k-precios', nombre: 'Mis precios y datos de empresa', icono: '€', grupo: '€ Presupuesto', sinonimos: ['tarifa', 'catalogo', 'logo', 'empresa', 'condiciones', 'nif', 'precio por metro'], ayuda: 'Están al final de la pantalla de Presupuesto' }, () => abrir('presupuesto')),
    deAtajo({ id: 'k-mediciones', nombre: 'Mediciones y superficies', icono: '📐', grupo: '📐 Mediciones', sinonimos: ['metros', 'm2', 'metros cuadrados', 'superficie', 'area', 'perimetro', 'rodapie', 'excel', 'medir estancia', 'cuanto mide', 'paredes'], ayuda: 'Suelo, paredes, perímetro y rodapié de cada estancia; se descarga en Excel' }, () => abrir('mediciones')),
    deAtajo({ id: 'k-croquis', nombre: 'Leer croquis a mano', icono: '📝', grupo: '📥 Entrada', sinonimos: ['foto', 'dibujo', 'papel', 'boceto', 'camara', 'plano a mano', 'ia'], ayuda: 'Haz una foto a un croquis con medidas y se convierte en plano' }, () => goto(`${base}/croquis`)),
    deAtajo({ id: 'k-escaneo', nombre: 'Importar escaneo del iPhone', icono: '📱', grupo: '📥 Entrada', sinonimos: ['lidar', 'escanear', 'scan', 'roomplan', 'openplan3d', 'json', 'movil'], ayuda: 'En el panel izquierdo: Construir → Importar → Importar escaneo' }, () => abrir('construir')),
    deAtajo({ id: 'k-calco', nombre: 'Importar imagen para calcar', icono: '🖼', grupo: '📥 Entrada', sinonimos: ['plano de fondo', 'calcar', 'pdf antiguo', 'imagen'], ayuda: 'En el panel izquierdo: Construir → Importar → Importar imagen' }, () => abrir('construir')),
    ...DOOR_CATALOG.map(d => deAtajo({ id: `k-puerta-${d.tipo}`, nombre: `Puerta ${d.nombre}`, icono: '🚪', grupo: '🚪 Puertas', sinonimos: ['puerta', ...d.sinonimos], ayuda: `${d.ayuda} · haz clic sobre una pared para colocarla` }, () => { placingDoorType.set(d.tipo); selectedTool.set('door'); })),
    ...WINDOW_CATALOG.map(v => deAtajo({ id: `k-ventana-${v.tipo}`, nombre: `Ventana ${v.nombre}`, icono: '🪟', grupo: '🪟 Ventanas', sinonimos: ['ventana', ...v.sinonimos], ayuda: `${v.ayuda} · haz clic sobre una pared para colocarla` }, () => { placingWindowType.set(v.tipo); selectedTool.set('window'); })),
    deAtajo({ id: 'k-escalera', nombre: 'Escalera', icono: '🪜', grupo: '🧱 Estructura', sinonimos: ['escaleras', 'peldaños', 'subir planta'], ayuda: 'Haz clic en el plano para colocarla' }, () => { selectedTool.set('select'); placingStair.set(true); }),
    deAtajo({ id: 'k-pilar-redondo', nombre: 'Pilar redondo', icono: '⚫', grupo: '🧱 Estructura', sinonimos: ['columna', 'pilar', 'estructura'], ayuda: 'Haz clic en el plano para colocarlo' }, () => { selectedTool.set('select'); placingColumnShape.set('round'); placingColumn.set(true); }),
    deAtajo({ id: 'k-pilar-cuadrado', nombre: 'Pilar cuadrado', icono: '⬛', grupo: '🧱 Estructura', sinonimos: ['columna', 'pilar', 'estructura'], ayuda: 'Haz clic en el plano para colocarlo' }, () => { selectedTool.set('select'); placingColumnShape.set('square'); placingColumn.set(true); }),
    deAtajo({ id: 'k-medir', nombre: 'Medir una distancia', icono: '📏', grupo: '✏️ Anotar', sinonimos: ['regla', 'metro', 'distancia', 'cuanto hay'], ayuda: 'Haz clic en dos puntos del plano' }, () => selectedTool.set('measure')),
    deAtajo({ id: 'k-cota', nombre: 'Añadir una cota', icono: '↔', grupo: '✏️ Anotar', sinonimos: ['acotar', 'medida', 'dimension', 'cotas'], ayuda: 'Haz clic en dos puntos para dejar la medida escrita en el plano' }, () => selectedTool.set('annotate')),
    deAtajo({ id: 'k-capas', nombre: 'Capas: mostrar u ocultar elementos', icono: '🗂', grupo: '👁 Vista', sinonimos: ['ocultar muebles', 'esconder', 'ver paredes', 'capas', 'lista de elementos'], ayuda: 'Lista de paredes, puertas, muebles y estancias, con un ojo para ocultarlos' }, () => abrir('capas')),
    deAtajo({ id: 'k-historial', nombre: 'Historial de cambios', icono: '🕘', grupo: '👁 Vista', sinonimos: ['versiones', 'recuperar', 'volver atras', 'anterior'], ayuda: 'Vuelve a un estado anterior del plano' }, () => abrir('historial')),
    deAtajo({ id: 'k-imprimir', nombre: 'Imprimir el plano a escala', icono: '🖨', grupo: '📤 Salida', sinonimos: ['impresora', 'escala', 'papel', 'a4', 'a3'], ayuda: 'Elige tamaño de papel, orientación y escala' }, () => abrir('imprimir')),
    deAtajo({ id: 'k-atajos', nombre: 'Atajos de teclado', icono: '⌨', grupo: '❓ Ayuda', sinonimos: ['ayuda', 'teclas', 'como se hace'], ayuda: 'Lista de teclas rápidas del editor' }, () => abrir('atajos')),
    deAtajo({ id: 'k-materiales', nombre: 'Cambiar suelo o color de una estancia', icono: '🎨', grupo: '❓ Ayuda', sinonimos: ['material', 'suelo', 'parquet', 'azulejo', 'baldosa', 'color', 'textura', 'pintar'], ayuda: 'Selecciona la estancia en el plano: el material del suelo está en el panel derecho' }, () => selectedTool.set('select')),
    deAtajo({ id: 'k-altura', nombre: 'Cambiar altura o grosor de una pared', icono: '↕', grupo: '❓ Ayuda', sinonimos: ['altura', 'grosor', 'techo', 'alto', 'longitud', 'curva', 'pared curva'], ayuda: 'Selecciona la pared en el plano: sus medidas están en el panel derecho' }, () => selectedTool.set('select')),
    deAtajo({ id: 'k-renombrar', nombre: 'Cambiar el nombre de una estancia', icono: '🏷', grupo: '❓ Ayuda', sinonimos: ['renombrar', 'nombre', 'baño', 'cocina', 'dormitorio', 'salon'], ayuda: 'Selecciona la estancia en el plano y cambia su nombre en el panel derecho' }, () => selectedTool.set('select')),
    deAtajo({ id: 'k-planta', nombre: 'Añadir otra planta', icono: '🏢', grupo: '🧱 Estructura', sinonimos: ['piso', 'nivel', 'planta alta', 'sotano', 'duplex'], ayuda: 'Botón + junto al nombre de la planta, en la barra superior' }, () => {}),
  ]);

  const allItems = $derived([...tools, ...arkitec, ...actions, ...furnitureItems]);

  /** Lo que se ofrece antes de escribir nada: lo más usado en una reforma. */
  const INICIO = ['k-presupuesto', 'k-mediciones', 't-wall', 'k-puerta-single', 'k-ventana-standard', 't-furniture', 'k-medir', 'a-toggle-3d', 'a-export-pdf', 'a-export-dxf', 'k-croquis', 'k-capas'];

  function searchText(value: string) {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  let results = $derived.by(() => {
    const q = searchText(query).trim();
    if (!q) return INICIO.map(id => allItems.find(i => i.id === id)).filter((i): i is ResultItem => !!i);
    // Todas las palabras escritas deben aparecer en el nombre, la categoría, los sinónimos o la ayuda.
    const palabras = q.split(/\s+/);
    const puntuar = (item: ResultItem) => {
      const nombre = searchText(item.name);
      // La ayuda no se busca: menciona otras cosas («sobre una pared») y mete ruido.
      const resto = searchText([item.categoryLabel, ...(item.searchAliases ?? [])].join(' '));
      if (!palabras.every(p => nombre.includes(p) || resto.includes(p))) return 0;
      // Primero lo que empieza por lo escrito, luego lo que lo contiene en el nombre, luego el resto.
      const empieza = (p: string) => nombre.split(/[^a-z0-9]+/).some(w => w.startsWith(p));
      return palabras.every(empieza) ? 3 : palabras.every(p => nombre.includes(p)) ? 2 : 1;
    };
    // A igual puntuación se respeta el orden de la lista: herramientas, funciones, acciones, muebles.
    return allItems.map((item, i) => ({ item, i, p: puntuar(item) })).filter(r => r.p > 0)
      .sort((a, b) => b.p - a.p || a.i - b.i).slice(0, 30).map(r => r.item);
  });

  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
    }
  });

  // Reset index when results change
  $effect(() => {
    results; // track
    selectedIndex = 0;
  });

  async function execute(item: ResultItem) {
    open = false;
    // Close the modal before commands dispatch editor shortcuts or open Settings.
    await tick();
    item.action();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) execute(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
</script>

{#if open}
  <dialog use:modalDialog
    class="modal-overlay fixed inset-0 bg-black/40 z-[100] flex justify-center"
    onclick={(e) => { if (e.target === e.currentTarget) open = false; }}
    oncancel={(e) => { e.preventDefault(); open = false; }}
    aria-label={$t('commandPalette.title')}
  >
    <div
      class="mt-[15vh] mx-4 w-full max-w-lg h-fit bg-white rounded-xl shadow-2xl overflow-hidden"
    >
      <!-- Search input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <span class="text-gray-400 text-lg">🔍</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={onKeydown}
          class="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
          placeholder={$t('commandPalette.searchPlaceholder')}
          type="text"
          spellcheck="false"
          role="combobox"
          aria-label={$t('commandPalette.searchLabel')}
          aria-expanded="true"
          aria-controls="command-results"
          aria-autocomplete="list"
          aria-activedescendant={results[selectedIndex] ? `command-result-${results[selectedIndex].id}` : undefined}
        />
        <kbd class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-400">ESC</kbd>
      </div>

      <!-- Results -->
      <div id="command-results" role="listbox" aria-label={$t('commandPalette.resultsLabel')} tabindex="-1" class="max-h-[50vh] overflow-y-auto">
        {#if results.length === 0}
          <div class="px-4 py-6 text-center text-sm text-gray-400">{$t('commandPalette.noResults')}</div>
        {:else}
          {#each results as item, i}
            <button
              id={`command-result-${item.id}`}
              tabindex="-1"
              class="flex w-full text-left items-center gap-3 px-4 py-2 cursor-pointer text-sm transition-colors"
              class:bg-blue-50={i === selectedIndex}
              class:text-blue-700={i === selectedIndex}
              class:text-gray-700={i !== selectedIndex}
              onmouseenter={() => selectedIndex = i}
              onclick={() => execute(item)}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span class="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
              <span class="flex-1 min-w-0">
                <span class="block truncate">{item.name}</span>
                {#if item.help}<span class="block truncate text-xs text-gray-400">{item.help}</span>{/if}
              </span>
              <span class="text-xs text-gray-400 flex-shrink-0">{item.categoryLabel}</span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Footer hint -->
      <div class="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">↑↓</kbd> {$t('commandPalette.navigate')}</span>
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">↵</kbd> {$t('commandPalette.select')}</span>
        <span><kbd class="px-1 py-0.5 bg-gray-100 rounded border border-gray-200">esc</kbd> {$t('commandPalette.close')}</span>
      </div>
    </div>
  </dialog>
{/if}
