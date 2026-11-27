import qrcode from 'qrcode-generator';

/**
 * Piezas publicitarias de la empresa, dibujadas como SVG (vista previa, PNG de alta resolución y PDF a tamaño real):
 * - adhesivo para los vehículos: invita a descargar la app (QR + "Disponible en Google Play");
 * - tarjeta de presentación (frente con los datos de contacto, reverso con la app para los acudientes).
 * Funciones puras: no tocan el DOM.
 */

/** Página pública que abre el QR: en Android lleva a Google Play; en otros equipos, a la app web y a rutarola.com. */
export const URL_DESCARGA = 'https://rutarola.com/descargar';

/** Amarillo de la marca (bus escolar). */
export const AMARILLO_MARCA = '#FACC15';

const FUENTE = "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escaparXml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
}

/** Solo colores `#RRGGBB` (lo demás vuelve al color por defecto): el SVG se arma con texto. */
export function colorSeguro(color: string, defecto: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : defecto;
}

/** Solo imágenes en data URL (PNG, JPG, WebP o SVG). */
function imagenSegura(imagen: string): string {
  return /^data:image\/(png|jpe?g|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(imagen) ? imagen : '';
}

/** Negro o blanco, el que más contraste haga con el fondo (WCAG). */
export function textoSobre(fondo: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fondo.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luz > 0.179 ? '#111827' : '#FFFFFF';
}

/** Divide un texto en líneas de como máximo `maximo` caracteres (aprox. por el ancho promedio de la letra). */
export function partirTexto(texto: string, maximo: number, lineas = 3): string[] {
  const resultado: string[] = [];
  let actual = '';
  for (const palabra of texto.trim().split(/\s+/).filter(Boolean)) {
    if (!actual) actual = palabra;
    else if (`${actual} ${palabra}`.length <= maximo) actual = `${actual} ${palabra}`;
    else {
      resultado.push(actual);
      actual = palabra;
    }
  }
  if (actual) resultado.push(actual);
  if (resultado.length > lineas) {
    const cortadas = resultado.slice(0, lineas);
    cortadas[lineas - 1] = `${cortadas[lineas - 1].replace(/[.,;:]?$/, '')}…`;
    return cortadas;
  }
  return resultado;
}

/** Código QR como `<g>` de SVG de `tamano` × `tamano` en (`x`, `y`), con su margen blanco. */
export function qrSvg(texto: string, x: number, y: number, tamano: number, color = '#111827'): string {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const margen = 2;
  const celda = tamano / (n + margen * 2);
  let camino = '';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(f, c)) camino += `M${c + margen},${f + margen}h1v1h-1z`;
    }
  }
  return (
    `<g transform="translate(${x} ${y})"><rect width="${tamano}" height="${tamano}" rx="${tamano * 0.04}" fill="#FFFFFF"/>` +
    `<path transform="scale(${celda})" d="${camino}" fill="${color}" shape-rendering="crispEdges"/></g>`
  );
}

