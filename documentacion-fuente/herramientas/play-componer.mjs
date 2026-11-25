// Imágenes de la ficha de Google Play a partir de las capturas de `play-capturas.mjs`:
//   recursos-app/play-store/capturas/NN-*.png  (1080×1920, 9:16, PNG sin transparencia: lo que pide Google)
//   recursos-app/play-store/grafico-funciones-1024x500.png  (imagen destacada, sin transparencia)
// Uso: `node documentacion-fuente/herramientas/play-componer.mjs` (no necesita el servidor local).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { abrirNavegador } from './navegador.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAPTURAS = join(RAIZ, 'documentacion-fuente', 'capturas', 'play');
const SALIDA = join(RAIZ, 'recursos-app', 'play-store');
const LOGO = pathToFileURL(join(RAIZ, 'sitio-web', 'img', 'logo.png')).href;
mkdirSync(join(SALIDA, 'capturas'), { recursive: true });
const TEMPORAL = mkdtempSync(join(tmpdir(), 'rutarola-play-'));

/** [archivo de salida, captura, etiqueta, titular (con <em> en amarillo), texto] — en el orden en que se muestran. */
const PANTALLAS = [
  ['01-mapa-en-vivo', 'portal-mapa', 'Para las familias', 'Sigue <em>la ruta en vivo</em>', 'El acudiente sigue el bus en el mapa mientras el recorrido está en curso.'],
  ['02-recorrido', 'recorrido-2', 'Conductor y monitora', 'La ruta <em>paso a paso</em>', 'A quién recoger y en qué orden, con llamada, WhatsApp y cómo llegar.'],
  ['03-ruta-del-dia', 'mis-rutas', 'Ruta del día', 'Las rutas de hoy, <em>listas</em>', 'Colegio, vehículo, estudiantes y compañero de turno en una pantalla.'],
  ['04-aviso-ausencia', 'portal-ausencia', 'Avisos de ausencia', '¿No va hoy? <em>Avísalo</em>', 'La monitora y el conductor lo ven en su ruta y lo confirman.'],
  ['05-estudiantes', 'portal-estudiantes', 'Portal del acudiente', 'Todo sobre <em>sus hijos</em>', 'Colegio, horario, ruta, vehículo y quién los transporta.'],
  ['06-pagos', 'portal-pagos', 'Pagos mes a mes', 'Facturas y pagos <em>claros</em>', 'Cada familia ve lo pagado, lo pendiente y sus recibos.'],
  ['07-empresa', 'admin-inicio', 'Para la empresa', 'Tu empresa <em>al día</em>', 'Recaudo, cartera, rutas y alertas de documentos, en el celular o el computador.'],
];

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; overflow: hidden; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f3f4f6; position: relative;
    background: radial-gradient(130% 70% at 50% 0%, #1e293b 0%, #111827 55%, #0b1020 100%); -webkit-font-smoothing: antialiased; }
  em { font-style: normal; color: #facc15; }
  .brillo { position: absolute; border-radius: 50%; filter: blur(40px); background: rgb(250 204 21 / .22); }
  .telefono { position: absolute; border-radius: 38px; padding: 8px; background: #0b0f19; border: 1px solid #4b5563;
    box-shadow: 0 30px 60px -18px rgb(0 0 0 / .85), 0 0 0 2px #1f2937; }
  .telefono img { width: 100%; display: block; border-radius: 31px; }`;

const pagina = (cuerpo, css, ancho, alto) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${BASE_CSS} body { width: ${ancho}px; height: ${alto}px; } ${css}</style></head><body>${cuerpo}</body></html>`;

const captura = (nombre) => pathToFileURL(join(CAPTURAS, `${nombre}.jpg`)).href;

const n = await abrirNavegador({ puerto: 9343 });

async function render(html, ancho, alto, escala, archivo) {
  const temporal = join(TEMPORAL, 'pagina.html');
  writeFileSync(temporal, html);
  await n.tamano(ancho, alto, escala, false);
  await n.ir(`${pathToFileURL(temporal).href}?${Date.now()}`, 900);
  const { data } = await n.enviar('Page.captureScreenshot', { format: 'png' });
  // Google Play no acepta transparencia en capturas ni en la imagen destacada.
  await sharp(Buffer.from(data, 'base64')).flatten({ background: '#111827' }).removeAlpha().png({ compressionLevel: 9 }).toFile(archivo);
  console.log('✓', archivo.replace(RAIZ + '/', ''));
}

// Capturas 1080×1920 (360×640 a escala 3).
for (const [archivo, fuente, etiqueta, titular, texto] of PANTALLAS) {
  const css = `
    .arriba { position: absolute; top: 34px; left: 22px; right: 22px; text-align: center; }
    .etiqueta { font-size: 11px; letter-spacing: .16em; font-weight: 800; color: #facc15; text-transform: uppercase; }
    h1 { font-size: 26px; line-height: 1.12; margin: 10px 0 8px; font-weight: 800; letter-spacing: -.02em; }
    p { font-size: 13.5px; line-height: 1.45; color: #d1d5db; margin: 0 auto; max-width: 300px; }
    .brillo { width: 300px; height: 300px; left: 30px; top: 300px; }
    .telefono { width: 262px; left: 49px; top: 196px; }`;
  const cuerpo = `<div class="brillo"></div>
    <div class="arriba"><div class="etiqueta">${etiqueta}</div><h1>${titular}</h1><p>${texto}</p></div>
    <div class="telefono"><img src="${captura(fuente)}" alt=""></div>`;
  await render(pagina(cuerpo, css, 360, 640), 360, 640, 3, join(SALIDA, 'capturas', `${archivo}.png`));
}

// Imagen destacada 1024×500 (512×250 a escala 2). Google puede recortar los bordes: el texto queda lejos de ellos.
{
  const css = `
    .izquierda { position: absolute; left: 34px; top: 36px; width: 232px; }
    .izquierda img { height: 36px; width: auto; display: block; margin-bottom: 14px; }
    h1 { font-size: 22px; line-height: 1.1; margin: 0 0 8px; font-weight: 800; letter-spacing: -.02em; }
    p { font-size: 10.5px; line-height: 1.45; color: #d1d5db; margin: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
    .chips span { font-size: 9px; font-weight: 700; padding: 4px 8px; border-radius: 999px; background: #1f2937; border: 1px solid #374151; color: #f3f4f6; }
    .brillo { width: 220px; height: 220px; left: 300px; top: 30px; }
    .telefono { width: 118px; padding: 5px; border-radius: 21px; }
    .telefono img { border-radius: 18px; }
    .t1 { left: 302px; top: 40px; transform: rotate(-6deg); }
    .t2 { left: 382px; top: 26px; transform: rotate(5deg); }`;
  const cuerpo = `<div class="brillo"></div>
    <div class="izquierda"><img src="${LOGO}" alt="">
      <h1>Tu transporte escolar, <em>organizado</em></h1>
      <p>Rutas, cobros y ubicación en vivo para la empresa, el conductor, la monitora y las familias.</p>
      <div class="chips"><span>Ruta del día</span><span>GPS en vivo</span><span>Cobros</span></div>
    </div>
    <div class="telefono t1"><img src="${captura('recorrido-2')}" alt=""></div>
    <div class="telefono t2"><img src="${captura('portal-mapa')}" alt=""></div>`;
  await render(pagina(cuerpo, css, 512, 250), 512, 250, 2, join(SALIDA, 'grafico-funciones-1024x500.png'));
}

await n.cerrar();
