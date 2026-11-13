import { Injectable, inject } from '@angular/core';
import { Observable, defer, map } from 'rxjs';
import { FILTROS_RUTA_VACIOS } from 'src/app/operacion/rutas/ruta';
import { RutasRepositorio } from 'src/app/operacion/rutas/rutas-repositorio';
import { AvisoAusencia, leerAvisos, ordenarAvisos, publico } from 'src/app/ruta-del-dia/avisos-ausencia';
import { FuenteLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { AvisosAusenciaRepositorio, FiltrosAvisoAusencia } from './avisos-ausencia-repositorio';

/** TEMPORAL: lee `rutarola.avisos-ausencia` (los escribe el portal local). */
@Injectable()
export class AvisosAusenciaLocal extends AvisosAusenciaRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly rutas = inject(RutasRepositorio);

  listar(f: FiltrosAvisoAusencia): Observable<AvisoAusencia[]> {
    return defer(() => {
      const fecha = f.fecha || fechaIso();
      return this.rutas.listar(FILTROS_RUTA_VACIOS, SIN_PAGINAR).pipe(
        map(({ items }) => {
          const enRuta = f.rutaId ? new Set(items.find((r) => r.id === f.rutaId)?.estudianteIds ?? []) : null;
          return ordenarAvisos(leerAvisos().filter((a) => a.fecha === fecha && (!enRuta || enRuta.has(a.estudianteId))).map(publico));
        }),
      );
    });
  }
}
