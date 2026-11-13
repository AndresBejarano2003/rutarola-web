import type { Cotizacion } from 'src/app/finanzas/cotizaciones/cotizacion';
import type { Factura } from 'src/app/finanzas/facturas/factura';
import type { Recibo } from 'src/app/finanzas/recibos/recibo';
import { nombrePeriodo, periodosEntre } from '../fechas/fechas';

/**
 * Encabezado y pie de los PDF de la empresa (Inicio › Configuración › Documentos PDF; `GET/PUT /configuracion/documentos`).
 * `personalizado` false = aún no se guardó: trae los datos de contacto de la empresa. `logo`: data URL o `''`.
 */
export interface FormatoDocumentos {
  logo: string;
  nombreComercial: string;
  eslogan: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  correo: string;
  sitioWeb: string;
  /** `#RRGGBB`: barra del encabezado, títulos y encabezado de tablas. */
  colorPrincipal: string;
  piePagina: string;
  notaFactura: string;
  notaRecibo: string;
  notaCotizacion: string;
  personalizado?: boolean;
}

export type DatosFormatoDocumentos = Omit<FormatoDocumentos, 'personalizado'>;

export const COLOR_DOCUMENTOS_POR_DEFECTO = '#1F2937';
/** ~300 KB en base64 (igual a `ValidadorSolicitudFormatoDocumentos.MaximoLogo`). */
export const MAXIMO_LOGO = 400_000;

export const FORMATO_VACIO: FormatoDocumentos = {
  logo: '',
  nombreComercial: '',
  eslogan: '',
  nit: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  correo: '',
  sitioWeb: '',
  colorPrincipal: COLOR_DOCUMENTOS_POR_DEFECTO,
  piePagina: '',
  notaFactura: '',
  notaRecibo: '',
  notaCotizacion: '',
  personalizado: false,
};

export type TipoDocumentoPdf = 'FACTURA' | 'RECIBO' | 'COTIZACION';

/** Contenido de un documento, independiente de la empresa. */
export interface ContenidoDocumento {
  tipo: TipoDocumentoPdf;
  titulo: string;
  numero: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  /** "Anulada", "Aprobada"… (vacío = sin sello). */
  estado: string;
  datos: { etiqueta: string; valor: string }[];
  tabla: { columnas: string[]; filas: string[][]; alinearDerecha: number[] };
  totales: { etiqueta: string; valor: string; destacado?: boolean }[];
  observaciones: string;
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return a ? new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : iso;
}

export function contenidoFactura(f: Factura): ContenidoDocumento {
  const meses = periodosEntre(f.periodoInicio, f.periodoFin);
  return {
    tipo: 'FACTURA',
    titulo: 'Factura de servicio de transporte escolar',
    numero: f.numero,
    fecha: f.fechaEmision,
    estado: f.estado === 'INACTIVO' ? 'Anulada' : '',
    datos: [
      { etiqueta: 'Acudiente', valor: f.nombreAcudiente },
      { etiqueta: 'Estudiante', valor: f.nombreEstudiante },
      { etiqueta: 'Periodo', valor: `${nombrePeriodo(f.periodoInicio, true)} a ${nombrePeriodo(f.periodoFin, true)}` },
      { etiqueta: 'Concepto', valor: f.concepto },
    ],
    tabla: {
      columnas: ['Mes', 'Concepto', 'Valor'],
      filas: meses.map((p) => [nombrePeriodo(p, true), f.concepto || 'Transporte escolar', pesos.format(f.valorContratacion)]),
      alinearDerecha: [2],
    },
    totales: [
      { etiqueta: 'Valor mensual', valor: pesos.format(f.valorContratacion) },
      { etiqueta: `Total (${meses.length} ${meses.length === 1 ? 'mes' : 'meses'})`, valor: pesos.format(f.valorContratacion * meses.length), destacado: true },
    ],
    observaciones: f.observaciones,
  };
}

export function contenidoRecibo(r: Recibo, medioPago: string): ContenidoDocumento {
  return {
    tipo: 'RECIBO',
    titulo: 'Recibo de pago',
    numero: r.numero,
    fecha: r.fechaPago,
    estado: r.estado === 'INACTIVO' ? 'Anulado' : '',
    datos: [
      { etiqueta: 'Recibimos de', valor: r.nombreAcudiente },
      { etiqueta: 'Estudiante', valor: r.nombreEstudiante },
      { etiqueta: 'Factura', valor: r.numeroFactura },
      { etiqueta: 'Medio de pago', valor: r.referencia ? `${medioPago} · Ref. ${r.referencia}` : medioPago },
    ],
    tabla: {
      columnas: ['Concepto', 'Mes pagado', 'Valor'],
      filas: [['Transporte escolar', nombrePeriodo(r.periodo, true), pesos.format(r.valor)]],
      alinearDerecha: [2],
    },
    totales: [{ etiqueta: 'Total pagado', valor: pesos.format(r.valor), destacado: true }],
    observaciones: r.observaciones,
  };
}

