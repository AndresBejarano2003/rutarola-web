import { Injectable } from '@angular/core';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { Asignacion, FiltrosAsignacion } from './asignacion';
import { AsignacionesRepositorio } from './asignaciones-repositorio';

/**
 * Conexión al API: `{apiUrl}/asignaciones` (filtros `rutaId`, `vehiculoId`,
 * `empleadoId`, `estado`, `fecha` = las que cubren ese día). `horaInicio` y
 * `horaFin` (`HH:mm`) son opcionales (ambas o ninguna, `""` = toda la jornada).
 *
 * Reglas que debe validar el API (409/422 con `{ "mensaje" }`), igual que
 * `AsignacionesLocal` (ver `seCruzan` en `asignacion.ts`):
 * - una ruta puede tener varias asignaciones activas si no se cruzan en fechas
 *   y horario (409);
 * - vehículo, conductor y monitora no pueden estar en dos asignaciones
 *   activas que se crucen (409);
 * - la capacidad del vehículo cubre a los estudiantes de la ruta;
 * - licencia del conductor y documentos del vehículo sin vencer.
 */
@Injectable()
export class AsignacionesHttp extends RepositorioHttp<Asignacion, FiltrosAsignacion> implements AsignacionesRepositorio {
  protected readonly recurso = 'asignaciones';
}
