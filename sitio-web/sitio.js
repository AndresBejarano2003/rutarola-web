// Sitio de presentación de RutaRola (rutarola.com): menú, pestañas, precios (en vivo desde el API), visor de imágenes.
'use strict';

/**
 * Google Play: cuando la app esté publicada para todos, cambia `publicada` a true y el botón lleva a la ficha.
 * Mientras tanto muestra "Próximamente en Google Play".
 */
// Igual en descargar.html (página del QR de la publicidad): cambiar los dos al publicar.
const GOOGLE_PLAY = { publicada: false, url: 'https://play.google.com/store/apps/details?id=co.rutarola.app' };

const APP = 'https://app.rutarola.com';
const API = 'https://api.rutarola.com/api/v1';
const WHATSAPP = '573202871272';

/** Copia de los planes (`PLANES` en suscripcion.ts) por si el API no responde; los precios reales vienen del API. */
const PLANES_RESPALDO = [
  { id: 'GRATIS', nombre: 'Gratis', descripcion: 'Para empezar a organizar una ruta sin costo.', precioMensual: 0, precioAnual: 0, precioDesde: false, destacado: false,
    limites: { vehiculos: 1, estudiantes: 20 },
    incluye: ['Ruta del día para conductor y monitora', 'Estudiantes, acudientes, colegios, rutas y vehículos', 'Facturas, recibos y estado de cuenta', 'Portal del acudiente', 'Alertas de documentos y licencias'] },
  { id: 'ESENCIAL', nombre: 'Esencial', descripcion: 'Para pequeñas empresas que quieren cobrar a tiempo.', precioMensual: 89900, precioAnual: 899000, precioDesde: false, destacado: false,
    limites: { vehiculos: 5, estudiantes: 120 },
    incluye: ['Todo lo del plan Gratis', 'Recordatorios automáticos de cobro por correo y WhatsApp', 'Reportes de ingresos, cartera y morosos con exportación a CSV'] },
  { id: 'PROFESIONAL', nombre: 'Profesional', descripcion: 'Para empresas en crecimiento que quieren dar tranquilidad a las familias.', precioMensual: 189900, precioAnual: 1899000, precioDesde: false, destacado: true,
    limites: { vehiculos: 15, estudiantes: 400 },
    incluye: ['Todo lo del plan Esencial', 'GPS en vivo desde los teléfonos del conductor y la monitora', 'Cronograma de rutas, ausencias y vencimientos', 'Mapa del recorrido para los acudientes', 'Monitoreo de todas las rutas en tiempo real', 'Soporte prioritario'] },
  { id: 'EMPRESARIAL', nombre: 'Empresarial', descripcion: 'Para flotas grandes o varias sedes.', precioMensual: 389900, precioAnual: 3899000, precioDesde: true, destacado: false,
    limites: { vehiculos: null, estudiantes: null },
    incluye: ['Todo lo del plan Profesional', 'Vehículos y estudiantes sin límite', 'Capacitación del equipo y acompañamiento en la puesta en marcha', 'Atención de incidentes críticos en 8 horas'] },
];

/** La plataforma resume en la tarjeta los beneficios base del plan Gratis (la lista completa es larga). */
const MAX_BENEFICIOS = 6;

const estado = { planes: PLANES_RESPALDO, periodo: 'MENSUAL', diasPrueba: 15 };
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const $ = (s, raiz = document) => raiz.querySelector(s);
const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];

document.documentElement.classList.add('js');
$('#anio').textContent = String(new Date().getFullYear());

/* ---------- Encabezado y menú ---------- */
const encabezado = $('#encabezado');
const menu = $('#navegacion');
const botonMenu = $('#menu-boton');

const alDesplazar = () => encabezado.classList.toggle('encabezado--borde', window.scrollY > 8);
window.addEventListener('scroll', alDesplazar, { passive: true });
alDesplazar();

function abrirMenu(abrir) {
  menu.classList.toggle('navegacion--abierta', abrir);
  botonMenu.setAttribute('aria-expanded', String(abrir));
  botonMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
  botonMenu.innerHTML = `<i class="fa-solid ${abrir ? 'fa-xmark' : 'fa-bars'}" aria-hidden="true"></i>`;
}
botonMenu.addEventListener('click', () => abrirMenu(!menu.classList.contains('navegacion--abierta')));
$$('a', menu).forEach((a) => a.addEventListener('click', () => abrirMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirMenu(false); });

/* ---------- Google Play ---------- */
for (const boton of $$('[data-google-play]')) {
  if (GOOGLE_PLAY.publicada) {
    boton.href = GOOGLE_PLAY.url;
    boton.target = '_blank';
    boton.rel = 'noopener';
    $('[data-play-linea]', boton).textContent = 'Disponible en';
  } else if (boton.closest('#descargar')) {
    boton.setAttribute('aria-disabled', 'true');
    boton.addEventListener('click', (e) => e.preventDefault());
  }
}
if (GOOGLE_PLAY.publicada) $$('[data-play-nota]').forEach((n) => n.remove());

