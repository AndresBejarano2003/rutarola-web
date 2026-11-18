import { Injectable, Injector, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { DatosRegistro, ErrorCrud, siguienteConsecutivo } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso, nombrePeriodo, periodoDe, sumarMeses } from 'src/app/shared/fechas/fechas';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { cuotasFactura, pagosDeRecibos } from '../cuotas';
import { fechaLimiteCuota } from '../reportes/reportes';
import { FILTROS_PROGRAMACION_VACIOS } from '../programacion/programacion';
import { ProgramacionesRepositorio } from '../programacion/programaciones-repositorio';
import { FILTROS_RECIBO_VACIOS } from '../recibos/recibo';
import { RecibosRepositorio } from '../recibos/recibos-repositorio';
import { CuotaFactura, FILTROS_FACTURA_VACIOS, Factura, FiltrosFactura, etiquetaFactura } from './factura';
import { FacturasRepositorio } from './facturas-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class FacturasLocal extends RepositorioLocal<Factura, FiltrosFactura> implements FacturasRepositorio {
  protected readonly clave = 'rutarola.facturas';
  protected readonly filtrosVacios = FILTROS_FACTURA_VACIOS;
  private readonly injector = inject(Injector);

  protected coincide(f: Factura, filtros: FiltrosFactura): boolean {
    const texto = normalizar(filtros.texto);
    return (
      (!texto || normalizar(`${f.numero} ${f.nombreAcudiente} ${f.nombreEstudiante}`).includes(texto)) &&
      (!filtros.acudienteId || f.acudienteId === filtros.acudienteId) &&
      (!filtros.estudianteId || f.estudianteId === filtros.estudianteId) &&
      (!filtros.estado || f.estado === filtros.estado)
    );
  }

  protected etiquetaOpcion(f: Factura): string {
    return etiquetaFactura(f);
  }

  protected override ordenar(a: Factura, b: Factura): number {
    return b.numero.localeCompare(a.numero, 'es', { numeric: true });
  }

  protected override validar(datos: DatosRegistro<Factura>, idActual: string | null, registros: Factura[]): void {
    if (datos.periodoFin < datos.periodoInicio) {
      throw new ErrorCrud('El mes final no puede ser anterior al mes inicial.', 'VALIDACION');
    }
    if (datos.estado === 'ACTIVO') {
      const cruce = registros.find(
        (r) =>
          r.id !== idActual &&
          r.estado === 'ACTIVO' &&
          r.estudianteId === datos.estudianteId &&
          r.periodoInicio <= datos.periodoFin &&
          datos.periodoInicio <= r.periodoFin,
      );
      if (cruce) {
        throw new ErrorCrud(
          `${datos.nombreEstudiante} ya tiene la factura vigente ${cruce.numero} en ese periodo. Anúlala o ajusta los meses.`,
          'DUPLICADO',
        );
      }
    }
  }

  /** El estudiante debe pertenecer al acudiente de la factura. */
  protected override validarRelaciones(datos: DatosRegistro<Factura>): Observable<unknown> {
    return this.injector
      .get(EstudiantesRepositorio)
      .obtener(datos.estudianteId)
      .pipe(
        map((estudiante) => {
          if (estudiante.acudienteId !== datos.acudienteId) {
            throw new ErrorCrud('El estudiante no está a cargo del acudiente elegido.', 'VALIDACION');
          }
        }),
      );
  }

  /** El formulario no trae el retiro ni la cotización: se conservan (y un retiro fuera de los meses nuevos se quita). */
  protected override preparar(datos: DatosRegistro<Factura>, idActual: string | null, registros: Factura[]): DatosRegistro<Factura> {
    const actual = idActual ? registros.find((r) => r.id === idActual) : undefined;
    let periodoRetiro = datos.periodoRetiro ?? actual?.periodoRetiro ?? '';
    let motivoRetiro = datos.motivoRetiro ?? actual?.motivoRetiro ?? '';
    if (periodoRetiro && (periodoRetiro <= datos.periodoInicio || periodoRetiro > datos.periodoFin)) {
      periodoRetiro = '';
      motivoRetiro = '';
    }
    return {
      ...datos,
      numero: actual?.numero ?? (idActual ? datos.numero : siguienteConsecutivo('FAC', registros.map((r) => r.numero))),
      periodoRetiro,
      motivoRetiro,
      cotizacionId: datos.cotizacionId ?? actual?.cotizacionId ?? '',
      numeroCotizacion: datos.numeroCotizacion ?? actual?.numeroCotizacion ?? '',
    };
  }

  cuotas(id: string, sinRecibo?: string): Observable<CuotaFactura[]> {
    return forkJoin([
      this.obtener(id),
      this.injector.get(RecibosRepositorio).listar({ ...FILTROS_RECIBO_VACIOS, facturaId: id, estado: 'ACTIVO' }, SIN_PAGINAR),
      this.injector.get(ProgramacionesRepositorio).listar({ ...FILTROS_PROGRAMACION_VACIOS, facturaId: id }, SIN_PAGINAR),
    ]).pipe(
      map(([factura, recibos, programaciones]) => {
        const dia = programaciones.items[0]?.diaLimitePago;
        const hoy = fechaIso();
        return cuotasFactura(factura, pagosDeRecibos(recibos.items.filter((r) => r.id !== sinRecibo))).map((c): CuotaFactura => {
          const fechaLimite = fechaLimiteCuota(c.periodo, dia);
          const estado = c.saldo <= 0 ? 'PAGADA' : hoy > fechaLimite ? 'VENCIDA' : c.periodo <= periodoDe() ? 'PENDIENTE' : 'PROGRAMADA';
          return { ...c, fechaLimite, estado };
        });
      }),
    );
  }

  retiro(id: string, periodoRetiro: string, motivo: string): Observable<Factura> {
    return this.obtener(id).pipe(
      switchMap((f) => {
        if (!periodoRetiro) return of({ ...f, periodoRetiro: '', motivoRetiro: '' });
        if (f.estado !== 'ACTIVO') throw new ErrorCrud(`La factura ${f.numero} está anulada.`, 'VALIDACION');
        return this.validarRetiro(f, periodoRetiro).pipe(map(() => ({ ...f, periodoRetiro, motivoRetiro: motivo.trim() })));
      }),
      switchMap(({ id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos }) => this.actualizar(id, datos)),
    );
  }

  /** Igual que `ServicioFacturas.AplicarRetiroAsync`: entre el segundo y el último mes, sin pagos desde ese mes. */
  private validarRetiro(f: Factura, retiro: string): Observable<void> {
    if (retiro <= f.periodoInicio || retiro > f.periodoFin) {
      throw new ErrorCrud(
        `El retiro debe ser entre ${nombrePeriodo(sumarMeses(f.periodoInicio, 1), true)} y ${nombrePeriodo(f.periodoFin, true)}. ` +
          'Para no cobrar ningún mes, anula la factura.',
        'VALIDACION',
      );
    }
    return this.injector
      .get(RecibosRepositorio)
      .listar({ ...FILTROS_RECIBO_VACIOS, facturaId: f.id, estado: 'ACTIVO' }, SIN_PAGINAR)
      .pipe(
        map(({ items }) => {
          const meses = [...new Set(pagosDeRecibos(items).map((p) => p.periodo).filter((p) => p >= retiro))].sort();
          if (meses.length) {
            throw new ErrorCrud(
              `La factura ${f.numero} tiene pagos de ${meses.map((m) => nombrePeriodo(m, true)).join(', ')}. ` +
                'Anula esos recibos o elige un mes de retiro posterior.',
              'VALIDACION',
            );
          }
        }),
      );
  }

  /**
   * Al inactivar un estudiante o un acudiente (lo llaman sus repositorios locales; con el API lo hace el servidor):
   * sus facturas vigentes dejan de cobrar desde el mes siguiente (o desde el mes después del último pagado).
   */
  retirarDe(filtro: { estudianteId?: string; acudienteId?: string }, motivo: string): Observable<number> {
    const siguiente = sumarMeses(periodoDe(), 1);
    return forkJoin([
      this.listar({ ...FILTROS_FACTURA_VACIOS, ...filtro, estado: 'ACTIVO' }, SIN_PAGINAR),
      this.injector.get(RecibosRepositorio).listar({ ...FILTROS_RECIBO_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
    ]).pipe(
      switchMap(([facturas, recibos]) => {
        const cambios = facturas.items.flatMap((f) => {
          if (f.periodoFin < siguiente || (f.periodoRetiro && f.periodoRetiro <= siguiente)) return [];
          const pagados = pagosDeRecibos(recibos.items.filter((r) => r.facturaId === f.id)).map((p) => p.periodo).sort();
          const ultimo = pagados[pagados.length - 1];
          const desde = [siguiente, ultimo ? sumarMeses(ultimo, 1) : siguiente, sumarMeses(f.periodoInicio, 1)].sort().at(-1)!;
          if (desde > f.periodoFin || (f.periodoRetiro && f.periodoRetiro <= desde)) return [];
          const { id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = f;
          return [this.actualizar(id, { ...datos, periodoRetiro: desde, motivoRetiro: motivo })];
        });
        return cambios.length ? forkJoin(cambios).pipe(map((r) => r.length)) : of(0);
      }),
    );
  }

  override motivoNoEliminar(id: string): Observable<string | null> {
    return forkJoin([
      this.injector.get(RecibosRepositorio).listar({ ...FILTROS_RECIBO_VACIOS, facturaId: id }, { pagina: 1, tamano: 1 }),
      this.injector.get(ProgramacionesRepositorio).listar({ ...FILTROS_PROGRAMACION_VACIOS, facturaId: id }, { pagina: 1, tamano: 1 }),
    ]).pipe(
      map(([recibos, programaciones]) => {
        if (recibos.total) return `No se puede eliminar: tiene ${recibos.total} recibo(s) de pago. Anúlala para conservar el historial.`;
        if (programaciones.total) return 'No se puede eliminar: tiene una programación de facturación. Elimina primero la programación o anula la factura.';
        return null;
      }),
    );
  }

  protected datosIniciales(): Factura[] {
    const factura = (
      id: string,
      numero: string,
      [acudienteId, nombreAcudiente]: [string, string],
      [estudianteId, nombreEstudiante]: [string, string],
      valorContratacion: number,
    ): Factura => ({
      id,
      numero,
      fechaEmision: '2026-01-25',
      acudienteId,
      estudianteId,
      nombreAcudiente,
      nombreEstudiante,
      valorContratacion,
      periodoInicio: '2026-02',
      periodoFin: '2026-11',
      concepto: 'Transporte escolar 2026',
      estado: 'ACTIVO',
      observaciones: '',
      fechaCreacion: '2026-01-25T08:00:00.000Z',
      fechaActualizacion: '2026-01-25T08:00:00.000Z',
    });
    // Ids coherentes con acudientes y estudiantes de ejemplo.
    return [
      factura('fac-1', 'FAC-0001', ['acu-1', 'María Pérez López'], ['est-1', 'Juan Sebastián Pérez López'], 420000),
      factura('fac-2', 'FAC-0002', ['acu-1', 'María Pérez López'], ['est-2', 'Valentina Pérez López'], 380000),
      factura('fac-3', 'FAC-0003', ['acu-2', 'Carlos Andrés Rodríguez Mejía'], ['est-3', 'Samuel David Rodríguez Mejía'], 350000),
      factura('fac-4', 'FAC-0004', ['acu-3', 'Luz Marina Gómez Vargas'], ['est-4', 'Isabella Gómez Vargas'], 450000),
      factura('fac-5', 'FAC-0005', ['acu-4', 'Jorge Martínez Ruiz'], ['est-6', 'Daniela Martínez Ruiz'], 400000),
      factura('fac-6', 'FAC-0006', ['acu-5', 'Andrea Castillo Ortiz'], ['est-9', 'Sara Lucía Castillo Ortiz'], 390000),
    ];
  }
}
