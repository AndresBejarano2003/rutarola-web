import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, defer, distinctUntilChanged, filter, forkJoin, fromEvent, interval, map, merge, switchMap } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { Asignacion, FILTROS_ASIGNACION_VACIOS } from 'src/app/operacion/asignaciones/asignacion';
import { AsignacionesRepositorio } from 'src/app/operacion/asignaciones/asignaciones-repositorio';
import { FILTROS_COLEGIO_VACIOS } from 'src/app/operacion/colegios/colegio';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { FILTROS_RUTA_VACIOS, etiquetaRuta } from 'src/app/operacion/rutas/ruta';
import { RutasRepositorio } from 'src/app/operacion/rutas/rutas-repositorio';
import { FILTROS_VEHICULO_VACIOS } from 'src/app/operacion/vehiculos/vehiculo';
import { VehiculosRepositorio } from 'src/app/operacion/vehiculos/vehiculos-repositorio';
import { FILTROS_ACUDIENTE_VACIOS } from 'src/app/personas/acudientes/acudiente';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { Estudiante, FILTROS_ESTUDIANTE_VACIOS } from 'src/app/personas/estudiantes/estudiante';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { GRADOS } from 'src/app/shared/catalogos/catalogos';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, SIN_PAGINAR, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import {
  EstadoParada,
  MotivoAusencia,
  Parada,
  Recorrido,
  RutaAsignada,
  TRAYECTOS,
  Trayecto,
  cambiarEstado,
  motivoNoFinalizar,
  ordenarParadas,
  puedeReordenar,
  reordenarParadas,
  resumirRecorrido,
} from './recorrido';
import { INTERVALO_SINCRONIZACION_MS } from './recorridos-http';
import { RecorridosRepositorio } from './recorridos-repositorio';

/** ¿La asignación cubre la fecha? (`fechaFin` vacía = indefinida). */
export function vigenteEn(a: Pick<Asignacion, 'estado' | 'fechaInicio' | 'fechaFin'>, fecha: string): boolean {
  return a.estado === 'ACTIVO' && a.fechaInicio <= fecha && (!a.fechaFin || fecha <= a.fechaFin);
}

/** Clave de `localStorage` de los recorridos (la lee también el historial administrativo). */
export const CLAVE_RECORRIDOS = 'rutarola.recorridos';

const ORDEN_JORNADA = ['Mañana', 'Única', 'Tarde', 'Noche'];

/**
 * Almacenamiento TEMPORAL en `localStorage` (`rutarola.recorridos`). Arma la ruta del día
 * cruzando asignaciones, rutas, colegios, vehículos, empleados, estudiantes y acudientes,
 * como lo hará el API (ver reglas en `RecorridosHttp`). El empleado sale de la sesión.
 */