/* ---------- Pestañas de roles ---------- */
const pestanas = $$('[role="tab"]');
function elegirPestana(p) {
  for (const t of pestanas) {
    const activa = t === p;
    t.setAttribute('aria-selected', String(activa));
    t.tabIndex = activa ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !activa;
  }
}
pestanas.forEach((t, i) => {
  t.addEventListener('click', () => elegirPestana(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const siguiente = pestanas[(i + d + pestanas.length) % pestanas.length];
    elegirPestana(siguiente);
    siguiente.focus();
  });
});

/* ---------- Precios ---------- */
function limites(p) {
  const v = p.limites?.vehiculos, e = p.limites?.estudiantes;
  return [v == null ? 'Vehículos ilimitados' : `${v} ${v === 1 ? 'vehículo' : 'vehículos'}`, e == null ? 'Estudiantes ilimitados' : `${e} estudiantes`];
}

function botonPlan(p) {
  const anual = estado.periodo === 'ANUAL';
  if (p.id === 'GRATIS') return { texto: 'Empezar gratis', url: `${APP}/#/registro?comienzo=GRATIS`, clase: 'boton--borde' };
  if (p.id === 'EMPRESARIAL') {
    const texto = encodeURIComponent('Hola, quiero información del plan Empresarial de RutaRola.');
    return { texto: 'Hablar con nosotros', url: `https://wa.me/${WHATSAPP}?text=${texto}`, clase: 'boton--borde', externo: true };
  }
  if (p.destacado) return { texto: `Probar ${estado.diasPrueba} días gratis`, url: `${APP}/#/registro`, clase: 'boton--primario' };
  return { texto: `Elegir ${p.nombre}`, url: `${APP}/#/registro?plan=${p.id}&periodo=${anual ? 'ANUAL' : 'MENSUAL'}`, clase: 'boton--borde' };
}

function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function dibujarPlanes() {
  const anual = estado.periodo === 'ANUAL';
  $('#planes').innerHTML = estado.planes.map((p) => {
    const precio = anual ? p.precioAnual : p.precioMensual;
    const b = botonPlan(p);
    const equivale = p.precioMensual === 0 ? 'Para siempre' : anual ? `Equivale a ${pesos.format(Math.round(p.precioAnual / 12))} al mes` : 'Facturado cada mes';
    return `
      <article class="plan${p.destacado ? ' plan--destacado' : ''}">
        ${p.destacado ? '<span class="plan__cinta">MÁS ELEGIDO</span>' : ''}
        <h3>${escapar(p.nombre)}</h3>
        <p class="plan__desc">${escapar(p.descripcion)}</p>
        <p class="plan__precio">${p.precioDesde ? '<span class="plan__desde">Desde</span>' : ''}${pesos.format(precio)}<small>${precio ? (anual ? ' /año' : ' /mes') : ''}</small></p>
        <p class="plan__equivale">${equivale}</p>
        <div class="plan__limites">${limites(p).map((l) => `<span>${l}</span>`).join('')}</div>
        <ul>${(p.incluye ?? []).slice(0, MAX_BENEFICIOS).map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
        <a class="boton ${b.clase}" href="${b.url}"${b.externo ? ' target="_blank" rel="noopener"' : ''}>${escapar(b.texto)}</a>
      </article>`;
  }).join('');
}

$$('[data-periodo]').forEach((b) => b.addEventListener('click', () => {
  estado.periodo = b.dataset.periodo;
  $$('[data-periodo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  dibujarPlanes();
}));

function mostrarDiasPrueba() {
  $$('[data-dias-prueba]').forEach((s) => (s.textContent = String(estado.diasPrueba)));
}

dibujarPlanes();
// Precios y días de prueba reales (los cambia la plataforma). Si el API no responde, quedan los de respaldo.
const conTiempo = (url) => fetch(url, { signal: AbortSignal.timeout?.(6000) }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
conTiempo(`${API}/suscripcion/planes`)
  .then((planes) => { if (Array.isArray(planes) && planes.length) { estado.planes = planes; dibujarPlanes(); } })
  .catch(() => undefined);
conTiempo(`${API}/suscripcion/condiciones`)
  .then((c) => { if (c?.diasPrueba > 0) { estado.diasPrueba = c.diasPrueba; mostrarDiasPrueba(); dibujarPlanes(); } })
  .catch(() => undefined);

/* ---------- Visor de imágenes ---------- */
const visor = $('#visor');
$$('[data-ampliar]').forEach((b) => b.addEventListener('click', () => {
  if (!visor.showModal) return window.open(b.dataset.ampliar, '_blank');
  $('img', visor).src = b.dataset.ampliar;
  $('img', visor).alt = b.dataset.titulo;
  $('.visor__titulo', visor).textContent = b.dataset.titulo;
  visor.showModal();
}));
$('.visor__cerrar', visor).addEventListener('click', () => visor.close());
visor.addEventListener('click', (e) => { if (e.target === visor) visor.close(); });

/* ---------- Aparición al desplazarse ---------- */
const revelables = $$('.revelar');
if ('IntersectionObserver' in window) {
  const observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  revelables.forEach((r) => observador.observe(r));
} else {
  revelables.forEach((r) => r.classList.add('visible'));
}
