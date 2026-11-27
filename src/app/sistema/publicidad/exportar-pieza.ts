import { imprimirHtml } from 'src/app/shared/documentos-pdf/documentos-pdf';

/** Convierte el SVG en una imagen PNG de `anchoPx` de ancho (alta resolución para imprenta). */
export async function svgAPng(svg: string, anchoPx: number): Promise<Blob> {
  const imagen = new Image();
  imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await imagen.decode();
  const proporcion = imagen.naturalHeight / imagen.naturalWidth || 1;
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(anchoPx);
  lienzo.height = Math.round(anchoPx * proporcion);
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Este navegador no puede generar la imagen.');
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo generar la imagen.'))), 'image/png'),
  );
}

export function descargarArchivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** PNG a `dpi` del tamaño real (`anchoCm`). */
export async function descargarPng(svg: string, anchoCm: number, nombre: string, dpi = 300): Promise<void> {
  descargarArchivo(await svgAPng(svg, (anchoCm / 2.54) * dpi), nombre);
}

/** SVG vectorial (para imprentas que trabajan en vector). */
export function descargarSvg(svg: string, nombre: string): void {
  descargarArchivo(new Blob([svg], { type: 'image/svg+xml' }), nombre);
}

/**
 * Abre el diálogo de impresión ("Guardar como PDF") con cada SVG en una página del tamaño real
 * (`anchoCm` × `altoCm`), sin márgenes.
 */
export function imprimirPiezas(svgs: string[], anchoCm: number, altoCm: number, titulo: string): void {
  const paginas = svgs.map((s) => `<section class="pagina">${s}</section>`).join('');
  imprimirHtml(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo.replace(/[<>&]/g, '')}</title>
<style>
  @page { size: ${anchoCm}cm ${altoCm}cm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .pagina { width: ${anchoCm}cm; height: ${altoCm}cm; overflow: hidden; break-after: page; page-break-after: always; }
  .pagina:last-child { break-after: auto; page-break-after: auto; }
  .pagina svg { width: 100%; height: 100%; display: block; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${paginas}</body></html>`);
}

/** Hoja tamaño carta con 10 tarjetas de 9 × 5 cm (2 × 5) y marcas de corte suaves. */
export function imprimirHojaTarjetas(svg: string, titulo: string): void {
  const celdas = Array.from({ length: 10 }, () => `<div class="celda">${svg}</div>`).join('');
  imprimirHtml(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo.replace(/[<>&]/g, '')}</title>
<style>
  @page { size: letter; margin: 1.2cm 1.2cm; }
  html, body { margin: 0; padding: 0; }
  .hoja { display: grid; grid-template-columns: repeat(2, 9cm); grid-auto-rows: 5cm; gap: 0; justify-content: center; }
  .celda { width: 9cm; height: 5cm; outline: 0.2mm dashed #BBBBBB; }
  .celda svg { width: 100%; height: 100%; display: block; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body><div class="hoja">${celdas}</div></body></html>`);
}