export function contenidoCotizacion(c: Cotizacion, estado: string): ContenidoDocumento {
  return {
    tipo: 'COTIZACION',
    titulo: 'Cotización de transporte escolar',
    numero: c.numero,
    fecha: c.fecha,
    estado: c.estado === 'PENDIENTE' ? '' : estado,
    datos: [
      { etiqueta: 'Para', valor: c.nombreAcudiente },
      ...(c.telefonoAcudiente ? [{ etiqueta: 'Teléfono', valor: c.telefonoAcudiente }] : []),
    ],
    tabla: {
      columnas: ['Estudiante', 'Valor mensual'],
      filas: c.estudiantes.map((e) => [e.nombre, pesos.format(c.valorPorEstudiante)]),
      alinearDerecha: [1],
    },
    totales: [
      { etiqueta: 'Valor por estudiante', valor: pesos.format(c.valorPorEstudiante) },
      { etiqueta: 'Total mensual', valor: pesos.format(c.valorTotal), destacado: true },
    ],
    observaciones: c.observaciones,
  };
}

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Color válido o el de por defecto (nunca se inyecta CSS arbitrario). */
function colorSeguro(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : COLOR_DOCUMENTOS_POR_DEFECTO;
}

/** Logo solo como data URL de imagen. */
function logoSeguro(logo: string): string {
  return /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logo) ? logo : '';
}

function nota(formato: FormatoDocumentos, tipo: TipoDocumentoPdf): string {
  return tipo === 'FACTURA' ? formato.notaFactura : tipo === 'RECIBO' ? formato.notaRecibo : formato.notaCotizacion;
}

