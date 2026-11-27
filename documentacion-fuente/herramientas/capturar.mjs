// Capturas de pantalla para los manuales, tomadas de RutaRola en MODO LOCAL (datos de ejemplo ficticios).
// Uso: en una terminal `npx ng serve --configuration local --port 4300`; en otra
//      `node documentacion-fuente/herramientas/capturar.mjs [filtro]` → documentacion-fuente/capturas/*.jpg (+ .txt con el texto).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './navegador.mjs';

const BASE = process.env.RUTAROLA_URL ?? 'http://localhost:4300';
const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas');
mkdirSync(SALIDA, { recursive: true });
const filtro = process.argv[2] ?? '';

const ESCRITORIO = [1366, 820];
const MOVIL = [390, 844];

/** Clic en el primer elemento que coincide con el selector y contiene el texto. */
const clic = (selector, texto = '') =>
  `(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.offsetParent !== null && x.textContent.includes(${JSON.stringify(texto)})); if (!e) throw new Error('No encontré ' + ${JSON.stringify(selector + ' ' + texto)}); e.scrollIntoView({block:'center'}); e.click(); return true; })()`;
const abrirNuevo = clic('button.btn-primary', 'Nuev');
const bajarModal = `(() => { const b = document.querySelector('dialog[open] .overflow-y-auto'); if (b) b.scrollTop = b.scrollHeight; return true; })()`;
/** Quita del encabezado lo que solo existe en el modo local de pruebas (no aparece en producción). */
const limpiarModoLocal = `(() => { for (const e of document.querySelectorAll('span, div, a')) { if (e.childElementCount <= 1 && e.textContent.trim() === 'Modo local') e.style.display = 'none'; } return true; })()`;
/** En el formulario abierto, elige la primera opción del primer selector con búsqueda. */
const elegirPrimera = `(async () => { const i = document.querySelector('dialog[open] app-selector-busqueda input'); i.focus(); i.click(); await new Promise((r) => setTimeout(r, 400)); document.querySelector('dialog[open] [role=option]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.querySelector('dialog[open] [role=option]')?.click(); await new Promise((r) => setTimeout(r, 800)); return true; })()`;
const primeraFila = `(() => { const f = document.querySelector('tbody tr.cursor-pointer, tbody tr'); f.click(); return true; })()`;

