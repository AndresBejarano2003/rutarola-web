import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { aMapa } from 'src/app/shared/catalogos/catalogos';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { FILTROS_ASIGNACION_VACIOS, asignacionVigente } from '../asignaciones/asignacion';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { AsignacionesRepositorio } from '../asignaciones/asignaciones-repositorio';
import { ColegiosRepositorio } from '../colegios/colegios-repositorio';
import { VehiculosRepositorio } from '../vehiculos/vehiculos-repositorio';
import { FiltrosRuta, Ruta, etiquetaRuta } from './ruta';
import { RutaFormulario } from './ruta-formulario/ruta-formulario';
import { RutasFiltros } from './rutas-filtros/rutas-filtros';
import { RutasStore } from './rutas-store';
import { RutasTabla } from './rutas-tabla/rutas-tabla';

@Component({
  selector: 'app-rutas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RutasFiltros, RutasTabla, RutaFormulario, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [RutasStore],
  templateUrl: './rutas-page.html',
})
export default class RutasPage extends PaginaCrud<Ruta, FiltrosRuta> {
  protected readonly store = inject(RutasStore);
  protected readonly titulos = { crear: 'Nueva ruta', editar: 'Editar ruta', consultar: 'Detalle de la ruta' };

  private readonly estudiantesRepo = inject(EstudiantesRepositorio);

  protected readonly colegios = toSignal(inject(ColegiosRepositorio).opciones().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly nombresColegio = computed(() => aMapa(this.colegios()));

  /** Colegio y jornada elegidos en el formulario. */
  protected readonly filtroEstudiantes = signal({ colegioId: '', jornada: '' });
  /** Todos los estudiantes del colegio (nombres de los que ya iban en la ruta). */
  protected readonly estudiantesColegio = toSignal(
    toObservable(computed(() => this.filtroEstudiantes().colegioId)).pipe(
      switchMap((colegioId) =>
        colegioId ? this.estudiantesRepo.opciones({ colegioId }).pipe(catchError(() => of([]))) : of([]),
      ),
    ),
    { initialValue: [] },
  );
  /** Los que se pueden agregar: del colegio y la jornada de la ruta. */
  protected readonly estudiantesJornada = toSignal(
    toObservable(this.filtroEstudiantes).pipe(
      switchMap(({ colegioId, jornada }) =>
        colegioId && jornada ? this.estudiantesRepo.opciones({ colegioId, jornada }).pipe(catchError(() => of([]))) : of([]),
      ),
    ),
    { initialValue: [] },
  );

  /** rutaId → "placa · conductor" de la asignación activa (columna Asignación). */
  protected readonly asignaciones = toSignal(
    forkJoin([
      inject(AsignacionesRepositorio).listar({ ...FILTROS_ASIGNACION_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
      inject(VehiculosRepositorio).opciones(),
      inject(EmpleadosRepositorio).opciones({ tipoEmpleado: 'CONDUCTOR' }),
    ]).pipe(
      map(([{ items }, vehiculos, conductores]) => {
        const placas = new Map(vehiculos.map((v) => [v.id, v.nombre.split(' · ')[0]]));
        const nombres = aMapa(conductores);
        // La que cubre hoy (o la próxima); si la ruta tiene más asignaciones activas (otras semanas u horarios), se indica.
        const hoy = fechaIso();
        const vigentes = items.filter((a) => !a.fechaFin || a.fechaFin >= hoy);
        const etiquetas = new Map<string, string>();
        for (const rutaId of new Set(vigentes.map((a) => a.rutaId))) {
          const deLaRuta = vigentes.filter((a) => a.rutaId === rutaId);
          const a =
            asignacionVigente(deLaRuta, rutaId, hoy, new Date().toTimeString().slice(0, 5)) ??
            [...deLaRuta].sort((x, y) => x.fechaInicio.localeCompare(y.fechaInicio))[0];
          const otras = deLaRuta.length - 1;
          etiquetas.set(
            rutaId,
            `${placas.get(a.vehiculoId) ?? '—'} · ${nombres.get(a.conductorId) ?? '—'}${otras ? ` (+${otras} más)` : ''}`,
          );
        }
        return etiquetas;
      }),
      catchError(() => of(new Map<string, string>())),
    ),
    { initialValue: new Map<string, string>() },
  );

  protected describir(ruta: Ruta): string {
    return `la ruta ${etiquetaRuta(ruta)}`;
  }
}
