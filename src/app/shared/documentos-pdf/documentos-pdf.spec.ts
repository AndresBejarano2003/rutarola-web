import { FORMATO_VACIO, contenidoDeEjemplo, contenidoFactura, htmlDocumento } from './documentos-pdf';

describe('Documentos PDF', () => {
  it('pinta el formato de la empresa y escapa los textos', () => {
    const html = htmlDocumento(
      { ...FORMATO_VACIO, nombreComercial: 'Transportes <Sol>', eslogan: 'Seguros', colorPrincipal: '#123456', notaFactura: 'Consignar en la cuenta 1', piePagina: 'Gracias' },
      contenidoDeEjemplo('FACTURA'),
    );
    expect(html).toContain('Transportes &lt;Sol&gt;');
    expect(html).not.toContain('<Sol>');
    expect(html).toContain('#123456');
    expect(html).toContain('Consignar en la cuenta 1');
    expect(html).toContain('Gracias');
    expect(html).toContain('FAC-0001');
  });

  it('no acepta color ni logo arbitrarios', () => {
    const html = htmlDocumento({ ...FORMATO_VACIO, colorPrincipal: 'red;}</style><script>', logo: 'javascript:alert(1)' }, contenidoDeEjemplo('RECIBO'));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('#1F2937');
  });

  it('la factura suma un valor mensual por cada mes', () => {
    const c = contenidoFactura({
      id: 'f', fechaCreacion: '', fechaActualizacion: '', numero: 'FAC-0009', fechaEmision: '2026-02-01', acudienteId: '', estudianteId: '',
      nombreAcudiente: 'A', nombreEstudiante: 'E', valorContratacion: 100_000, periodoInicio: '2026-02', periodoFin: '2026-04', concepto: 'Ruta', estado: 'INACTIVO', observaciones: '',
    });
    expect(c.tabla.filas).toHaveLength(3);
    expect(c.estado).toBe('Anulada');
    expect(c.totales.at(-1)?.etiqueta).toContain('3 meses');
  });
});
