// Maneja Google Chrome sin interfaz por el protocolo de depuración (CDP), sin dependencias: capturas de pantalla
// de RutaRola en modo local y conversión de los manuales HTML a PDF. Lo usan capturar.mjs y generar-pdf.mjs.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirNavegador({ puerto = 9333 } = {}) {
  const perfil = mkdtempSync(join(tmpdir(), 'rutarola-manuales-'));
  const proceso = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--lang=es-CO', 'about:blank',
  ], { stdio: 'ignore' });
  let objetivos = null;
  for (let i = 0; i < 50 && !objetivos; i++) {
    try { objetivos = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); } catch { await esperar(200); }
  }
  const pagina = objetivos.find((o) => o.type === 'page');
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
  let id = 0;
  const pendientes = new Map();
  const oyentes = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) {
      const { ok, mal } = pendientes.get(d.id);
      pendientes.delete(d.id);
      d.error ? mal(new Error(`${d.error.message}`)) : ok(d.result);
    } else if (d.method) for (const f of oyentes) f(d);
  };
  const enviar = (method, params = {}) => new Promise((ok, mal) => {
    const n = ++id;
    pendientes.set(n, { ok, mal });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await enviar('Page.enable');
  await enviar('Runtime.enable');

  const nav = {
    enviar,
    async tamano(ancho, alto, escala = 1, movil = false) {
      await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: escala, mobile: movil });
    },
    async ir(url, pausa = 1500) {
      // Mismo documento (solo cambia el #/ruta): no hay evento de carga, se cambia el hash y se espera.
      const actual = await nav.evaluar('location.href').catch(() => '');
      if (actual && actual.split('#')[0] === url.split('#')[0] && url.includes('#')) {
        await nav.evaluar(`(() => { location.hash = ${JSON.stringify(url.slice(url.indexOf('#')))}; return true; })()`);
        await esperar(pausa);
        return;
      }
      const cargada = new Promise((r) => {
        const f = (d) => { if (d.method === 'Page.loadEventFired') { oyentes.delete(f); r(); } };
        oyentes.add(f);
      });
      await enviar('Page.navigate', { url });
      await Promise.race([cargada, esperar(15000)]);
      await esperar(pausa);
    },
    async evaluar(expresion) {
      const r = await enviar('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    esperar,
    /** Espera hasta que `condicion` (JS) sea verdadera. */
    async hasta(condicion, max = 10000) {
      for (let t = 0; t < max; t += 200) {
        if (await nav.evaluar(`!!(${condicion})`)) return true;
        await esperar(200);
      }
      throw new Error(`No se cumplió: ${condicion}`);
    },
    async captura(archivo, { calidad = 82, completa = false } = {}) {
      const params = { format: 'jpeg', quality: calidad, captureBeyondViewport: completa };
      if (completa) {
        const { contentSize } = await enviar('Page.getLayoutMetrics');
        params.clip = { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 };
      }
      const { data } = await enviar('Page.captureScreenshot', params);
      writeFileSync(archivo, Buffer.from(data, 'base64'));
    },
    async pdf(archivo, opciones = {}) {
      const { data } = await enviar('Page.printToPDF', {
        printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, ...opciones,
      });
      writeFileSync(archivo, Buffer.from(data, 'base64'));
    },
    async cerrar() {
      ws.close();
      proceso.kill();
      await esperar(300);
      rmSync(perfil, { recursive: true, force: true });
    },
  };
  return nav;
}
