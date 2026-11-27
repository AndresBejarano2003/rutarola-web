import { ADHESIVO_POR_DEFECTO, URL_DESCARGA, colorSeguro, partirTexto, qrSvg, svgAdhesivo, svgTarjeta, textoSobre } from './piezas';

describe('Piezas publicitarias', () => {
  const tarjeta = {
    plantilla: 'CLASICA' as const,
    colorPrincipal: '#1F2937',
    colorAcento: '#FACC15',
    logo: '',
    nombreEmpresa: 'Transportes <La Ruta>',
    eslogan: '',
    nombreContacto: 'Ana',
    cargo: '',
    telefono: '3001234567',
    correo: '',
    direccion: '',
    sitioWeb: '',
    mostrarApp: true,
    mostrarQr: true,
  };

  it('parte los textos largos y elige el color de texto con más contraste', () => {
    expect(partirTexto('Sigue la ruta escolar en vivo', 12)).toEqual(['Sigue la', 'ruta escolar', 'en vivo']);
    expect(partirTexto('uno dos tres cuatro', 4, 2)).toEqual(['uno', 'dos…']);
    expect(textoSobre('#111827')).toBe('#FFFFFF');
    expect(textoSobre('#FACC15')).toBe('#111827');
    expect(colorSeguro('red;"', '#000000')).toBe('#000000');
  });

  it('el QR es un SVG con módulos y el adhesivo lleva la insignia de Google Play', () => {
    expect(qrSvg(URL_DESCARGA, 0, 0, 100)).toMatch(/<path transform="scale\([\d.]+\)" d="M/);
    const svg = svgAdhesivo({ ...ADHESIVO_POR_DEFECTO, logo: 'javascript:alert(1)', nombreEmpresa: 'Ruta & Cía', telefono: '' });
    expect(svg).toContain('Google Play');
    expect(svg).toContain('Ruta &amp; Cía');
    // Solo imágenes en data URL.
    expect(svg).not.toContain('javascript:');
  });

  it('la tarjeta escapa los textos y el reverso invita a los acudientes', () => {
    expect(svgTarjeta(tarjeta, 'FRENTE')).toContain('Transportes &lt;La');
    const reverso = svgTarjeta(tarjeta, 'REVERSO');
    expect(reverso).toContain('Google Play');
    expect(reverso).toContain('Escanea');
    expect(svgTarjeta({ ...tarjeta, mostrarQr: false }, 'REVERSO')).not.toContain('Escanea');
  });
});