/** [archivo, usuario, ruta, tamaño, acciones (JS en orden, con pausa entre cada una), opciones] */
const CAPTURAS = [
  // General
  ['general-login', null, '/login', ESCRITORIO],
  ['general-login-movil', null, '/login', MOVIL],
  ['general-inicio', 'admin', '/inicio', ESCRITORIO],
  ['general-menu-movil', 'admin', '/inicio', MOVIL, [clic('button[aria-label]', '') && `document.querySelector('[aria-label*="menú" i], [aria-label*="menu" i]')?.click()`]],
  ['general-notificaciones', 'admin', '/inicio/notificaciones', ESCRITORIO],
  ['general-cuenta', 'admin', '/inicio/perfil', ESCRITORIO],
  ['general-configuracion', 'admin', '/inicio/configuracion', ESCRITORIO],
  ['general-ayuda', 'admin', '/sistema/soporte', ESCRITORIO],
  ['general-planes', 'admin', '/sistema/membership', ESCRITORIO],
  ['general-publicidad', 'admin', '/sistema/publicidad', ESCRITORIO, [clic('button.card', 'Adhesivo')]],
  // Estudiantes
  ['estudiantes-lista', 'admin', '/personas/estudiantes', ESCRITORIO],
  ['estudiantes-nuevo', 'admin', '/personas/estudiantes', ESCRITORIO, [abrirNuevo]],
  ['estudiantes-nuevo-abajo', 'admin', '/personas/estudiantes', ESCRITORIO, [abrirNuevo, bajarModal]],
  ['estudiantes-consulta', 'admin', '/personas/estudiantes', ESCRITORIO, [primeraFila]],
  ['estudiantes-filtros-movil', 'admin', '/personas/estudiantes', MOVIL],
  // Acudientes
  ['acudientes-lista', 'admin', '/personas/acudientes', ESCRITORIO],
  ['acudientes-nuevo', 'admin', '/personas/acudientes', ESCRITORIO, [abrirNuevo]],
  ['acudientes-nuevo-acceso', 'admin', '/personas/acudientes', ESCRITORIO, [abrirNuevo, bajarModal]],
  ['acudientes-consulta', 'admin', '/personas/acudientes', ESCRITORIO, [primeraFila]],
  ['empleados-lista', 'admin', '/personas/empleados', ESCRITORIO],
  ['portal-inicio', 'mperez', '/portal', MOVIL],
  ['portal-estudiantes', 'mperez', '/portal/estudiantes', MOVIL],
  ['portal-pagos', 'mperez', '/portal/pagos', MOVIL],
  // Finanzas
  ['finanzas-cotizaciones', 'admin', '/finanzas/cotizaciones', ESCRITORIO],
  ['finanzas-cotizacion-nueva', 'admin', '/finanzas/cotizaciones', ESCRITORIO, [abrirNuevo]],
  ['finanzas-cotizacion-consulta', 'admin', '/finanzas/cotizaciones', ESCRITORIO, [primeraFila]],
  ['finanzas-facturas', 'admin', '/finanzas/facturas', ESCRITORIO],
  ['finanzas-factura-nueva', 'admin', '/finanzas/facturas', ESCRITORIO, [abrirNuevo]],
  ['finanzas-factura-consulta', 'admin', '/finanzas/facturas', ESCRITORIO, [primeraFila]],
  ['finanzas-factura-cuenta', 'admin', '/finanzas/facturas', ESCRITORIO, [primeraFila, `(() => { document.querySelector('#titulo-cuenta-factura')?.scrollIntoView({block:'start'}); return true; })()`]],
  ['finanzas-recibos', 'admin', '/finanzas/recibos', ESCRITORIO],
  ['finanzas-recibo-nuevo', 'admin', '/finanzas/recibos', ESCRITORIO, [clic('button.btn-primary', 'Registrar pago'), elegirPrimera]],
  ['finanzas-recibo-meses', 'admin', '/finanzas/recibos', ESCRITORIO, [clic('button.btn-primary', 'Registrar pago'), elegirPrimera, `(() => { const c = document.querySelector('dialog[open] input[type=checkbox]'); c?.click(); c?.scrollIntoView({block:'center'}); return true; })()`]],
  ['finanzas-reporte-ingresos', 'admin', '/finanzas/reportes-financieros/ingresos', ESCRITORIO],
  ['finanzas-reporte-pendientes', 'admin', '/finanzas/reportes-financieros/facturas-pendientes', ESCRITORIO],
  ['finanzas-reporte-morosos', 'admin', '/finanzas/reportes-financieros/morosos', ESCRITORIO],
  // Rutas y operación
  ['operacion-colegios', 'admin', '/operacion/colegios', ESCRITORIO],
  ['operacion-colegio-nuevo', 'admin', '/operacion/colegios', ESCRITORIO, [abrirNuevo]],
  ['operacion-colegio-consulta', 'admin', '/operacion/colegios', ESCRITORIO, [primeraFila]],
  ['operacion-rutas', 'admin', '/operacion/rutas', ESCRITORIO],
  ['operacion-ruta-nueva', 'admin', '/operacion/rutas', ESCRITORIO, [abrirNuevo]],
  ['operacion-ruta-consulta', 'admin', '/operacion/rutas', ESCRITORIO, [primeraFila]],
  ['operacion-vehiculos', 'admin', '/operacion/vehiculos', ESCRITORIO],
  ['operacion-vehiculo-nuevo', 'admin', '/operacion/vehiculos', ESCRITORIO, [abrirNuevo]],
  ['operacion-vehiculo-consulta', 'admin', '/operacion/vehiculos', ESCRITORIO, [primeraFila]],
  ['operacion-conductores', 'admin', '/operacion/conductores', ESCRITORIO],
  ['operacion-asignaciones', 'admin', '/operacion/asignaciones', ESCRITORIO],
  ['operacion-asignacion-nueva', 'admin', '/operacion/asignaciones', ESCRITORIO, [abrirNuevo]],
  ['operacion-cronograma', 'admin', '/operacion/cronograma', ESCRITORIO],
  ['operacion-recorridos', 'admin', '/operacion/recorridos', ESCRITORIO],
  ['operacion-monitoreo', 'admin', '/operacion/monitoreo', ESCRITORIO],
  ['ruta-del-dia', 'jcardenas', '/ruta-del-dia', MOVIL],
  // Programación de facturación
  ['programacion-lista', 'admin', '/finanzas/programacion-facturacion', ESCRITORIO],
  ['programacion-nueva', 'admin', '/finanzas/programacion-facturacion', ESCRITORIO, [abrirNuevo]],
  ['programacion-nueva-plantillas', 'admin', '/finanzas/programacion-facturacion', ESCRITORIO, [abrirNuevo, bajarModal]],
  ['programacion-consulta', 'admin', '/finanzas/programacion-facturacion', ESCRITORIO, [primeraFila]],
  ['programacion-mensajes', 'admin', '/finanzas/mensajes-whatsapp', ESCRITORIO],
];

