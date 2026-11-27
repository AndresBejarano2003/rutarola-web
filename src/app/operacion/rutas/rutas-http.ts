import { Injectable } from '@angular/core';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { FiltrosRuta, Ruta } from './ruta';
import { RutasRepositorio } from './rutas-repositorio';

/**
 * Conexión al API: `{apiUrl}/rutas` (filtros `texto`, `colegioId` = rutas que
 * atienden ese colegio, `jornada`, `estado`, `estudianteId`).
 * Reglas del API: el código lo asigna el servidor al crear (`R-01`, `R-02`…,
 * el que se envíe se ignora y no cambia al editar); `colegioIds` (uno o varios,
 * sin repetir: 400) y estudiantes deben existir (404); cada colegio nuevo debe
 * tener cursos activos en la jornada (422); los estudiantes deben ser de esos
 * colegios y de la jornada de la ruta (422; los que ya iban se conservan); un
 * estudiante solo puede estar en una ruta activa por jornada (422);
 * `estudianteIds` es el orden de recogida: si cambia, los recorridos EN CURSO
 * reordenan lo que les falta y el personal recibe `recorridoActualizado`.
 * La respuesta trae también `colegioId` (el primero) para versiones anteriores.
 * `DELETE` responde 409 si la ruta tiene asignaciones.
 */
@Injectable()
export class RutasHttp extends RepositorioHttp<Ruta, FiltrosRuta> implements RutasRepositorio {
  protected readonly recurso = 'rutas';
}
