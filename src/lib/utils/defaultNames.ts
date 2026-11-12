/**
 * Nombres por defecto de plantas y estancias nuevas. Son datos del proyecto (el
 * usuario puede cambiarlos), así que se fijan al crearlos según el idioma de la
 * interfaz. El valor inicial es el inglés original para no alterar formatos ni
 * pruebas; la app lo cambia al cargar el idioma.
 */
const INGLES = { plantaBaja: 'Ground Floor', planta: 'Floor', sotano: 'Basement', estancia: 'Room' };
const ESPANOL = { plantaBaja: 'Planta baja', planta: 'Planta', sotano: 'Sótano', estancia: 'Estancia' };
export const nombres = { ...INGLES };

export function usarNombresEnEspanol(si: boolean) { Object.assign(nombres, si ? ESPANOL : INGLES); }

export function nombrePlanta(nivel: number): string {
  if (nivel === 0) return nombres.plantaBaja;
  if (nivel < 0) return nivel === -1 ? nombres.sotano : `${nombres.sotano} ${-nivel}`;
  return `${nombres.planta} ${nivel}`;
}