const nav = await abrirNavegador();
let usuarioActual = undefined;

async function entrar(usuario) {
  if (usuario === usuarioActual) return;
  await nav.tamano(...ESCRITORIO);
  await nav.ir(`${BASE}/#/login`, 800);
  // La sesión también vive en memoria: se borra la guardada y se recarga la página.
  await nav.evaluar(`(() => { sessionStorage.clear(); localStorage.removeItem('rutarola.sesion'); location.hash = '#/login'; setTimeout(() => location.reload(), 50); return true; })()`);
  await nav.esperar(3000);
  await nav.hasta(`location.hash.startsWith('#/login') && document.querySelector('input[formcontrolname="contrasena"]') instanceof HTMLInputElement`, 15000);
  if (usuario) {
    await nav.evaluar(`(() => {
      const poner = (sel, v) => { const i = document.querySelector(sel); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); };
      poner('input[formcontrolname="usuario"]', ${JSON.stringify(usuario)});
      poner('input[formcontrolname="contrasena"]', 'rutarola');
      document.querySelector('form button[type="submit"]').click();
      return true; })()`);
    await nav.hasta(`!location.hash.startsWith('#/login')`);
    await nav.esperar(1500);
  }
  usuarioActual = usuario;
}

for (const [archivo, usuario, ruta, tamano, acciones = []] of CAPTURAS) {
  if (filtro && !archivo.includes(filtro)) continue;
  try {
    await entrar(usuario);
    await nav.tamano(...tamano, tamano === MOVIL ? 2 : 1.25, tamano === MOVIL);
    // Recarga completa: ninguna ventana ni estado de la captura anterior queda abierto.
    await nav.ir(`${BASE}/#${ruta}`, 300);
    await nav.evaluar(`(() => { setTimeout(() => location.reload(), 20); return true; })()`);
    await nav.esperar(2600);
    for (const accion of acciones.filter(Boolean)) {
      await nav.evaluar(accion);
      await nav.esperar(900);
    }
    await nav.evaluar(limpiarModoLocal);
    await nav.captura(join(SALIDA, `${archivo}.jpg`), { calidad: 72 });
    const texto = await nav.evaluar(`(document.querySelector('dialog[open]')?.innerText ?? '') + '\\n=====PAGINA=====\\n' + document.body.innerText`);
    writeFileSync(join(SALIDA, `${archivo}.txt`), texto);
    console.log('✓', archivo);
  } catch (e) {
    console.log('✗', archivo, e.message);
  }
}
await nav.cerrar();