/** Insignia "Disponible en Google Play" (ancho `ancho`, alto = ancho × 0.3), con el triángulo de cuatro colores. */
export function insigniaPlay(x: number, y: number, ancho: number, texto = 'DISPONIBLE EN'): string {
  const alto = ancho * 0.3;
  const icono = alto * 0.62;
  const ix = alto * 0.22;
  const iy = (alto - icono) / 2;
  const t = (px: number, py: number) => `${ix + px * icono},${iy + py * icono}`;
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect width="${ancho}" height="${alto}" rx="${alto * 0.16}" fill="#000000" stroke="#A6A6A6" stroke-width="${alto * 0.025}"/>` +
    `<polygon points="${t(0.05, 0)} ${t(0.62, 0.5)} ${t(0.05, 1)}" fill="#00D7FE"/>` +
    `<polygon points="${t(0.05, 0)} ${t(0.78, 0.38)} ${t(0.62, 0.5)}" fill="#00F076"/>` +
    `<polygon points="${t(0.05, 1)} ${t(0.62, 0.5)} ${t(0.78, 0.62)}" fill="#FF3A44"/>` +
    `<polygon points="${t(0.62, 0.5)} ${t(0.78, 0.38)} ${t(1, 0.5)} ${t(0.78, 0.62)}" fill="#FFD400"/>` +
    `<text x="${ix + icono + alto * 0.2}" y="${alto * 0.4}" font-family="${FUENTE}" font-size="${alto * 0.19}" fill="#FFFFFF" letter-spacing="${alto * 0.01}">${escaparXml(texto)}</text>` +
    `<text x="${ix + icono + alto * 0.18}" y="${alto * 0.78}" font-family="${FUENTE}" font-size="${alto * 0.37}" font-weight="600" fill="#FFFFFF">Google Play</text>` +
    `</g>`
  );
}

function textos(lineas: string[], x: number, y: number, tamano: number, color: string, opciones = ''): string {
  return lineas
    .map((l, i) => `<text x="${x}" y="${y + i * tamano * 1.18}" font-family="${FUENTE}" font-size="${tamano}" fill="${color}" ${opciones}>${escaparXml(l)}</text>`)
    .join('');
}

function svg(ancho: number, alto: number, contenido: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${contenido}</svg>`;
}

function logoSvg(logo: string, x: number, y: number, ancho: number, alto: number, alinear = 'xMinYMid'): string {
  const imagen = imagenSegura(logo);
  return imagen ? `<image href="${imagen}" x="${x}" y="${y}" width="${ancho}" height="${alto}" preserveAspectRatio="${alinear} meet"/>` : '';
}

// ---------------------------------------------------------------------------------------------------------------------
// Adhesivo para vehículos

export type FormatoAdhesivo = 'HORIZONTAL' | 'CUADRADO';

export const FORMATOS_ADHESIVO: { id: FormatoAdhesivo; nombre: string; descripcion: string; anchoCm: number; altoCm: number }[] = [
  { id: 'HORIZONTAL', nombre: 'Horizontal 60 × 30 cm', descripcion: 'Ventana trasera o costado', anchoCm: 60, altoCm: 30 },
  { id: 'CUADRADO', nombre: 'Cuadrado 30 × 30 cm', descripcion: 'Puertas o vidrios laterales', anchoCm: 30, altoCm: 30 },
];

export interface DisenoAdhesivo {
  formato: FormatoAdhesivo;
  titulo: string;
  subtitulo: string;
  colorFondo: string;
  colorAcento: string;
  logo: string;
  nombreEmpresa: string;
  telefono: string;
  mostrarEmpresa: boolean;
}

export const ADHESIVO_POR_DEFECTO: Omit<DisenoAdhesivo, 'logo' | 'nombreEmpresa' | 'telefono'> = {
  formato: 'HORIZONTAL',
  titulo: 'Sigue la ruta escolar en vivo',
  subtitulo: 'Ubicación del vehículo, avisos de ausencia y pagos desde tu celular con la app RutaRola.',
  colorFondo: '#111827',
  colorAcento: AMARILLO_MARCA,
  mostrarEmpresa: true,
};

/** Tamaño del lienzo del adhesivo (unidades SVG = 1 mm). */
export function medidasAdhesivo(formato: FormatoAdhesivo): { ancho: number; alto: number } {
  const f = FORMATOS_ADHESIVO.find((x) => x.id === formato) ?? FORMATOS_ADHESIVO[0];
  return { ancho: f.anchoCm * 10, alto: f.altoCm * 10 };
}

