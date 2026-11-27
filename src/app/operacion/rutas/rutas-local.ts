import { Injectable, Injector, inject } from '@angular/core';
import { Observable, forkJoin, map, of, tap } from 'rxjs';
import { DatosRegistro, ErrorCrud, siguienteConsecutivo } from 'src/app/shared/crud/crud';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { FILTROS_ESTUDIANTE_VACIOS } from 'src/app/personas/estudiantes/estudiante';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { RecorridosRepositorio } from 'src/app/ruta-del-dia/recorridos-repositorio';
import { RecorridosLocal } from 'src/app/ruta-del-dia/recorridos-local';
import { AuthService } from 'src/app/core/auth';
import { FILTROS_COLEGIO_VACIOS } from '../colegios/colegio';
import { ColegiosRepositorio } from '../colegios/colegios-repositorio';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { FILTROS_ASIGNACION_VACIOS } from '../asignaciones/asignacion';
import { AsignacionesRepositorio } from '../asignaciones/asignaciones-repositorio';
import { FILTROS_RUTA_VACIOS, FiltrosRuta, PREFIJO_CODIGO_RUTA, Ruta, conColegios, etiquetaRuta } from './ruta';
import { RutasRepositorio } from './rutas-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class RutasLocal extends RepositorioLocal<Ruta, FiltrosRuta> implements RutasRepositorio {
  protected readonly clave = 'rutarola.rutas';
  protected readonly filtrosVacios = FILTROS_RUTA_VACIOS;
  private readonly injector = inject(Injector);

  protected coincide(r: Ruta, f: FiltrosRuta): boolean {
    const texto = normalizar(f.texto);
    return (
      (!texto || normalizar(`${r.codigo} ${r.nombre} ${r.sector}`).includes(texto)) &&
      (!f.colegioId || r.colegioIds.includes(f.colegioId)) &&
      (!f.jornada || r.jornada === f.jornada) &&
      (!f.estado || r.estado === f.estado) &&
      (!f.estudianteId || r.estudianteIds.includes(f.estudianteId))
    );
  }

  protected etiquetaOpcion(r: Ruta): string {
    return etiquetaRuta(r);
  }

  protected override ordenar(a: Ruta, b: Ruta): number {
    return a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
  }

  /** El código es un consecutivo del sistema (`R-01`, `R-02`…) que no cambia al editar. */
  protected override preparar(datos: DatosRegistro<Ruta>, idActual: string | null, registros: Ruta[]): DatosRegistro<Ruta> {
    const actual = registros.find((r) => r.id === idActual);
    return actual
      ? { ...datos, codigo: actual.codigo }
      : { ...datos, codigo: siguienteConsecutivo(PREFIJO_CODIGO_RUTA, registros.map((r) => r.codigo), 2) };
  }

  /** Rutas guardadas antes de que admitieran varios colegios. */
  protected override leer(): Ruta[] {
    const registros = super.leer();
    return registros.some((r) => !Array.isArray(r.colegioIds)) ? registros.map(conColegios) : registros;
  }

  /** Los estudiantes deben ser de los colegios de la ruta (mismo mensaje del API). */
  protected override validarRelaciones(datos: DatosRegistro<Ruta>): Observable<unknown> {
    if (!datos.estudianteIds.length) return of(null);
    return forkJoin([
      this.injector.get(EstudiantesRepositorio).listar(FILTROS_ESTUDIANTE_VACIOS, SIN_PAGINAR),
      this.injector.get(ColegiosRepositorio).listar(FILTROS_COLEGIO_VACIOS, SIN_PAGINAR),
    ]).pipe(
      tap(([{ items: estudiantes }, { items: colegios }]) => {
        const deLaRuta = estudiantes.filter((e) => datos.estudianteIds.includes(e.id));
        if (deLaRuta.some((e) => !datos.colegioIds.includes(e.colegioId))) {
          const nombres = datos.colegioIds.map((id) => colegios.find((c) => c.id === id)?.razonSocial ?? '');
          throw new ErrorCrud(
            nombres.length === 1
              ? `Todos los estudiantes de la ruta deben ser del ${nombres[0]}.`
              : `Todos los estudiantes de la ruta deben ser de sus colegios: ${nombres.join(', ')}.`,
            'VALIDACION',
          );
        }
      }),
    );
  }

  /** Si cambió el orden de recogida, los recorridos en curso de la ruta reordenan lo que falta (como el API). */
  override actualizar(id: string, datos: DatosRegistro<Ruta>): Observable<Ruta> {
    const antes = this.leer().find((r) => r.id === id)?.estudianteIds ?? [];
    return super.actualizar(id, datos).pipe(
      tap((ruta) => {
        if (antes.join() === ruta.estudianteIds.join()) return;
        const recorridos = this.injector.get(RecorridosRepositorio);
        const nombre = this.injector.get(AuthService).sesion()?.nombre;
        if (recorridos instanceof RecorridosLocal) recorridos.aplicarOrdenDeRuta(ruta.id, ruta.estudianteIds, nombre ? `${nombre} (administrador)` : 'El administrador');
      }),
    );
  }

  protected override validar(datos: DatosRegistro<Ruta>, idActual: string | null, registros: Ruta[]): void {
    if (!datos.colegioIds.length) throw new ErrorCrud('Agrega al menos un colegio a la ruta.', 'VALIDACION');
    if (new Set(datos.colegioIds).size !== datos.colegioIds.length) throw new ErrorCrud('Un colegio aparece dos veces en la ruta.', 'VALIDACION');
    const otras = registros.filter((r) => r.id !== idActual);
    if (datos.estado === 'ACTIVO') {
      // Un estudiante no puede estar en dos rutas activas de la misma jornada.
      const choque = otras.find(
        (r) => r.estado === 'ACTIVO' && r.jornada === datos.jornada && r.estudianteIds.some((id) => datos.estudianteIds.includes(id)),
      );
      if (choque) {
        throw new ErrorCrud(
          `Uno o más estudiantes ya están en la ruta ${etiquetaRuta(choque)} (jornada ${choque.jornada}). Quítalos de esa ruta primero.`,
          'VALIDACION',
        );
      }
    }
  }

  override motivoNoEliminar(id: string): Observable<string | null> {
    return this.injector
      .get(AsignacionesRepositorio)
      .listar({ ...FILTROS_ASIGNACION_VACIOS, rutaId: id }, { pagina: 1, tamano: 1 })
      .pipe(
        map(({ total }) =>
          total ? `No se puede eliminar: la ruta tiene ${total} asignación(es) de vehículo y conductor. Cámbiala a Inactiva.` : null,
        ),
      );
  }

  protected datosIniciales(): Ruta[] {
    const ruta = (id: string, codigo: string, nombre: string, colegioIds: string[], jornada: string, sector: string, estudianteIds: string[]): Ruta => ({
      id,
      codigo,
      nombre,
      colegioIds,
      jornada,
      sector,
      estudianteIds,
      estado: 'ACTIVO',
      observaciones: '',
      fechaCreacion: '2026-01-12T08:00:00.000Z',
      fechaActualizacion: '2026-01-12T08:00:00.000Z',
    });
    // Ids coherentes con colegios y estudiantes de ejemplo.
    return [
      ruta('rut-1', 'R-01', 'Norte', ['col-5'], 'Mañana', 'Cedritos, Usaquén, Santa Bárbara', ['est-1', 'est-2']),
      ruta('rut-2', 'R-02', 'Centro', ['col-1'], 'Mañana', 'La Candelaria, Teusaquillo, Chapinero', ['est-3', 'est-12']),
      ruta('rut-3', 'R-03', 'Sur', ['col-2'], 'Tarde', 'Kennedy, Tunjuelito, Bosa', ['est-4', 'est-5']),
      ruta('rut-4', 'R-04', 'Oriente', ['col-3'], 'Única', 'San Cristóbal, Santa Ana, La Perseverancia', ['est-6', 'est-7']),
    ];
  }
}
