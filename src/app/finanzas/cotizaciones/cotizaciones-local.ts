import { Injectable, Injector, inject } from '@angular/core';
import { Observable, catchError, concatMap, forkJoin, from, map, of, switchMap, tap, throwError, toArray } from 'rxjs';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { Estudiante } from 'src/app/personas/estudiantes/estudiante';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { DatosRegistro, ErrorCrud, siguienteConsecutivo } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { Factura, etiquetaFactura } from '../facturas/factura';
import { FacturasRepositorio } from '../facturas/facturas-repositorio';
import { Cotizacion, EstudianteCotizado, FILTROS_COTIZACION_VACIOS, FiltrosCotizacion, calcularValores, facturada, motivoNoFacturar } from './cotizacion';
import { CotizacionesRepositorio, ResultadoFacturacion } from './cotizaciones-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class CotizacionesLocal extends RepositorioLocal<Cotizacion, FiltrosCotizacion> implements CotizacionesRepositorio {
  protected readonly clave = 'rutarola.cotizaciones';
  protected readonly filtrosVacios = FILTROS_COTIZACION_VACIOS;
  private readonly injector = inject(Injector);
  /** Estudiantes registrados y nombres de colegios de la cotización en curso (los carga `validarRelaciones`). */
  private registrados = new Map<string, Estudiante>();
  private colegios = new Map<string, string>();

  protected coincide(c: Cotizacion, f: FiltrosCotizacion): boolean {
    const texto = normalizar(f.texto);
    return (
      (!texto ||
        normalizar(`${c.numero} ${c.nombreAcudiente} ${c.estudiantes.map((e) => `${e.nombre} ${e.nombreColegio ?? ''}`).join(' ')}`).includes(texto)) &&
      (!f.estado || c.estado === f.estado) &&
      (!f.desde || c.fecha >= f.desde) &&
      (!f.hasta || c.fecha <= f.hasta)
    );
  }

  protected etiquetaOpcion(c: Cotizacion): string {
    return `${c.numero} · ${c.nombreAcudiente}`;
  }

  protected override ordenar(a: Cotizacion, b: Cotizacion): number {
    return b.numero.localeCompare(a.numero, 'es', { numeric: true });
  }

  protected override validar(datos: DatosRegistro<Cotizacion>, idActual: string | null, registros: Cotizacion[]): void {
    const actual = idActual ? registros.find((r) => r.id === idActual) : undefined;
    if (actual && facturada(actual)) {
      throw new ErrorCrud(`La cotización ${actual.numero} ya se convirtió en facturas y no se puede modificar.`, 'DUPLICADO');
    }
    if (!datos.estudiantes.length) throw new ErrorCrud('Agrega al menos un estudiante a la cotización.', 'VALIDACION');
    if (datos.registrados && !datos.acudienteId) throw new ErrorCrud('Elige el acudiente registrado.', 'VALIDACION');
    if (datos.estudiantes.some((e) => !(e.valor >= 1))) {
      throw new ErrorCrud('El valor mensual de cada estudiante debe ser mayor que cero.', 'VALIDACION');
    }
    if (!datos.periodoInicio || !datos.periodoFin || datos.periodoFin < datos.periodoInicio) {
      throw new ErrorCrud('El mes final no puede ser anterior al mes inicial.', 'VALIDACION');
    }
  }

  /** Como el API: los registrados toman su nombre y su colegio del registro. */
  protected override validarRelaciones(datos: DatosRegistro<Cotizacion>): Observable<unknown> {
    const ids = datos.registrados ? datos.estudiantes.flatMap((e) => (e.estudianteId ? [e.estudianteId] : [])) : [];
    const estudiantes = this.injector.get(EstudiantesRepositorio);
    return (ids.length ? forkJoin(ids.map((id) => estudiantes.obtener(id))) : of<Estudiante[]>([])).pipe(
      switchMap((lista) => {
        this.registrados = new Map(lista.map((e) => [e.id, e]));
        const idsColegios = [
          ...new Set([...lista.map((e) => e.colegioId), ...datos.estudiantes.flatMap((e) => (e.colegioId ? [e.colegioId] : []))]),
        ];
        const colegios = this.injector.get(ColegiosRepositorio);
        return idsColegios.length ? forkJoin(idsColegios.map((id) => colegios.obtener(id))) : of([]);
      }),
      tap((colegios) => (this.colegios = new Map(colegios.map((c) => [c.id, c.razonSocial])))),
    );
  }

  protected override preparar(datos: DatosRegistro<Cotizacion>, idActual: string | null, registros: Cotizacion[]): DatosRegistro<Cotizacion> {
    const estudiantes = datos.estudiantes.map((e): EstudianteCotizado => {
      const registrado = datos.registrados && e.estudianteId ? this.registrados.get(e.estudianteId) : undefined;
      const colegioId = registrado?.colegioId ?? e.colegioId ?? null;
      return {
        estudianteId: registrado?.id ?? (datos.registrados ? e.estudianteId : null),
        nombre: e.nombre,
        colegioId,
        nombreColegio: colegioId ? (this.colegios.get(colegioId) ?? e.nombreColegio) : e.nombreColegio.trim(),
        valor: Math.round(e.valor),
      };
    });
    const actual = idActual ? registros.find((r) => r.id === idActual) : undefined;
    return {
      ...datos,
      estudiantes,
      ...calcularValores(estudiantes, datos.periodoInicio, datos.periodoFin),
      facturas: datos.facturas ?? actual?.facturas ?? [],
      numero: actual?.numero ?? siguienteConsecutivo('COT', registros.map((r) => r.numero)),
    };
  }

  override motivoNoEliminar(id: string): Observable<string | null> {
    return this.obtener(id).pipe(
      map((c) => (facturada(c) ? 'No se puede eliminar: ya se convirtió en facturas. Consulta las facturas generadas.' : null)),
    );
  }

  /** Como el API: una factura por estudiante; si una falla se eliminan las que alcanzaron a crearse. */
  facturar(id: string, fechaEmision: string, concepto: string): Observable<ResultadoFacturacion> {
    const facturas = this.injector.get(FacturasRepositorio);
    return this.obtener(id).pipe(
      switchMap((c) => {
        const motivo = motivoNoFacturar(c);
        if (motivo) return throwError(() => new ErrorCrud(motivo, facturada(c) ? 'DUPLICADO' : 'VALIDACION'));
        const creadas: string[] = [];
        return from(c.estudiantes).pipe(
          concatMap((e) =>
            facturas
              .crear({
                numero: '',
                fechaEmision: fechaEmision || fechaIso(),
                acudienteId: c.acudienteId!,
                estudianteId: e.estudianteId!,
                nombreAcudiente: c.nombreAcudiente,
                nombreEstudiante: e.nombre,
                valorContratacion: e.valor,
                periodoInicio: c.periodoInicio,
                periodoFin: c.periodoFin,
                concepto: concepto.trim() || 'Servicio de transporte escolar',
                estado: 'ACTIVO',
                observaciones: `Generada desde la cotización ${c.numero}.`,
                cotizacionId: c.id,
                numeroCotizacion: c.numero,
              })
              .pipe(tap((f) => creadas.push(f.id))),
          ),
          toArray(),
          catchError((error: unknown) => {
            const deshacer: Observable<unknown> = creadas.length ? forkJoin(creadas.map((f) => facturas.eliminar(f))) : of(null);
            return deshacer.pipe(switchMap(() => throwError(() => error)));
          }),
          switchMap((nuevas: Factura[]) => {
            const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = c;
            return this.actualizar(id, {
              ...datos,
              estado: 'APROBADA',
              facturas: nuevas.map((f) => ({ id: f.id, nombre: etiquetaFactura(f) })),
            }).pipe(map((cotizacion) => ({ cotizacion, facturas: nuevas })));
          }),
        );
      }),
    );
  }

  protected datosIniciales(): Cotizacion[] {
    const cotizacion = (
      id: string,
      numero: string,
      fecha: string,
      acudiente: { id: string | null; nombre: string; telefono: string },
      estudiantes: [string | null, string, string | null, string][],
      valor: number,
      estado: Cotizacion['estado'],
    ): Cotizacion => {
      // Cada estudiante con su valor (el segundo hermano con 20 000 menos), servicio de febrero a noviembre.
      const lista = estudiantes.map(([estudianteId, nombre, colegioId, nombreColegio], i) => ({
        estudianteId,
        nombre,
        colegioId,
        nombreColegio,
        valor: valor - i * 20000,
      }));
      return {
        id,
        numero,
        fecha,
        registrados: acudiente.id !== null,
        acudienteId: acudiente.id,
        nombreAcudiente: acudiente.nombre,
        telefonoAcudiente: acudiente.telefono,
        estudiantes: lista,
        periodoInicio: '2026-02',
        periodoFin: '2026-11',
        ...calcularValores(lista, '2026-02', '2026-11'),
        estado,
        observaciones: '',
        facturas: [],
        fechaCreacion: `${fecha}T09:00:00.000Z`,
        fechaActualizacion: `${fecha}T09:00:00.000Z`,
      };
    };
    return [
      cotizacion('cot-1', 'COT-0001', '2026-01-15', { id: 'acu-1', nombre: 'María Pérez López', telefono: '3001234567' },
        [['est-1', 'Juan Sebastián Pérez López', 'col-5', 'Colegio San José'], ['est-2', 'Valentina Pérez López', 'col-5', 'Colegio San José']],
        400000, 'APROBADA'),
      cotizacion('cot-2', 'COT-0002', '2026-09-22', { id: null, nombre: 'Camila Torres Ramírez', telefono: '3209988776' },
        [[null, 'Miguel Ángel Torres', 'col-5', 'Colegio San José'], [null, 'Lucía Torres', null, 'Liceo Los Andes']], 380000, 'PENDIENTE'),
      cotizacion('cot-3', 'COT-0003', '2026-10-03', { id: 'acu-6', nombre: 'Fernando Ríos Salazar', telefono: '3118765432' },
        [['est-11', 'Antonella Ríos Salazar', 'col-1', 'Colegio San Cayetano']], 360000, 'RECHAZADA'),
      cotizacion('cot-4', 'COT-0004', '2026-10-28', { id: null, nombre: 'Julián Peña Cabrera', telefono: '3014455667' },
        [[null, 'Sofía Peña', 'col-5', 'Colegio San José']], 420000, 'PENDIENTE'),
    ];
  }
}
