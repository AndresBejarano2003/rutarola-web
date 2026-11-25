# Sitio de presentación de RutaRola (rutarola.com): archivos estáticos servidos por nginx.
# Coolify: recurso nuevo desde el repo rutarola-web, Base Directory /sitio-web, Build Pack "Dockerfile", puerto 80.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html privacidad.html terminos.html eliminar-cuenta.html estilos.css sitio.js robots.txt sitemap.xml /usr/share/nginx/html/
COPY img/ /usr/share/nginx/html/img/
EXPOSE 80
