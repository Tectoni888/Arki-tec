import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PROMPT_CROQUIS, validarLectura } from '$lib/presupuesto/croquis';
import type { RequestHandler } from './$types';

/** Lectura de un croquis a mano con un modelo de visión de Anthropic.
 * La clave vive solo en el servidor (variable ANTHROPIC_API_KEY). */
/** En Vercel: la lectura puede tardar medio minuto. */
export const config = { maxDuration: 60 };

const MAX_BASE64 = 5_500_000; // ≈ 4 MB de imagen
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const POST: RequestHandler = async ({ request }) => {
  // Se usa el fetch global, no el del evento de SvelteKit: ese reenvía la cabecera
  // Origin del navegador y Anthropic trata la llamada como hecha desde un navegador.
  // Al pegar la clave es fácil arrastrar espacios, saltos de línea o comillas.
  const clave = (env.ANTHROPIC_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (!clave) {
    return json({ error: 'La lectura con IA no está configurada: falta la variable ANTHROPIC_API_KEY en el servidor. Puedes añadir las estancias a mano.' }, { status: 503 });
  }
  let cuerpo: { imagen?: unknown };
  try { cuerpo = await request.json(); } catch { return json({ error: 'Petición no válida.' }, { status: 400 }); }
  const m = typeof cuerpo.imagen === 'string' ? /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(cuerpo.imagen) : null;
  if (!m || !TIPOS.has(m[1])) return json({ error: 'Envía una foto en JPG, PNG o WebP.' }, { status: 400 });
  if (m[2].length > MAX_BASE64) return json({ error: 'La foto es demasiado grande.' }, { status: 413 });

  const cuerpoIA = JSON.stringify({
    model: env.CROQUIS_MODEL || 'claude-sonnet-5-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: PROMPT_CROQUIS },
    ] }],
  });
  // Las claves ligadas a una cuenta (sk-ant-usr-…) pueden exigir el espacio de
  // trabajo o la cabecera Authorization; se prueba x-api-key y, si Anthropic
  // responde 401, se reintenta una vez con ambas cabeceras.
  const llamar = (conBearer: boolean) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01',
      ...(conBearer ? { authorization: `Bearer ${clave}` } : {}),
      ...(env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID.trim() } : {}),
    },
    body: cuerpoIA,
    signal: AbortSignal.timeout(50_000),
  });
  let respuesta: Response;
  try {
    respuesta = await llamar(false);
    if (respuesta.status === 401) respuesta = await llamar(true);
  } catch {
    return json({ error: 'No se pudo contactar con el servicio de IA. Vuelve a intentarlo.' }, { status: 502 });
  }
  if (!respuesta.ok) {
    // Mensaje propio de Anthropic: ayuda a distinguir clave, saldo, modelo o permisos.
    const fallo = await respuesta.json().catch(() => null);
    const motivo = typeof fallo?.error?.message === 'string' ? fallo.error.message.slice(0, 300) : '';
    const detalle = respuesta.status === 401 ? `Anthropic rechaza la clave de API (empieza por "${clave.slice(0, 11)}…", ${clave.length} caracteres).`
      : respuesta.status === 404 ? 'El modelo configurado no existe; revisa CROQUIS_MODEL.'
      : respuesta.status === 429 ? 'Se ha superado el límite de uso de la API.'
      : `El servicio de IA respondió con un error (${respuesta.status}).`;
    return json({ error: motivo ? `${detalle} Anthropic dice: «${motivo}»` : detalle }, { status: 502 });
  }
  const datos = await respuesta.json().catch(() => null);
  const texto: string = datos?.content?.find?.((b: { type: string }) => b.type === 'text')?.text ?? '';
  const inicio = texto.indexOf('{'), fin = texto.lastIndexOf('}');
  let leido: unknown = null;
  if (inicio >= 0 && fin > inicio) try { leido = JSON.parse(texto.slice(inicio, fin + 1)); } catch { /* se trata abajo */ }
  if (!leido) return json({ error: 'La IA no devolvió una lectura utilizable. Prueba con una foto más nítida.' }, { status: 502 });
  return json(validarLectura(leido));
};
