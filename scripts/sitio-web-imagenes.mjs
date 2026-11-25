// Capturas del sitio web (rutarola.com) en WebP, desde las capturas de los manuales (documentacion-fuente/capturas,
// modo local con datos ficticios). Uso: `node scripts/sitio-web-imagenes.mjs` después de capturar.mjs.
import sharp from 'sharp';
const C = 'documentacion-fuente/capturas', S = 'sitio-web/img';
const lista = {
  'panel-inicio': ['general-inicio', 1600], 'ruta-del-dia': ['ruta-del-dia', 560], 'portal-inicio': ['portal-inicio', 560],
  'portal-estudiantes': ['portal-estudiantes', 560], 'registrar-pago': ['finanzas-recibo-meses', 1400],
  'cronograma': ['operacion-cronograma', 1400], 'morosos': ['finanzas-reporte-morosos', 1400],
  'estudiantes': ['estudiantes-lista', 1400], 'vehiculo': ['operacion-vehiculo-consulta', 1400], 'asignaciones': ['operacion-asignaciones', 1400],
};
for (const [n, [f, w]] of Object.entries(lista)) {
  const i = await sharp(`${C}/${f}.jpg`).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${S}/${n}.webp`);
  console.log(n, i.width + 'x' + i.height, Math.round(i.size / 1024) + 'KB');
}
// Logo sin márgenes transparentes (el PNG original trae mucho espacio alrededor).
const logo = await sharp('public/logos/logo-oficial-sin-fondo-lb.png').trim().resize({ height: 160 }).png().toFile(`${S}/logo.png`);
console.log('logo', logo.width + 'x' + logo.height);
