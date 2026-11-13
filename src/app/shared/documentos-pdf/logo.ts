import { MAXIMO_LOGO } from './documentos-pdf';

const ANCHO_MAXIMO = 600;
const ALTO_MAXIMO = 240;

/**
 * Logo para los PDF: PNG/JPG/WebP reducido a 600 × 240 px máximo (PNG conserva la transparencia) o SVG tal cual si
 * cabe; siempre ≤ {@link MAXIMO_LOGO} caracteres de data URL. Lanza `Error` con el mensaje para el usuario.
 */
export async function reducirLogo(archivo: File): Promise<string> {
  const tipos = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!tipos.includes(archivo.type)) throw new Error('Elige una imagen PNG, JPG, WebP o SVG.');
  if (archivo.size > 5 * 1024 * 1024) throw new Error('La imagen pesa más de 5 MB.');
  if (archivo.type === 'image/svg+xml') {
    const url = await comoDataUrl(archivo);
    if (url.length > MAXIMO_LOGO) throw new Error('El SVG pesa más de 300 KB.');
    return url;
  }
  const objeto = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
      img.src = objeto;
    });
    const escala = Math.min(1, ANCHO_MAXIMO / imagen.naturalWidth, ALTO_MAXIMO / imagen.naturalHeight);
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no puede procesar la imagen.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    let url = archivo.type === 'image/jpeg' ? lienzo.toDataURL('image/jpeg', 0.9) : lienzo.toDataURL('image/png');
    if (url.length > MAXIMO_LOGO) url = lienzo.toDataURL('image/jpeg', 0.85);
    if (url.length > MAXIMO_LOGO) throw new Error('El logo sigue pesando más de 300 KB. Usa una imagen más sencilla.');
    return url;
  } finally {
    URL.revokeObjectURL(objeto);
  }
}

function comoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result as string);
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}
