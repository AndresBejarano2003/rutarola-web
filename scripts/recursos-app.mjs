// Genera las imágenes de origen del ícono y la pantalla de carga de la app a partir del logo del menú
// (public/logos/logo-oficial-sin-fondo-lb.png) sobre el fondo oscuro de la app, y las de la ficha de Google Play.
// Uso: `npm run app:recursos` (después `@capacitor/assets` crea los tamaños de Android).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const FONDO = '#111827';
const LOGO = 'public/logos/logo-oficial-sin-fondo-lb.png';
const SALIDA = 'recursos-app';
const TIENDA = `${SALIDA}/play-store`;
mkdirSync(TIENDA, { recursive: true });

/** El PNG tiene márgenes transparentes: se recortan para centrar bien. */
const logo = await sharp(LOGO).trim().toBuffer();

async function lienzo(ancho, alto, anchoLogo, archivo, fondo = FONDO) {
  const pieza = await sharp(logo).resize({ width: Math.round(anchoLogo) }).toBuffer();
  const { height } = await sharp(pieza).metadata();
  await sharp({ create: { width: ancho, height: alto, channels: 4, background: fondo } })
    .composite([{ input: pieza, left: Math.round((ancho - anchoLogo) / 2), top: Math.round((alto - height) / 2) }])
    .png()
    .toFile(archivo);
}

// Ícono completo (Android antiguo y Play Store) y capas del ícono adaptable (Android 8+: la zona visible segura es el
// 66 % central, por eso el logo va más pequeño en el primer plano).
await lienzo(1024, 1024, 860, `${SALIDA}/icon-only.png`);
await lienzo(1024, 1024, 600, `${SALIDA}/icon-foreground.png`, { r: 0, g: 0, b: 0, alpha: 0 });
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: FONDO } }).png().toFile(`${SALIDA}/icon-background.png`);
// Pantalla de carga (clara y oscura iguales: la app es oscura por defecto).
await lienzo(2732, 2732, 1100, `${SALIDA}/splash.png`);
await lienzo(2732, 2732, 1100, `${SALIDA}/splash-dark.png`);
// Ficha de Google Play: ícono 512×512 y gráfico de funciones 1024×500.
await lienzo(512, 512, 430, `${TIENDA}/icono-512.png`);
await lienzo(1024, 500, 620, `${TIENDA}/grafico-funciones-1024x500.png`);
console.log('Recursos de la app generados en', SALIDA);
