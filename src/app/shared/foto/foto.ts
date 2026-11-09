/** Lado (px) de la foto guardada: cuadrada, recortada al centro. */
export const LADO_FOTO = 256;
/** Peso máximo del archivo original que se acepta antes de reducirlo. */
export const MAXIMO_ORIGINAL_MB = 10;
export const TIPOS_FOTO = 'image/jpeg,image/png,image/webp';

/**
 * Lee una imagen, la recorta al centro en un cuadrado y la reduce a {@link LADO_FOTO} px en JPG (unos 20–40 KB):
 * así cabe en el registro y en la sesión, y se muestra en las tablas sin descargar la original.
 * Rechaza con un mensaje para el usuario.
 */
export async function reducirFoto(archivo: File): Promise<string> {
  if (!TIPOS_FOTO.split(',').includes(archivo.type)) {
    throw new Error('Elige una imagen JPG, PNG o WebP.');
  }
  if (archivo.size > MAXIMO_ORIGINAL_MB * 1024 * 1024) {
    throw new Error(`La imagen pesa más de ${MAXIMO_ORIGINAL_MB} MB.`);
  }
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await cargarImagen(url);
    const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight);
    if (!lado) throw new Error('No se pudo leer la imagen.');
    const destino = Math.min(LADO_FOTO, lado);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = destino;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('Tu navegador no puede procesar la imagen.');
    ctx.fillStyle = '#ffffff'; // fondo para PNG transparentes
    ctx.fillRect(0, 0, destino, destino);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imagen,
      (imagen.naturalWidth - lado) / 2,
      (imagen.naturalHeight - lado) / 2,
      lado,
      lado,
      0,
      0,
      destino,
      destino,
    );
    return lienzo.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    imagen.src = url;
  });
}

/** Iniciales de un nombre completo ("Ana María Gómez" → "AG"). */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const ultima = partes.length > 2 ? partes[partes.length - 2] : partes[partes.length - 1];
  return `${partes[0][0]}${partes.length > 1 ? ultima[0] : ''}`.toUpperCase();
}