/** Página HTML lista para imprimir o "Guardar como PDF" (tamaño carta, estilos en línea, sin recursos externos). */
export function htmlDocumento(formato: FormatoDocumentos, c: ContenidoDocumento): string {
  const color = colorSeguro(formato.colorPrincipal);
  const logo = logoSeguro(formato.logo);
  const contacto = [
    formato.nit && `NIT ${formato.nit}`,
    [formato.direccion, formato.ciudad].filter(Boolean).join(', '),
    formato.telefono && `Tel. ${formato.telefono}`,
    formato.correo,
    formato.sitioWeb,
  ].filter(Boolean) as string[];
  const notaTipo = nota(formato, c.tipo);
  const filas = c.tabla.filas
    .map(
      (f) =>
        `<tr>${f.map((v, i) => `<td${c.tabla.alinearDerecha.includes(i) ? ' class="der"' : ''}>${escapar(v)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><title>${escapar(`${c.titulo} ${c.numero}`)}</title>
<style>
  @page { size: letter; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; font-size: 12px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .barra { height: 6px; background: ${color}; border-radius: 3px; margin-bottom: 14px; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .empresa { display: flex; gap: 12px; align-items: center; min-width: 0; }
  .empresa img { max-height: 64px; max-width: 180px; object-fit: contain; }
  .empresa h1 { margin: 0; font-size: 18px; color: ${color}; }
  .eslogan { margin: 2px 0 0; color: #4b5563; font-style: italic; }
  .contacto { margin: 4px 0 0; color: #374151; font-size: 11px; }
  .doc { text-align: right; flex-shrink: 0; }
  .doc h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: ${color}; }
  .doc .numero { font-size: 18px; font-weight: 700; margin: 2px 0; }
  .sello { display: inline-block; margin-top: 4px; padding: 2px 8px; border: 2px solid #b91c1c; color: #b91c1c; font-weight: 700;
    text-transform: uppercase; border-radius: 4px; font-size: 11px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 18px 0; padding: 12px; background: #f3f4f6; border-radius: 6px; }
  dt { color: #4b5563; } dd { margin: 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: ${color}; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  .der { text-align: right; }
  .totales { margin: 12px 0 0 auto; width: 280px; }
  .totales div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totales .destacado { border-top: 2px solid ${color}; font-size: 14px; font-weight: 700; margin-top: 4px; padding-top: 6px; }
  .bloque { margin-top: 16px; padding: 10px 12px; border-left: 3px solid ${color}; background: #f9fafb; white-space: pre-line; }
  .bloque strong { display: block; margin-bottom: 2px; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #4b5563; font-size: 10.5px; text-align: center; white-space: pre-line; }
</style></head>
<body>
  <div class="barra"></div>
  <header>
    <div class="empresa">
      ${logo ? `<img src="${logo}" alt="" />` : ''}
      <div>
        <h1>${escapar(formato.nombreComercial || 'Empresa de transporte')}</h1>
        ${formato.eslogan ? `<p class="eslogan">${escapar(formato.eslogan)}</p>` : ''}
        ${contacto.length ? `<p class="contacto">${contacto.map(escapar).join(' · ')}</p>` : ''}
      </div>
    </div>
    <div class="doc">
      <h2>${escapar(c.titulo)}</h2>
      <p class="numero">${escapar(c.numero)}</p>
      <p>${escapar(fechaLarga(c.fecha))}</p>
      ${c.estado ? `<span class="sello">${escapar(c.estado)}</span>` : ''}
    </div>
  </header>
  <dl>${c.datos.map((d) => `<dt>${escapar(d.etiqueta)}</dt><dd>${escapar(d.valor || '—')}</dd>`).join('')}</dl>
  <table><thead><tr>${c.tabla.columnas.map((t, i) => `<th${c.tabla.alinearDerecha.includes(i) ? ' class="der"' : ''}>${escapar(t)}</th>`).join('')}</tr></thead>
  <tbody>${filas}</tbody></table>
  <div class="totales">${c.totales.map((t) => `<div${t.destacado ? ' class="destacado"' : ''}><span>${escapar(t.etiqueta)}</span><span>${escapar(t.valor)}</span></div>`).join('')}</div>
  ${c.observaciones ? `<div class="bloque"><strong>Observaciones</strong>${escapar(c.observaciones)}</div>` : ''}
  ${notaTipo ? `<div class="bloque">${escapar(notaTipo)}</div>` : ''}
  <footer>${escapar(formato.piePagina || `${formato.nombreComercial} · Documento generado con RutaRola`)}</footer>
</body></html>`;
}

/**
 * Abre el diálogo de impresión del navegador con el documento ("Guardar como PDF" lo descarga). Usa un iframe oculto
 * para no abrir ventanas (los bloqueadores de ventanas emergentes no lo impiden).
 */
export function imprimirHtml(html: string): void {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  marco.srcdoc = html;
  marco.onload = () => {
    const ventana = marco.contentWindow;
    if (!ventana) return;
    ventana.focus();
    ventana.print();
    // Safari/Chrome devuelven el control al cerrar el diálogo; se limpia después.
    setTimeout(() => marco.remove(), 60_000);
  };
  document.body.appendChild(marco);
}

/** Ejemplo para la vista previa de la configuración. */
export function contenidoDeEjemplo(tipo: TipoDocumentoPdf): ContenidoDocumento {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const periodo = fecha.slice(0, 7);
  const base = { id: 'ejemplo', fechaCreacion: fecha, fechaActualizacion: fecha, observaciones: '' };
  if (tipo === 'RECIBO') {
    return contenidoRecibo(
      { ...base, numero: 'REC-0001', facturaId: '', numeroFactura: 'FAC-0001', nombreAcudiente: 'María Pérez', nombreEstudiante: 'Juan Pérez',
        periodo, fechaPago: fecha, valor: 250_000, medioPago: 'TRANSFERENCIA', referencia: '123456', estado: 'ACTIVO' },
      'Transferencia bancaria',
    );
  }
  if (tipo === 'COTIZACION') {
    return contenidoCotizacion(
      { ...base, numero: 'COT-0001', fecha, registrados: false, acudienteId: null, nombreAcudiente: 'María Pérez', telefonoAcudiente: '3001234567',
        estudiantes: [{ estudianteId: null, nombre: 'Juan Pérez' }, { estudianteId: null, nombre: 'Sofía Pérez' }],
        valorPorEstudiante: 250_000, valorTotal: 500_000, estado: 'PENDIENTE' },
      'Pendiente',
    );
  }
  return contenidoFactura({
    ...base, numero: 'FAC-0001', fechaEmision: fecha, acudienteId: '', estudianteId: '', nombreAcudiente: 'María Pérez',
    nombreEstudiante: 'Juan Pérez', valorContratacion: 250_000, periodoInicio: periodo, periodoFin: periodo, concepto: 'Transporte escolar', estado: 'ACTIVO',
  });
}
