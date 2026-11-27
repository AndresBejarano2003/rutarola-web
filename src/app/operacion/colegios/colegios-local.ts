import { Injectable, Injector, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { GRADOS } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ErrorCrud } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { FILTROS_ESTUDIANTE_VACIOS } from 'src/app/personas/estudiantes/estudiante';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { RutasRepositorio } from '../rutas/rutas-repositorio';
import { Colegio, Curso, FILTROS_COLEGIO_VACIOS, FiltrosColegio, claveCurso, generarCursos } from './colegio';
import { ColegiosRepositorio } from './colegios-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class ColegiosLocal extends RepositorioLocal<Colegio, FiltrosColegio> implements ColegiosRepositorio {
  protected readonly clave = 'rutarola.colegios';
  protected readonly filtrosVacios = FILTROS_COLEGIO_VACIOS;
  // Perezoso: los repositorios se consultan entre sí.
  private readonly injector = inject(Injector);

  protected coincide(c: Colegio, f: FiltrosColegio): boolean {
    const texto = normalizar(f.texto);
    return (
      (!texto || normalizar(`${c.razonSocial} ${c.nit}`).includes(texto)) &&
      (!f.estado || c.estado === f.estado) &&
      (!f.jornada || c.cursos.some((x) => x.estado === 'ACTIVO' && x.jornada === f.jornada))
    );
  }

  protected etiquetaOpcion(c: Colegio): string {
    return c.razonSocial;
  }

  protected override ordenar(a: Colegio, b: Colegio): number {
    return a.razonSocial.localeCompare(b.razonSocial, 'es');
  }

  protected override validar(datos: DatosRegistro<Colegio>, idActual: string | null, registros: Colegio[]): void {
    const nit = datos.nit.split('-')[0];
    if (registros.some((r) => r.id !== idActual && r.nit.split('-')[0] === nit)) {
      throw new ErrorCrud(`Ya existe un colegio con el NIT ${datos.nit}.`, 'DUPLICADO');
    }
    const invalido = datos.cursos.find((c) => c.horaSalida <= c.horaEntrada);
    if (invalido) {
      throw new ErrorCrud(`En ${invalido.grado} (${invalido.jornada}) la hora de salida debe ser posterior a la de entrada.`, 'VALIDACION');
    }
    const claves = datos.cursos.map(claveCurso);
    if (new Set(claves).size !== claves.length) {
      throw new ErrorCrud('Cada grado puede aparecer una sola vez por jornada en los cursos.', 'VALIDACION');
    }
  }

  /** No se elimina un colegio con estudiantes o rutas. */
  override motivoNoEliminar(id: string): Observable<string | null> {
    const unico = { pagina: 1, tamano: 1 };
    return forkJoin([
      this.injector.get(EstudiantesRepositorio).listar({ ...FILTROS_ESTUDIANTE_VACIOS, colegioId: id }, unico),
      this.injector.get(RutasRepositorio).opciones({ colegioId: id }),
    ]).pipe(
      map(([estudiantes, rutas]) => {
        const usos = [
          estudiantes.total ? `${estudiantes.total} estudiante(s)` : '',
          rutas.length ? `${rutas.length} ruta(s)` : '',
        ].filter(Boolean);
        return usos.length
          ? `No se puede eliminar: el colegio tiene ${usos.join(' y ')}. Reasígnalos o cambia el colegio a Inactivo.`
          : null;
      }),
    );
  }

  protected datosIniciales(): Colegio[] {
    const ultimo = GRADOS[GRADOS.length - 1].id;
    const cursos = (jornada: string, entrada: string, salida: string, desde = GRADOS[0].id, hasta = ultimo): Curso[] =>
      generarCursos([], hasta, entrada, salida, jornada, desde);
    const colegio = (id: string, nit: string, razonSocial: string, direccion: string, telefono: string, cursos: Curso[]) => ({
      id,
      nit,
      razonSocial,
      direccion,
      telefono,
      cursos,
      estado: 'ACTIVO' as const,
      fechaCreacion: '2026-01-05T08:00:00.000Z',
      fechaActualizacion: '2026-01-05T08:00:00.000Z',
    });
    // Los ids coinciden con los `colegioId` de los estudiantes de ejemplo.
    return [
      colegio('col-1', '891180123-4', 'Colegio San Cayetano', 'Carrera 7 # 72-40, Bogotá', '6017712345', [
        ...cursos('Mañana', '06:30', '13:00'),
        ...cursos('Tarde', '12:30', '18:00', '1°'),
      ]),
      colegio('col-2', '891180234-5', 'Colegio Matre Paula', 'Calle 45 # 13-15, Bogotá', '6017723456', [
        ...cursos('Mañana', '06:45', '12:45', GRADOS[0].id, '5°'),
        ...cursos('Tarde', '12:30', '18:00', '6°'),
      ]),
      colegio('col-3', '891180345-6', 'Colegio Santa Fe', 'Avenida Boyacá # 63-20, Bogotá', '6017734567', cursos('Única', '07:00', '14:00')),
      colegio('col-4', '891180456-7', 'Colegio Enrique Olaya Herrera', 'Calle 26 Sur # 30-11, Bogotá', '6017745678',
        cursos('Mañana', '06:30', '12:30', GRADOS[0].id, '5°')),
      colegio('col-5', '891180567-8', 'Colegio San José', 'Carrera 19 # 134-02, Bogotá', '6017756789', cursos('Mañana', '06:20', '13:20')),
    ];
  }
}
