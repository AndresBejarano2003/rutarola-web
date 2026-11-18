import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, map, merge, of, startWith, switchMap, tap } from 'rxjs';
import { recargaAutomatica } from 'src/app/shared/crud/recarga-automatica';

export interface EstadoReporte<R> {
  cargando: boolean;
  datos: R;
  error: string | null;
}

/**
 * Vuelve a consultar el reporte cada vez que cambian los filtros. Para reintentar,
 * asigna una copia de los filtros (`filtros.set({ ...filtros() })`).
 * Además se actualiza solo (`recargaAutomatica`) mientras la pantalla está visible: sin "cargando" en pantalla y,
 * si esa consulta falla, se conservan los datos que se ven.
 * Debe llamarse en contexto de inyección (inicialización de un campo).
 */
export function reporteEnVivo<F, R>(filtros: Signal<F>, consultar: (f: F) => Observable<R>, vacio: R): Signal<EstadoReporte<R>> {
  const silenciosas = new Subject<void>();
  let actual: EstadoReporte<R> = { cargando: true, datos: vacio, error: null };
  recargaAutomatica(() => silenciosas.next(), () => !actual.cargando);
  return toSignal(
    toObservable(filtros).pipe(
      switchMap((f) =>
        merge(of(false), silenciosas.pipe(map(() => true))).pipe(
          switchMap((silenciosa) => {
            const consulta = consultar(f).pipe(map((datos): EstadoReporte<R> => ({ cargando: false, datos, error: null })));
            return silenciosa
              ? consulta.pipe(catchError(() => EMPTY))
              : consulta.pipe(
                  startWith<EstadoReporte<R>>({ cargando: true, datos: vacio, error: null }),
                  catchError(() => of<EstadoReporte<R>>({ cargando: false, datos: vacio, error: 'No fue posible generar el reporte.' })),
                );
          }),
        ),
      ),
      tap((e) => (actual = e)),
    ),
    { initialValue: actual },
  );
}
