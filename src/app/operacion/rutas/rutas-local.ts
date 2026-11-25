import { Injectable, Injector, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DatosRegistro, ErrorCrud, siguienteConsecutivo } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { FILTROS_ASIGNACION_VACIOS } from '../asignaciones/asignacion';
import { AsignacionesRepositorio } from '../asignaciones/asignaciones-repositorio';
import { FILTROS_RUTA_VACIOS, FiltrosRuta, PREFIJO_CODIGO_RUTA, Ruta, etiquetaRuta } from './ruta';
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
      (!f.colegioId || r.colegioId === f.colegioId) &&
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

  protected override validar(datos: DatosRegistro<Ruta>, idActual: string | null, registros: Ruta[]): void {
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
    const ruta = (id: string, codigo: string, nombre: string, colegioId: string, jornada: string, sector: string, estudianteIds: string[]): Ruta => ({
      id,
      codigo,
      nombre,
      colegioId,
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
      ruta('rut-1', 'R-01', 'Norte', 'col-5', 'Mañana', 'Cedritos, Usaquén, Santa Bárbara', ['est-1', 'est-2']),
      ruta('rut-2', 'R-02', 'Centro', 'col-1', 'Mañana', 'La Candelaria, Teusaquillo, Chapinero', ['est-3', 'est-12']),
      ruta('rut-3', 'R-03', 'Sur', 'col-2', 'Tarde', 'Kennedy, Tunjuelito, Bosa', ['est-4', 'est-5']),
      ruta('rut-4', 'R-04', 'Oriente', 'col-3', 'Única', 'San Cristóbal, Santa Ana, La Perseverancia', ['est-6', 'est-7']),
    ];
  }
}
