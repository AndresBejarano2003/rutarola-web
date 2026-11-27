import { Injectable } from '@angular/core';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { Colegio, FiltrosColegio } from './colegio';
import { ColegiosRepositorio } from './colegios-repositorio';

/**
 * Conexión al API: `{apiUrl}/colegios` (filtros `texto`, `estado`, `jornada` = con algún curso activo en ella).
 * Los cursos viajan dentro del colegio (`cursos: Curso[]`).
 * Reglas del API: NIT único (409); `DELETE` responde 409 si el colegio
 * tiene estudiantes o rutas.
 */
@Injectable()
export class ColegiosHttp extends RepositorioHttp<Colegio, FiltrosColegio> implements ColegiosRepositorio {
  protected readonly recurso = 'colegios';
}