export function svgAdhesivo(d: DisenoAdhesivo): string {
  const { ancho, alto } = medidasAdhesivo(d.formato);
  const fondo = colorSeguro(d.colorFondo, ADHESIVO_POR_DEFECTO.colorFondo);
  const acento = colorSeguro(d.colorAcento, AMARILLO_MARCA);
  const texto = textoSobre(fondo);
  const secundario = texto === '#FFFFFF' ? '#E5E7EB' : '#374151';
  const borde = `<rect x="6" y="6" width="${ancho - 12}" height="${alto - 12}" rx="18" fill="none" stroke="${acento}" stroke-width="6"/>`;
  const empresa = d.mostrarEmpresa ? d.nombreEmpresa.trim() : '';
  const contacto = d.mostrarEmpresa && d.telefono.trim() ? `Tel. ${d.telefono.trim()}` : '';

  if (d.formato === 'CUADRADO') {
    const xLogo = 24;
    const xNombre = imagenSegura(d.logo) ? 82 : xLogo;
    const pie = empresa
      ? logoSvg(d.logo, xLogo, 256, 50, 28) +
        textos(partirTexto(empresa, imagenSegura(d.logo) ? 30 : 38, 1), xNombre, 269, 12, texto, 'font-weight="700"') +
        textos(contacto ? [contacto] : [], xNombre, 284, 10, secundario)
      : '';
    return svg(
      ancho,
      alto,
      `<rect width="${ancho}" height="${alto}" fill="${fondo}"/>${borde}` +
        textos(partirTexto(d.titulo, 21, 2), 24, 48, 22, acento, 'font-weight="800"') +
        textos(partirTexto(d.subtitulo, 42, 3), 24, 104, 11.5, texto) +
        qrSvg(URL_DESCARGA, 24, 148, 100) +
        textos(['Escanea y', 'descarga la app'], 138, 176, 13, texto, 'font-weight="700"') +
        insigniaPlay(138, 208, 130) +
        pie,
    );
  }

  // Horizontal: textos e insignia a la izquierda, QR en un panel a la derecha, empresa abajo.
  const qr = 190;
  const xQr = ancho - qr - 30;
  const xTexto = 32;
  const xNombre = imagenSegura(d.logo) ? xTexto + 82 : xTexto;
  const pie = empresa
    ? logoSvg(d.logo, xTexto, 246, 70, 38) +
      textos(partirTexto(empresa, imagenSegura(d.logo) ? 26 : 34, 1), xNombre, 262, 15, texto, 'font-weight="700"') +
      textos(contacto ? [contacto] : [], xNombre, 280, 12, secundario)
    : '';
  return svg(
    ancho,
    alto,
    `<rect width="${ancho}" height="${alto}" fill="${fondo}"/>` +
      `<rect x="${xQr - 30}" y="6" width="${ancho - xQr + 24}" height="${alto - 12}" rx="18" fill="${acento}" opacity="0.14"/>${borde}` +
      textos(partirTexto(d.titulo, 18, 2), xTexto, 64, 30, acento, 'font-weight="800"') +
      textos(partirTexto(d.subtitulo, 40, 3), xTexto, 134, 14, texto) +
      insigniaPlay(xTexto, 188, 140) +
      pie +
      qrSvg(URL_DESCARGA, xQr, 30, qr) +
      `<text x="${xQr + qr / 2}" y="${alto - 34}" text-anchor="middle" font-family="${FUENTE}" font-size="15" font-weight="700" fill="${texto}">Escanea y descarga la app</text>`,
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Tarjeta de presentación (9 × 5 cm)

export type PlantillaTarjeta = 'CLASICA' | 'CENTRADA';

export const PLANTILLAS_TARJETA: { id: PlantillaTarjeta; nombre: string; descripcion: string }[] = [
  { id: 'CLASICA', nombre: 'Clásica', descripcion: 'Franja de color con el logo y los datos a la derecha' },
  { id: 'CENTRADA', nombre: 'Centrada', descripcion: 'Logo y nombre al centro, contacto abajo' },
];

export interface DisenoTarjeta {
  plantilla: PlantillaTarjeta;
  colorPrincipal: string;
  colorAcento: string;
  logo: string;
  nombreEmpresa: string;
  eslogan: string;
  nombreContacto: string;
  cargo: string;
  telefono: string;
  correo: string;
  direccion: string;
  sitioWeb: string;
  /** Reverso: "Consulta tus datos en la app" para los acudientes. */
  mostrarApp: boolean;
  /** QR a rutarola.com/descargar en el reverso. */
  mostrarQr: boolean;
}

/** 90 × 50 mm (unidades SVG = 0,1 mm para tener detalle). */
export const MEDIDAS_TARJETA = { ancho: 900, alto: 500 };

export type CaraTarjeta = 'FRENTE' | 'REVERSO';

function lineasContacto(d: DisenoTarjeta): { icono: string; texto: string }[] {
  return [
    { icono: 'tel', texto: d.telefono.trim() },
    { icono: 'correo', texto: d.correo.trim() },
    { icono: 'direccion', texto: d.direccion.trim() },
    { icono: 'web', texto: d.sitioWeb.trim().replace(/^https?:\/\//, '') },
  ].filter((l) => l.texto);
}

/** Íconos simples de contacto (sin depender de Font Awesome dentro del SVG). */
function iconoContacto(tipo: string, x: number, y: number, t: number, color: string): string {
  const c = `fill="none" stroke="${color}" stroke-width="${t * 0.12}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (tipo) {
    case 'tel':
      return `<path transform="translate(${x} ${y}) scale(${t / 24})" d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2" ${c}/>`;
    case 'correo':
      return `<g transform="translate(${x} ${y}) scale(${t / 24})"><rect x="3" y="5" width="18" height="14" rx="2" ${c}/><path d="m3 7 9 6 9-6" ${c}/></g>`;
    case 'direccion':
      return `<g transform="translate(${x} ${y}) scale(${t / 24})"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" ${c}/><circle cx="12" cy="9" r="2.5" ${c}/></g>`;
    default:
      return `<g transform="translate(${x} ${y}) scale(${t / 24})"><circle cx="12" cy="12" r="9" ${c}/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" ${c}/></g>`;
  }
}

function contacto(d: DisenoTarjeta, x: number, y: number, tamano: number, color: string, colorIcono: string, maximo: number): string {
  return lineasContacto(d)
    .slice(0, 4)
    .map((l, i) => {
      const yy = y + i * tamano * 1.75;
      return iconoContacto(l.icono, x, yy - tamano * 0.9, tamano * 1.05, colorIcono) + textos(partirTexto(l.texto, maximo, 1), x + tamano * 1.6, yy, tamano, color);
    })
    .join('');
}

export function svgTarjeta(d: DisenoTarjeta, cara: CaraTarjeta): string {
  const { ancho, alto } = MEDIDAS_TARJETA;
  const principal = colorSeguro(d.colorPrincipal, '#1F2937');
  const acento = colorSeguro(d.colorAcento, AMARILLO_MARCA);
  const sobrePrincipal = textoSobre(principal);
  const oscuro = '#111827';
  const gris = '#4B5563';

  if (cara === 'REVERSO') {
    const conApp = d.mostrarApp;
    const conQr = d.mostrarQr;
    const anchoTexto = conQr ? 560 : 820;
    const cuerpo = conApp
      ? textos(partirTexto('¿Tu hijo viaja con nosotros?', conQr ? 22 : 34, 2), 50, 110, 44, sobrePrincipal, 'font-weight="800"') +
        textos(
          partirTexto(
            'Consulta la ruta en vivo, avisa ausencias y revisa tus pagos en la app RutaRola. Pide tu usuario a ' + (d.nombreEmpresa.trim() || 'tu empresa de transporte') + '.',
            conQr ? 40 : 60,
            4,
          ),
          50,
          conQr ? 250 : 200,
          25,
          sobrePrincipal,
          'opacity="0.92"',
        ) +
        insigniaPlay(50, alto - 120, 270)
      : logoSvg(d.logo, 50, 120, anchoTexto, 200, 'xMidYMid') ||
        textos(partirTexto(d.nombreEmpresa, 24, 2), ancho / 2, 240, 52, sobrePrincipal, 'font-weight="800" text-anchor="middle"');
    const qr = conQr
      ? qrSvg(URL_DESCARGA, ancho - 300, 70, 250) +
        `<text x="${ancho - 175}" y="${alto - 70}" text-anchor="middle" font-family="${FUENTE}" font-size="22" font-weight="700" fill="${sobrePrincipal}">Escanea y descárgala</text>`
      : '';
    return svg(ancho, alto, `<rect width="${ancho}" height="${alto}" fill="${principal}"/><rect y="${alto - 16}" width="${ancho}" height="16" fill="${acento}"/>${cuerpo}${qr}`);
  }

  const empresa = partirTexto(d.nombreEmpresa || 'Tu empresa', d.plantilla === 'CLASICA' ? 20 : 30, 2);
  const persona = d.nombreContacto.trim();
  const cargo = d.cargo.trim();

  if (d.plantilla === 'CENTRADA') {
    const logo = logoSvg(d.logo, ancho / 2 - 150, 36, 300, 120, 'xMidYMid');
    const yNombre = logo ? 196 : 150;
    return svg(
      ancho,
      alto,
      `<rect width="${ancho}" height="${alto}" fill="#FFFFFF"/><rect width="${ancho}" height="14" fill="${principal}"/><rect y="${alto - 14}" width="${ancho}" height="14" fill="${acento}"/>` +
        logo +
        textos(empresa, ancho / 2, yNombre, 40, principal === '#FFFFFF' ? oscuro : principal, 'font-weight="800" text-anchor="middle"') +
        textos(d.eslogan.trim() ? partirTexto(d.eslogan, 50, 1) : [], ancho / 2, yNombre + empresa.length * 47, 22, gris, 'text-anchor="middle" font-style="italic"') +
        `<line x1="70" y1="${alto - 160}" x2="${ancho - 70}" y2="${alto - 160}" stroke="#E5E7EB" stroke-width="2"/>` +
        textos(persona ? [persona + (cargo ? ` · ${cargo}` : '')] : [], ancho / 2, alto - 122, 24, oscuro, 'font-weight="700" text-anchor="middle"') +
        textos(
          [lineasContacto(d).filter((l) => l.icono === 'tel' || l.icono === 'correo').map((l) => l.texto).join('   ·   ')].filter(Boolean),
          ancho / 2,
          alto - 82,
          21,
          gris,
          'text-anchor="middle"',
        ) +
        textos(
          [lineasContacto(d).filter((l) => l.icono === 'direccion' || l.icono === 'web').map((l) => l.texto).join('   ·   ')].filter(Boolean),
          ancho / 2,
          alto - 48,
          21,
          gris,
          'text-anchor="middle"',
        ),
    );
  }

  // Clásica: franja de color a la izquierda con el logo y el nombre; datos de contacto a la derecha.
  const franja = 330;
  const logo = logoSvg(d.logo, 35, 50, franja - 70, 150, 'xMidYMid');
  const yEmpresa = logo ? 270 : 190;
  return svg(
    ancho,
    alto,
    `<rect width="${ancho}" height="${alto}" fill="#FFFFFF"/><rect width="${franja}" height="${alto}" fill="${principal}"/>` +
      `<rect x="${franja}" width="12" height="${alto}" fill="${acento}"/>` +
      logo +
      textos(empresa, franja / 2, yEmpresa, 34, sobrePrincipal, 'font-weight="800" text-anchor="middle"') +
      textos(d.eslogan.trim() ? partirTexto(d.eslogan, 24, 2) : [], franja / 2, yEmpresa + empresa.length * 40 + 6, 19, sobrePrincipal, 'text-anchor="middle" opacity="0.9"') +
      textos(persona ? partirTexto(persona, 26, 1) : [], franja + 50, 100, 32, oscuro, 'font-weight="800"') +
      textos(cargo ? partirTexto(cargo, 36, 1) : [], franja + 50, 138, 21, gris) +
      contacto(d, franja + 50, persona || cargo ? 225 : 150, 21, oscuro, principal === '#FFFFFF' ? oscuro : principal, 34),
  );
}
