// Service worker de RutaRola instalada como aplicación web (PWA). Lo registra `main.ts` solo en producción y en el
// navegador (no en la app de Android). A propósito NO guarda la aplicación en caché: cada despliegue se ve al instante
// y los datos siempre vienen del servidor. Solo, si no hay internet al abrirla, muestra `sin-conexion.html`.
const CACHE = 'rutarola-sin-conexion-v1';
const PAGINA_SIN_CONEXION = '/sin-conexion.html';
const RECURSOS = [PAGINA_SIN_CONEXION, '/iconos/icono-192.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(RECURSOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  // Solo la apertura de la página; todo lo demás (API, scripts, imágenes) va directo a la red como siempre.
  if (request.mode !== 'navigate') return;
  evento.respondWith(fetch(request).catch(() => caches.match(PAGINA_SIN_CONEXION)));
});
