import { Injectable, Injector, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DatosRegistro, ErrorCrud, siguienteConsecutivo } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { nombrePeriodo, periodosEntre } from 'src/app/shared/fechas/fechas';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { cuotasFactura, distribuir, pagosDeRecibos } from '../cuotas';
import { Factura } from '../facturas/factura';
import { FacturasRepositorio } from '../facturas/facturas-repositorio';
import { FILTROS_RECIBO_VACIOS, FiltrosRecibo, MedioPago, Recibo } from './recibo';
import { RecibosRepositorio } from './recibos-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class RecibosLocal extends RepositorioLocal<Recibo, FiltrosRecibo> implements RecibosRepositorio {
  protected readonly clave = 'rutarola.recibos';
  protected readonly filtrosVacios = FILTROS_RECIBO_VACIOS;
  private readonly injector = inject(Injector);
  /** Factura del recibo en curso (la carga `validarRelaciones`, la usa `preparar`). */
  private factura: Factura | null = null;

  protected coincide(r: Recibo, f: FiltrosRecibo): boolean {
    const texto = normalizar(f.texto);
    return (
      (!texto ||
        normalizar(`${r.numero} ${r.numeroFactura} ${r.nombreAcudiente} ${r.nombreEstudiante} ${r.referencia}`).includes(texto)) &&
      (!f.facturaId || r.facturaId === f.facturaId) &&
      (!f.medioPago || r.medioPago === f.medioPago) &&
      (!f.estado || r.estado === f.estado) &&
      (!f.desde || r.fechaPago >= f.desde) &&
      (!f.hasta || r.fechaPago <= f.hasta)
    );
  }

  protected etiquetaOpcion(r: Recibo): string {
    return `${r.numero} · ${r.nombreEstudiante} · ${nombrePeriodo(r.periodo)}`;
  }

  protected override ordenar(a: Recibo, b: Recibo): number {
    return b.fechaPago.localeCompare(a.fechaPago) || b.numero.localeCompare(a.numero, 'es', { numeric: true });
  }

  protected override validarRelaciones(datos: DatosRegistro<Recibo>): Observable<unknown> {
    return this.injector
      .get(FacturasRepositorio)
      .obtener(datos.facturaId)
      .pipe(
        map((factura) => {
          if (datos.estado === 'ACTIVO' && factura.estado !== 'ACTIVO') {
            throw new ErrorCrud(`La factura ${factura.numero} está anulada.`, 'VALIDACION');
          }
          this.factura = factura;
        }),
      );
  }

  /**
   * Reparte el valor en los meses (como el API): MESES = los elegidos, SALDO = los más antiguos con saldo. Un recibo
   * anulado sin cambios de factura ni valor conserva cómo se había aplicado.
   */
  protected override preparar(datos: DatosRegistro<Recibo>, idActual: string | null, registros: Recibo[]): DatosRegistro<Recibo> {
    const factura = this.factura;
    if (!factura) throw new ErrorCrud('La factura no existe.', 'NO_ENCONTRADO');
    const actual = idActual ? registros.find((r) => r.id === idActual) : undefined;
    const numero = actual?.numero ?? siguienteConsecutivo('REC', registros.map((r) => r.numero));
    const aplicacion = datos.aplicacion ?? 'MESES';
    const periodos = datos.periodos?.length ? datos.periodos : datos.periodo ? [datos.periodo] : [];
    const conservar =
      datos.estado === 'INACTIVO' && actual?.facturaId === datos.facturaId && actual.valor === datos.valor && !!actual.meses?.length;
    const meses = conservar
      ? actual!.meses!
      : distribuir(
          cuotasFactura(factura, pagosDeRecibos(registros.filter((r) => r.facturaId === factura.id && r.id !== idActual))),
          datos.valor,
          aplicacion,
          aplicacion === 'MESES' ? periodos : [],
          factura.numero,
        );
    return { ...datos, numero, aplicacion, periodos: aplicacion === 'MESES' ? periodos : [], meses, periodo: meses[0]?.periodo ?? datos.periodo };
  }

  protected datosIniciales(): Recibo[] {
    // [facturaId, numero factura, acudiente, estudiante, valor, último mes pagado]
    const pagos: [string, string, string, string, number, string][] = [
      ['fac-1', 'FAC-0001', 'María Pérez López', 'Juan Sebastián Pérez López', 420000, '2026-10'],
      ['fac-2', 'FAC-0002', 'María Pérez López', 'Valentina Pérez López', 380000, '2026-08'],
      ['fac-3', 'FAC-0003', 'Carlos Andrés Rodríguez Mejía', 'Samuel David Rodríguez Mejía', 350000, '2026-10'],
      ['fac-4', 'FAC-0004', 'Luz Marina Gómez Vargas', 'Isabella Gómez Vargas', 450000, '2026-07'],
      ['fac-5', 'FAC-0005', 'Jorge Martínez Ruiz', 'Daniela Martínez Ruiz', 400000, '2026-10'],
      ['fac-6', 'FAC-0006', 'Andrea Castillo Ortiz', 'Sara Lucía Castillo Ortiz', 390000, '2026-09'],
    ];
    const medios: MedioPago[] = ['TRANSFERENCIA', 'NEQUI', 'EFECTIVO', 'DAVIPLATA', 'TARJETA'];
    const recibos: Recibo[] = [];
    let consecutivo = 0;
    for (const periodo of periodosEntre('2026-02', '2026-10')) {
      pagos.forEach(([facturaId, numeroFactura, nombreAcudiente, nombreEstudiante, valor, ultimo], i) => {
        if (periodo > ultimo) return;
        consecutivo++;
        const dia = String(1 + ((i * 3 + consecutivo) % 9)).padStart(2, '0');
        const medioPago = medios[(i + consecutivo) % medios.length];
        recibos.push({
          id: `rec-${consecutivo}`,
          numero: `REC-${String(consecutivo).padStart(4, '0')}`,
          facturaId,
          numeroFactura,
          nombreAcudiente,
          nombreEstudiante,
          periodo,
          aplicacion: 'MESES',
          periodos: [periodo],
          meses: [{ periodo, valor }],
          fechaPago: `${periodo}-${dia}`,
          valor,
          medioPago,
          referencia: medioPago === 'EFECTIVO' ? '' : String(48_210_000 + consecutivo * 137),
          estado: 'ACTIVO',
          observaciones: '',
          fechaCreacion: `${periodo}-${dia}T10:00:00.000Z`,
          fechaActualizacion: `${periodo}-${dia}T10:00:00.000Z`,
        });
      });
    }
    return recibos;
  }
}