@Injectable()
export class RecorridosLocal extends RecorridosRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly clave = CLAVE_RECORRIDOS;
  private readonly auth = inject(AuthService);
  private readonly latenciaMs = inject(LATENCIA_LOCAL);
  private readonly asignaciones = inject(AsignacionesRepositorio);
  private readonly rutas = inject(RutasRepositorio);
  private readonly colegios = inject(ColegiosRepositorio);
  private readonly vehiculos = inject(VehiculosRepositorio);
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly estudiantes = inject(EstudiantesRepositorio);
  private readonly acudientes = inject(AcudientesRepositorio);

  rutasDelDia(fecha: string): Observable<RutaAsignada[]> {
    return defer(() => {
      const empleadoId = this.empleadoId();
      return this.operacion().pipe(
        map(({ asignaciones, rutas, colegios, vehiculos, empleados }) => {
          const recorridos = this.leer().filter((r) => r.fecha === fecha);
          return asignaciones
            .filter((a) => vigenteEn(a, fecha) && (a.conductorId === empleadoId || a.monitoraId === empleadoId))
            .flatMap((a): RutaAsignada[] => {
              const ruta = rutas.get(a.rutaId);
              if (!ruta || ruta.estado !== 'ACTIVO') return [];
              const colegio = colegios.get(ruta.colegioId);
              const rol = a.conductorId === empleadoId ? 'CONDUCTOR' : 'MONITORA';
              const otro = empleados.get(rol === 'CONDUCTOR' ? a.monitoraId : a.conductorId);
              return [
                {
                  asignacionId: a.id,
                  rutaId: ruta.id,
                  ruta: etiquetaRuta(ruta),
                  jornada: ruta.jornada,
                  sector: ruta.sector,
                  colegio: colegio?.razonSocial ?? '',
                  direccionColegio: colegio?.direccion ?? '',
                  vehiculo: vehiculos.get(a.vehiculoId)?.placa ?? '',
                  rol,
                  companero: otro
                    ? { nombre: nombreCompleto(otro), telefono: otro.telefono, rol: otro.tipoEmpleado }
                    : null,
                  estudiantes: ruta.estudianteIds.length,
                  recorridos: recorridos
                    .filter((r) => r.asignacionId === a.id)
                    .sort((x, y) => TRAYECTOS.findIndex((t) => t.id === x.trayecto) - TRAYECTOS.findIndex((t) => t.id === y.trayecto))
                    .map(resumirRecorrido),
                },
              ];
            })
            .sort((x, y) => ORDEN_JORNADA.indexOf(x.jornada) - ORDEN_JORNADA.indexOf(y.jornada) || x.ruta.localeCompare(y.ruta));
        }),
      );
    });
  }

  observarRutasDelDia(fecha: string): Observable<RutaAsignada[]> {
    return this.cambios().pipe(
      switchMap(() => this.rutasDelDia(fecha).pipe(catchError(() => EMPTY))),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    );
  }

  obtener(id: string): Observable<Recorrido> {
    return defer(() => {
      const empleadoId = this.empleadoId();
      return responderLocal(() => this.buscar(this.leer(), id, empleadoId), this.latenciaMs);
    });
  }

  iniciar(asignacionId: string, trayecto: Trayecto): Observable<Recorrido> {
    return defer(() => {
      const empleadoId = this.empleadoId();
      const fecha = fechaIso();
      return this.rutasDelDia(fecha).pipe(
        switchMap((rutasHoy) => {
          const asignada = rutasHoy.find((r) => r.asignacionId === asignacionId);
          if (!asignada) {
            throw new ErrorCrud('Esta ruta no está asignada a ti para hoy. Consulta con el administrador.', 'VALIDACION');
          }
          // El compañero ya lo inició: se une al mismo recorrido (no se crea otro ni es un error).
          const existente = this.leer().find((r) => r.asignacionId === asignacionId && r.fecha === fecha && r.trayecto === trayecto);
          if (existente) return responderLocal(() => existente, this.latenciaMs);
          // Solo cuenta el de HOY: uno que quedó abierto otro día ya no aparece en la Ruta del día y no debe bloquearla.
          if (this.leer().some((r) => r.asignacionId === asignacionId && r.fecha === fecha && r.estado === 'EN_CURSO')) {
            throw new ErrorCrud(`Hay un recorrido en curso en ${asignada.ruta}. Finalízalo antes de iniciar otro.`, 'DUPLICADO');
          }
          return forkJoin({
            asignacion: this.asignaciones.obtener(asignacionId),
            ruta: this.rutas.obtener(asignada.rutaId),
            estudiantes: this.estudiantes.listar(FILTROS_ESTUDIANTE_VACIOS, SIN_PAGINAR),
            acudientes: this.acudientes.listar(FILTROS_ACUDIENTE_VACIOS, SIN_PAGINAR),
            empleados: this.empleados.listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR),
          }).pipe(
            switchMap(({ asignacion, ruta, estudiantes, acudientes, empleados }) => {
              const estudiantePorId = new Map(estudiantes.items.map((e) => [e.id, e]));
              const acudientePorId = new Map(acudientes.items.map((a) => [a.id, a]));
              const empleadoPorId = new Map(empleados.items.map((e) => [e.id, e]));
              const enRuta = ruta.estudianteIds
                .map((id) => estudiantePorId.get(id))
                .filter((e): e is Estudiante => e !== undefined && e.estado === 'ACTIVO');
              if (!enRuta.length) {
                throw new ErrorCrud(`${asignada.ruta} no tiene estudiantes activos.`, 'VALIDACION');
              }
              const paradas = ordenarParadas(enRuta, trayecto).map((e): Parada => {
                const acudiente = acudientePorId.get(e.acudienteId);
                return {
                  estudianteId: e.id,
                  estudiante: nombreCompleto(e),
                  grado: GRADOS.find((g) => g.id === e.grado)?.nombre ?? e.grado,
                  direccion: e.direccion,
                  acudiente: acudiente ? nombreCompleto(acudiente) : '',
                  telefonoAcudiente: acudiente?.telefono ?? '',
                  estado: 'PENDIENTE',
                  horaAbordo: null,
                  horaEntrega: null,
                  motivoAusencia: '',
                };
              });
              // Quien en la recogida de hoy quedó "No asiste hoy" no está en el colegio: la entrega lo trae ausente.
              const recogida = this.leer().find((r) => r.asignacionId === asignacionId && r.fecha === fecha && r.trayecto === 'RECOGIDA');
              const noAsisten = new Set(
                trayecto === 'ENTREGA'
                  ? (recogida?.paradas ?? []).filter((p) => p.estado === 'AUSENTE' && p.motivoAusencia === 'NO_ASISTE').map((p) => p.estudianteId)
                  : [],
              );
              for (const p of paradas) {
                if (noAsisten.has(p.estudianteId)) Object.assign(p, { estado: 'AUSENTE', motivoAusencia: 'NO_ASISTE' });
              }
              const conductor = empleadoPorId.get(asignacion.conductorId);
              const monitora = empleadoPorId.get(asignacion.monitoraId);
              const ahora = new Date().toISOString();
              const nuevo: Recorrido = {
                id: crypto.randomUUID(),
                asignacionId,
                rutaId: ruta.id,
                fecha,
                trayecto,
                estado: 'EN_CURSO',
                ruta: asignada.ruta,
                jornada: asignada.jornada,
                colegio: asignada.colegio,
                direccionColegio: asignada.direccionColegio,
                vehiculo: asignada.vehiculo,
                conductorId: asignacion.conductorId,
                conductor: conductor ? nombreCompleto(conductor) : '',
                monitoraId: asignacion.monitoraId,
                monitora: monitora ? nombreCompleto(monitora) : '',
                paradas,
                inicio: ahora,
                fin: null,
                iniciadoPor: empleadoId,
                observaciones: '',
                fechaCreacion: ahora,
                fechaActualizacion: ahora,
              };
              return responderLocal(() => {
                this.escribir([nuevo, ...this.leer()]);
                return nuevo;
              }, this.latenciaMs);
            }),
          );
        }),
      );
    });
  }

  marcar(id: string, estudianteIds: string[], estado: EstadoParada, motivo?: MotivoAusencia): Observable<Recorrido> {
    return this.modificar(id, (r) => {
      if (motivo === 'NO_ASISTE' && r.trayecto !== 'RECOGIDA') {
        throw new ErrorCrud('"No asiste hoy" se marca en la recogida. En la entrega usa "No viaja".', 'VALIDACION');
      }
      const ahora = new Date().toISOString();
      const ids = new Set(estudianteIds);
      if (!r.paradas.some((p) => ids.has(p.estudianteId))) {
        throw new ErrorCrud('El estudiante no hace parte de este recorrido.', 'NO_ENCONTRADO');
      }
      try {
        return { ...r, paradas: r.paradas.map((p) => (ids.has(p.estudianteId) ? cambiarEstado(p, estado, ahora, motivo ?? '') : p)) };
      } catch (error) {
        throw new ErrorCrud((error as Error).message, 'VALIDACION');
      }
    });
  }

  reordenar(id: string, estudianteIds: string[]): Observable<Recorrido> {
    return this.modificar(id, (r, empleadoId) => {
      if (!puedeReordenar(r, empleadoId)) {
        throw new ErrorCrud(
          r.monitoraId ? 'Solo la monitora puede cambiar el orden de los estudiantes.' : 'Solo el conductor puede cambiar el orden de los estudiantes.',
          'VALIDACION',
        );
      }
      try {
        const paradas = reordenarParadas(r, estudianteIds);
        const nombre = this.auth.sesion()?.nombre ?? '';
        return { ...r, paradas, ordenActualizado: { empleadoId, nombre, hora: new Date().toISOString() } };
      } catch (error) {
        throw new ErrorCrud((error as Error).message, 'DUPLICADO');
      }
    });
  }

  /**
   * En modo local el "otro dispositivo" es otra pestaña del navegador: el evento `storage` avisa al
   * instante; además se consulta cada `INTERVALO_SINCRONIZACION_MS` (`RecorridosHttp` usa el hub).
   */
  observar(id: string): Observable<Recorrido> {
    return this.cambios().pipe(
      // Un fallo puntual (sin red) no corta la sincronización: se reintenta en el siguiente aviso.
      switchMap(() => this.obtener(id).pipe(catchError(() => EMPTY))),
      distinctUntilChanged((a, b) => a.fechaActualizacion === b.fechaActualizacion),
    );
  }

  /** Avisos de cambio: otra pestaña escribió los recorridos (al instante) o pasó el intervalo de consulta. */
  private cambios(): Observable<unknown> {
    const otraPestana = fromEvent<StorageEvent>(window, 'storage').pipe(filter((e) => e.key === this.clave));
    return merge(otraPestana, interval(INTERVALO_SINCRONIZACION_MS));
  }

  finalizar(id: string, observaciones: string): Observable<Recorrido> {
    return this.modificar(id, (r) => {
      const motivo = motivoNoFinalizar(r.paradas);
      if (motivo) throw new ErrorCrud(motivo, 'VALIDACION');
      return { ...r, estado: 'FINALIZADO', fin: new Date().toISOString(), observaciones: observaciones.trim() };
    });
  }

  /** Cambia un recorrido EN CURSO del empleado autenticado. */
  private modificar(id: string, cambio: (r: Recorrido, empleadoId: string) => Recorrido): Observable<Recorrido> {
    return defer(() => {
      const empleadoId = this.empleadoId();
      return responderLocal(() => {
        const registros = this.leer();
        const actual = this.buscar(registros, id, empleadoId);
        if (actual.estado !== 'EN_CURSO') {
          throw new ErrorCrud('Este recorrido ya fue finalizado y no se puede modificar.', 'VALIDACION');
        }
        const actualizado = { ...cambio(actual, empleadoId), fechaActualizacion: new Date().toISOString() };
        this.escribir(registros.map((r) => (r.id === id ? actualizado : r)));
        return actualizado;
      }, this.latenciaMs);
    });
  }

  private empleadoId(): string {
    const id = this.auth.sesion()?.empleadoId;
    if (!id) throw new ErrorCrud('Inicia sesión como conductor o monitora para ver tu ruta.', 'VALIDACION');
    return id;
  }

  private buscar(registros: Recorrido[], id: string, empleadoId: string): Recorrido {
    const r = registros.find((x) => x.id === id && (x.conductorId === empleadoId || x.monitoraId === empleadoId));
    if (!r) throw new ErrorCrud('El recorrido no existe o no pertenece a tus rutas.', 'NO_ENCONTRADO');
    return r;
  }

  private operacion() {
    const porId = <T extends { id: string }>(items: T[]) => new Map(items.map((x) => [x.id, x]));
    return forkJoin({
      asignaciones: this.asignaciones.listar({ ...FILTROS_ASIGNACION_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
      rutas: this.rutas.listar(FILTROS_RUTA_VACIOS, SIN_PAGINAR),
      colegios: this.colegios.listar(FILTROS_COLEGIO_VACIOS, SIN_PAGINAR),
      vehiculos: this.vehiculos.listar(FILTROS_VEHICULO_VACIOS, SIN_PAGINAR),
      empleados: this.empleados.listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR),
    }).pipe(
      map((d) => ({
        asignaciones: d.asignaciones.items,
        rutas: porId(d.rutas.items),
        colegios: porId(d.colegios.items),
        vehiculos: porId(d.vehiculos.items),
        empleados: porId(d.empleados.items),
      })),
    );
  }

  private leer(): Recorrido[] {
    try {
      return JSON.parse(localStorage.getItem(this.clave) ?? '[]') as Recorrido[];
    } catch {
      return [];
    }
  }

  private escribir(registros: Recorrido[]): void {
    try {
      localStorage.setItem(this.clave, JSON.stringify(registros));
    } catch {
      throw new ErrorCrud('No hay espacio en el almacenamiento temporal del navegador.', 'SIN_ESPACIO');
    }
  }
}
