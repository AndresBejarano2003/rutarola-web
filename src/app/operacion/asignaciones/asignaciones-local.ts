import { Injectable, Injector, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { DatosRegistro, ErrorCrud } from 'src/app/shared/crud/crud';
import { RepositorioLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { Empleado } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_RUTA_VACIOS, Ruta, etiquetaRuta } from '../rutas/ruta';
import { RutasRepositorio } from '../rutas/rutas-repositorio';
import { documentosVencidos } from '../vehiculos/vehiculo';
import { VehiculosRepositorio } from '../vehiculos/vehiculos-repositorio';
import { Asignacion, FILTROS_ASIGNACION_VACIOS, FiltrosAsignacion, cubreFecha, seCruzan, textoHorario, textoPeriodo } from './asignacion';
import { AsignacionesRepositorio } from './asignaciones-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class AsignacionesLocal extends RepositorioLocal<Asignacion, FiltrosAsignacion> implements AsignacionesRepositorio {
  protected readonly clave = 'rutarola.asignaciones';
  protected readonly filtrosVacios = FILTROS_ASIGNACION_VACIOS;
  private readonly injector = inject(Injector);

  protected coincide(a: Asignacion, f: FiltrosAsignacion): boolean {
    return (
      (!f.rutaId || a.rutaId === f.rutaId) &&
      (!f.vehiculoId || a.vehiculoId === f.vehiculoId) &&
      (!f.empleadoId || a.conductorId === f.empleadoId || a.monitoraId === f.empleadoId) &&
      (!f.estado || a.estado === f.estado) &&
      (!f.fecha || cubreFecha(a, f.fecha))
    );
  }

  protected etiquetaOpcion(a: Asignacion): string {
    const horario = textoHorario(a);
    return horario ? `${a.rutaId} · ${a.fechaInicio} · ${horario}` : `${a.rutaId} · ${a.fechaInicio}`;
  }

  protected override ordenar(a: Asignacion, b: Asignacion): number {
    return a.estado.localeCompare(b.estado) || b.fechaInicio.localeCompare(a.fechaInicio) || (a.horaInicio ?? '').localeCompare(b.horaInicio ?? '');
  }

  protected override validar(datos: DatosRegistro<Asignacion>): void {
    if (datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
      throw new ErrorCrud('La fecha de fin no puede ser anterior a la de inicio.', 'VALIDACION');
    }
    if (!!datos.horaInicio !== !!datos.horaFin) {
      throw new ErrorCrud('Ingresa la hora de inicio y la de fin del horario (o deja las dos vacías para toda la jornada).', 'VALIDACION');
    }
    if (datos.horaInicio && datos.horaFin <= datos.horaInicio) {
      throw new ErrorCrud('La hora de fin debe ser posterior a la de inicio.', 'VALIDACION');
    }
  }

  /** Reglas que cruzan rutas, vehículos y empleados (ver `AsignacionesHttp`). */
  protected override validarRelaciones(datos: DatosRegistro<Asignacion>, idActual: string | null): Observable<unknown> {
    const empleados = this.injector.get(EmpleadosRepositorio);
    return forkJoin({
      ruta: this.injector.get(RutasRepositorio).obtener(datos.rutaId),
      rutas: this.injector.get(RutasRepositorio).listar(FILTROS_RUTA_VACIOS, SIN_PAGINAR),
      vehiculo: this.injector.get(VehiculosRepositorio).obtener(datos.vehiculoId),
      conductor: empleados.obtener(datos.conductorId),
      monitora: datos.monitoraId ? empleados.obtener(datos.monitoraId) : of(null),
    }).pipe(
      map(({ ruta, rutas, vehiculo, conductor, monitora }) => {
        const falla = (mensaje: string) => {
          throw new ErrorCrud(mensaje, 'VALIDACION');
        };
        if (conductor.tipoEmpleado !== 'CONDUCTOR') falla('El empleado elegido como conductor no es conductor.');
        if (monitora && monitora.tipoEmpleado !== 'MONITORA') falla('El empleado elegido como monitora no es monitora.');
        if (datos.estado !== 'ACTIVO') return;

        if (ruta.estado !== 'ACTIVO') falla(`La ruta ${etiquetaRuta(ruta)} está inactiva.`);
        if (vehiculo.estado !== 'ACTIVO') falla(`El vehículo ${vehiculo.placa} está inactivo.`);
        if (conductor.estado !== 'ACTIVO') falla(`${nombreCompleto(conductor)} está inactivo.`);
        if (monitora && monitora.estado !== 'ACTIVO') falla(`${nombreCompleto(monitora)} está inactiva.`);
        if (vehiculo.capacidad < ruta.estudianteIds.length) {
          falla(
            `El vehículo ${vehiculo.placa} tiene ${vehiculo.capacidad} puestos y la ruta lleva ${ruta.estudianteIds.length} estudiantes.`,
          );
        }
        const hoy = fechaIso();
        if (conductor.vencimientoLicencia && conductor.vencimientoLicencia < hoy) {
          falla(`La licencia de ${nombreCompleto(conductor)} está vencida. Actualízala en Personas › Empleados.`);
        }
        const vencidos = documentosVencidos(vehiculo, hoy);
        if (vencidos.length) falla(`El vehículo ${vehiculo.placa} tiene vencido: ${vencidos.join(', ')}.`);

        this.validarCruces(datos, idActual, ruta, rutas.items, conductor, monitora);
      }),
    );
  }

  /**
   * Ninguna otra asignación activa de la ruta se cruza en fechas y horario, y el vehículo, el conductor y la monitora
   * no están en otra asignación activa que se cruce (`ServicioAsignaciones.ValidarCrucesAsync`).
   */
  private validarCruces(
    datos: DatosRegistro<Asignacion>,
    idActual: string | null,
    ruta: Ruta,
    rutas: Ruta[],
    conductor: Empleado,
    monitora: Empleado | null,
  ): void {
    const porId = new Map(rutas.map((r) => [r.id, r]));
    const cruzadas = this.leer()
      .filter((a) => a.id !== idActual && a.estado === 'ACTIVO')
      .filter((a) => seCruzan(datos, ruta.jornada, a, porId.get(a.rutaId)?.jornada ?? ''))
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    const misma = cruzadas.find((a) => a.rutaId === datos.rutaId);
    if (misma) {
      throw new ErrorCrud(
        `La ruta ${etiquetaRuta(ruta)} ya tiene una asignación activa ${textoPeriodo(misma)} que se cruza. ` +
          'Cambia las fechas o el horario, o inactívala primero.',
        'DUPLICADO',
      );
    }
    for (const otra of cruzadas) {
      const donde = `la ruta ${etiquetaRuta(porId.get(otra.rutaId) ?? { codigo: '', nombre: otra.rutaId })} ${textoPeriodo(otra)}`;
      if (otra.vehiculoId === datos.vehiculoId) {
        throw new ErrorCrud(`El vehículo ya cubre ${donde}.`, 'DUPLICADO');
      }
      if ([otra.conductorId, otra.monitoraId].includes(datos.conductorId)) {
        throw new ErrorCrud(`${nombreCompleto(conductor)} ya está asignado a ${donde}.`, 'DUPLICADO');
      }
      if (monitora && [otra.conductorId, otra.monitoraId].includes(datos.monitoraId)) {
        throw new ErrorCrud(`${nombreCompleto(monitora)} ya está asignada a ${donde}.`, 'DUPLICADO');
      }
    }
  }

  protected datosIniciales(): Asignacion[] {
    const asignacion = (id: string, rutaId: string, vehiculoId: string, conductorId: string, monitoraId: string): Asignacion => ({
      id,
      rutaId,
      vehiculoId,
      conductorId,
      monitoraId,
      fechaInicio: '2026-02-02',
      // Indefinida (como la demo del API): los ejemplos siguen vigentes.
      fechaFin: '',
      horaInicio: '',
      horaFin: '',
      estado: 'ACTIVO',
      observaciones: '',
      fechaCreacion: '2026-01-20T08:00:00.000Z',
      fechaActualizacion: '2026-01-20T08:00:00.000Z',
    });
    // La ruta R-04 queda sin asignar a propósito.
    return [
      asignacion('asg-1', 'rut-1', 'veh-1', 'emp-1', 'emp-6'),
      asignacion('asg-2', 'rut-2', 'veh-2', 'emp-2', 'emp-7'),
      asignacion('asg-3', 'rut-3', 'veh-3', 'emp-4', 'emp-8'),
    ];
  }
}
