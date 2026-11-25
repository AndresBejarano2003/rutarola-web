// Capturas del celular para la ficha de Google Play, en MODO LOCAL (datos ficticios), con la ubicación simulada en Bogotá (Cedritos) y
// la hora corrida a la mañana. Uso: `npx ng serve --configuration local --port 4300` y luego
// `node documentacion-fuente/herramientas/play-capturas.mjs` → documentacion-fuente/capturas/play/*.jpg (1170×2532).
// Después `node documentacion-fuente/herramientas/play-componer.mjs` arma las imágenes finales de la ficha.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './navegador.mjs';
const D = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'play');
mkdirSync(D, { recursive: true });
const BASE = process.env.RUTAROLA_URL ?? 'http://localhost:4300';
const n = await abrirNavegador({ puerto: 9342 });
// Zona horaria corrida para que las horas de la captura se vean de mañana aunque se tomen de noche.
await n.enviar('Emulation.setTimezoneOverride', { timezoneId: process.env.ZONA_CAPTURA ?? 'Africa/Lagos' });
await n.enviar('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] });
const ubicar = (lat, lon) => n.enviar('Emulation.setGeolocationOverride', { latitude: lat, longitude: lon, accuracy: 12 });
await ubicar(4.7268, -74.0452);
const clic = (sel, texto) => `(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.offsetParent !== null && x.textContent.includes(${JSON.stringify(texto)})); if (!e) throw new Error('no ' + ${JSON.stringify(texto)}); e.click(); return true; })()`;
const limpiar = `(() => { for (const e of document.querySelectorAll('span, div, a')) { if (e.childElementCount <= 1 && e.textContent.trim() === 'Modo local') e.style.display = 'none'; } window.scrollTo(0,0); return true; })()`;
async function entrar(usuario) {
  await n.tamano(390, 844, 3, true);
  await n.ir(`${BASE}/#/login`, 800);
  await n.evaluar(`(() => { sessionStorage.clear(); localStorage.removeItem('rutarola.sesion'); location.hash = '#/login'; setTimeout(() => location.reload(), 50); return true; })()`);
  await n.esperar(3000);
  await n.hasta(`document.querySelector('input[formcontrolname="contrasena"]') instanceof HTMLInputElement`, 20000);
  await n.evaluar(`(() => { const poner = (sel, v) => { const i = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); };
    poner('input[formcontrolname="usuario"]', ${JSON.stringify(usuario)}); poner('input[formcontrolname="contrasena"]', 'rutarola'); document.querySelector('form button[type="submit"]').click(); return true; })()`);
  await n.hasta(`!location.hash.startsWith('#/login')`);
  await n.esperar(1800);
}
async function foto(nombre, ruta, acciones = []) {
  if (ruta) { await n.ir(`${BASE}/#${ruta}`, 300); await n.evaluar(`(() => { setTimeout(() => location.reload(), 20); return true; })()`); await n.esperar(3200); }
  for (const a of acciones) { await n.evaluar(a); await n.esperar(1800); }
  await n.evaluar(limpiar); await n.esperar(300);
  await n.captura(`${D}/${nombre}.jpg`, { calidad: 92 });
  console.log('✓', nombre);
}
try {
  await entrar('jcardenas');
  await foto('mis-rutas', '/ruta-del-dia');
  await foto('recorrido', null, [clic('button', 'Iniciar recogida')]);
  await n.esperar(6000); await ubicar(4.7252, -74.0468); await n.esperar(7000);
  await foto('recorrido-2', null, [clic('button', 'Recogido')]);
  await ubicar(4.7236, -74.0484); await n.esperar(7000);
  await entrar('mperez');
  await foto('portal-inicio', '/portal');
  await foto('portal-estudiantes', '/portal/estudiantes');
  await foto('portal-mapa', null, [clic('button', 'Ver en el mapa'), `new Promise((r) => setTimeout(() => r(true), 4000))`]);
  await foto('portal-ausencia', '/portal/estudiantes', [clic('button', 'Avisar que no va')]);
  await foto('portal-pagos', '/portal/pagos');
  await entrar('admin');
  await foto('admin-inicio', '/inicio');
} catch (e) { console.log('✗', e.message); }
await n.cerrar();
