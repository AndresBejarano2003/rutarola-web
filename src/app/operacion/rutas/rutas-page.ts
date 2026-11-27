import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
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
import { FILTROS_RUTA_VACIOS, FiltrosRuta, Ruta, etiquetaRuta } from './ruta';
import { ColegiosRuta, EstudiantesColegio, RutaFormulario } from './ruta-formulario/ruta-formulario';
import { RutasRepositorio } from './rutas-repositorio';
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

  private readonly colegiosRepo = inject(ColegiosRepositorio);
  private readonly rutasRepo = inject(RutasRepositorio);

  /** Jornada y colegios elegidos en el formulario. */
  protected readonly filtroColegios = signal<ColegiosRuta>({ jornada: '', colegioIds: [] });
  private readonly jornada = computed(() => this.filtroColegios().jornada);

  /** Colegios con cursos en la jornada elegida. */
  protected readonly colegiosJornada = toSignal(
    toObservable(this.jornada).pipe(
      switchMap((jornada) => (jornada ? this.colegiosRepo.opciones({ jornada }).pipe(catchError(() => of([]))) : of([]))),
    ),
    { initialValue: [] },
  );

  /** Estudiantes ya cargados por `colegio|jornada`. */
  private readonly cacheEstudiantes = signal<ReadonlyMap<string, EstudiantesColegio>>(new Map());
  protected readonly estudiantesColegios = computed(() => {
    const { jornada, colegioIds } = this.filtroColegios();
    const cache = this.cacheEstudiantes();
    const mapa = new Map<string, EstudiantesColegio>();
    for (const id of colegioIds) {
      const datos = cache.get(`${id}|${jornada}`);
      if (datos) mapa.set(id, datos);
    }
    return mapa;
  });

  /** Al agregar un colegio se vuelven a consultar sus estudiantes (pudieron cambiar de jornada o estado mientras tanto). */
  protected olvidarEstudiantes(colegioId: string): void {
    this.cacheEstudiantes.update((cache) => new Map([...cache].filter(([clave]) => !clave.startsWith(`${colegioId}|`))));
  }

  /** Estudiantes en OTRA ruta activa de la jornada (no se precargan). */
  private readonly rutasJornada = toSignal(
    // Se vuelve a pedir al cambiar la jornada y cada vez que la lista se recarga (p. ej. tras guardar).
    toObservable(computed(() => ({ jornada: this.jornada(), lista: this.store.items() }))).pipe(
      switchMap(({ jornada }) =>
        jornada
          ? this.rutasRepo.listar({ ...FILTROS_RUTA_VACIOS, jornada, estado: 'ACTIVO' }, SIN_PAGINAR).pipe(
              map(({ items }) => items),
              catchError(() => of([] as Ruta[])),
            )
          : of([] as Ruta[]),
      ),
    ),
    { initialValue: [] as Ruta[] },
  );
  protected readonly ocupados = computed(() => {
    const actual = this.seleccionado()?.id;
    const mapa = new Map<string, string>();
    for (const r of this.rutasJornada()) {
      if (r.id === actual) continue;
      for (const id of r.estudianteIds) mapa.set(id, r.codigo);
    }
    return mapa;
  });

  constructor() {
    super();
    toObservable(this.filtroColegios)
      .pipe(
        switchMap(({ jornada, colegioIds }) => {
          const cache = this.cacheEstudiantes();
          const faltan = jornada ? colegioIds.filter((id) => !cache.has(`${id}|${jornada}`)) : [];
          if (!faltan.length) return of([]);
          return forkJoin(
            faltan.map((colegioId) =>
              forkJoin({
                jornada: this.estudiantesRepo.opciones({ colegioId, jornada, estado: 'ACTIVO' }),
                todos: this.estudiantesRepo.opciones({ colegioId }),
              }).pipe(
                catchError(() => of({ jornada: [], todos: [] })),
                map((datos) => ({ clave: `${colegioId}|${jornada}`, datos })),
              ),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((cargados) => {
        if (!cargados.length) return;
        this.cacheEstudiantes.update((cache) => {
          const copia = new Map(cache);
          for (const { clave, datos } of cargados) copia.set(clave, datos);
          return copia;
        });
      });
  }

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
