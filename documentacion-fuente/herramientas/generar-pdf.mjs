// Convierte los manuales (documentacion-fuente/manuales/*.html) en los PDF que abre el Centro de Ayuda
// (public/documentacion/*.pdf). Las capturas se toman antes con capturar.mjs.
// Uso: `node documentacion-fuente/herramientas/generar-pdf.mjs [nombre]`
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirNavegador } from './navegador.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANUALES = join(RAIZ, 'manuales');
const DESTINO = resolve(RAIZ, '..', 'public', 'documentacion');
const filtro = process.argv[2] ?? '';

const nav = await abrirNavegador({ puerto: 9334 });
for (const archivo of readdirSync(MANUALES).filter((f) => f.endsWith('.html') && f.includes(filtro))) {
  const nombre = archivo.replace(/\.html$/, '');
  await nav.ir(pathToFileURL(join(MANUALES, archivo)).href, 1500);
  // Espera a que carguen todas las imágenes.
  await nav.hasta(`[...document.images].every((i) => i.complete)`, 20000);
  const pdf = join(DESTINO, `${nombre}.pdf`);
  await nav.pdf(pdf, {
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 14mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">
      <span>RutaRola · ${nombre === 'manual-general' ? 'Manual general' : 'Manual de usuario'}</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
  });
  console.log('✓', pdf, Math.round(statSync(pdf).size / 1024), 'KB');
}
await nav.cerrar();
