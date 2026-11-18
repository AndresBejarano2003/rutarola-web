import { DestroyRef, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { Pagina, Paginacion, mensajeDeError } from './crud';
import { RepositorioLectura } from './repositorio-crud';
import { recargaAutomatica } from './recarga-automatica';
import { esFuenteLocal } from './repositorio-local';

export const TAMANOS_PAGINA = [10, 25, 50] as const;

export { INTERVALO_RECARGA } from './recarga-automatica';

/**
 * Estado de un listado paginado con filtros (signals). Base de `CrudStore`
 * y de las pantallas de solo lectura (p. ej. Operación › Conductores).
 */
export abstract class ListadoStore<T, F extends object> {
  protected abstract readonly repositorio: RepositorioLectura<T, F>;

  private readonly destroyRef = inject(DestroyRef);
  /** `true` = recarga automática: sin "cargando" en pantalla y, si falla, se conservan los datos. */
  private readonly solicitudes = new Subject<boolean>();
  /** Arranca con la primera carga (cuando una pantalla usa el listado). */
  private readonly recarga = recargaAutomatica(
    () => this.solicitudes.next(true),
    () => !this._cargando() && this.puedeRecargarSolo(),
    false,
  );
  private readonly _actualizado = signal<Date | null>(null);

  private readonly _pagina = signal<Pagina<T>>({ items: [], total: 0, pagina: 1, tamano: TAMANOS_PAGINA[0] });
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly filtros: WritableSignal<F>;
  readonly paginacion = signal<Paginacion>({ pagina: 1, tamano: TAMANOS_PAGINA[0] });

  readonly items: Signal<T[]> = computed(() => this._pagina().items);
  readonly total = computed(() => this._pagina().total);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.paginacion().tamano)));
  readonly cargando = this._cargando.asReadonly();
  /** Hora de la última carga correcta. */
  readonly actualizado = this._actualizado.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hayFiltros = computed(() =>
    Object.entries(this.filtros()).some(([clave, valor]) => valor !== (this.filtrosIniciales as Record<string, unknown>)[clave]),
  );

  constructor(private readonly filtrosIniciales: F) {
    this.filtros = signal(filtrosIniciales);

    // switchMap: si llega una búsqueda nueva, se descarta la respuesta anterior.
    this.solicitudes
      .pipe(
        tap((silenciosa) => {
          this.recarga.marcar();
          if (silenciosa) return;
          this._cargando.set(true);
          this._error.set(null);
        }),
        switchMap((silenciosa) =>
          this.repositorio.listar(this.filtros(), this.paginacion()).pipe(
            catchError((error: unknown) => {
              if (!silenciosa) this._error.set(mensajeDeError(error));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((pagina) => {
        this._cargando.set(false);
        if (pagina) {
          this._pagina.set(pagina);
          this._error.set(null);
          this._actualizado.set(new Date());
        }
      });
  }

  /** Si se puede recargar solo ahora (p. ej. `CrudStore` no lo hace mientras guarda). */
  protected puedeRecargarSolo(): boolean {
    return true;
  }

  /** `true` si los datos se guardan en el navegador (todavía sin API). */
  get modoLocal(): boolean {
    return esFuenteLocal(this.repositorio);
  }

  recargar(): void {
    this.recarga.iniciar();
    this.solicitudes.next(false);
  }

  buscar(filtros: F): void {
    this.filtros.set(filtros);
    this.paginacion.update((p) => ({ ...p, pagina: 1 }));
    this.recargar();
  }

  irAPagina(pagina: number): void {
    this.paginacion.update((p) => ({ ...p, pagina: Math.min(Math.max(1, pagina), this.totalPaginas()) }));
    this.recargar();
  }

  cambiarTamano(tamano: number): void {
    this.paginacion.set({ pagina: 1, tamano });
    this.recargar();
  }
}
