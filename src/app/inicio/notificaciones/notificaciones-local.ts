import { Injectable, inject } from '@angular/core';
import { NovedadesVehiculoRepositorio } from 'src/app/operacion/vehiculos/novedades-vehiculo/novedades-vehiculo-repositorio';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { FILTROS_COTIZACION_VACIOS } from 'src/app/finanzas/cotizaciones/cotizacion';
import { CotizacionesRepositorio } from 'src/app/finanzas/cotizaciones/cotizaciones-repositorio';
import { FILTROS_FACTURA_VACIOS } from 'src/app/finanzas/facturas/factura';
import { FacturasRepositorio } from 'src/app/finanzas/facturas/facturas-repositorio';
import { FILTROS_PROGRAMACION_VACIOS } from 'src/app/finanzas/programacion/programacion';
import { ProgramacionesRepositorio } from 'src/app/finanzas/programacion/programaciones-repositorio';
import { FILTROS_RECIBO_VACIOS } from 'src/app/finanzas/recibos/recibo';
import { RecibosRepositorio } from 'src/app/finanzas/recibos/recibos-repositorio';
import { ReportesRepositorio } from 'src/app/finanzas/reportes/reportes-repositorio';
import { FILTROS_VEHICULO_VACIOS } from 'src/app/operacion/vehiculos/vehiculo';
import { VehiculosRepositorio } from 'src/app/operacion/vehiculos/vehiculos-repositorio';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { Pagina, Paginacion } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, SIN_PAGINAR, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';
import { DatosNotificables, generarNotificaciones } from './generar-notificaciones';
import {
  BandejaNotificaciones,
  FiltrosNotificacion,
  NotificacionSistema,
  RECIENTES_CAMPANA,
  ResumenNotificaciones,
} from './notificacion-sistema';
import { NotificacionesRepositorio } from './notificaciones-repositorio';

const CLAVE = 'rutarola.notificaciones';
/** Claves ya notificadas (también las eliminadas), para no repetir un mismo hecho. */
const CLAVE_VISTAS = 'rutarola.notificaciones.vistas';
/** Máximo guardado en el navegador; se descartan las más antiguas. */
const MAXIMO = 300;
/** Cada cuánto se vuelven a revisar vencimientos aunque no haya cambios de datos. */
const REVISION_MS = 60_000;

/**
 * TEMPORAL: simula al servidor. Revisa los datos locales de los demás módulos con las reglas de
 * `generarNotificaciones` y guarda en `localStorage` solo los hechos que aún no se habían notificado.
 */
@Injectable()
export class NotificacionesLocal extends NotificacionesRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);
  private readonly cambios = inject(CambiosDatos);
  private readonly vehiculos = inject(VehiculosRepositorio);
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly facturas = inject(FacturasRepositorio);
  private readonly recibos = inject(RecibosRepositorio);
  private readonly cotizaciones = inject(CotizacionesRepositorio);
  private readonly programaciones = inject(ProgramacionesRepositorio);
  private readonly reportes = inject(ReportesRepositorio);
  private readonly novedades = inject(NovedadesVehiculoRepositorio);
  private readonly suscripcion = inject(SuscripcionRepositorio);

  private ultimaRevision = 0;
  private versionRevisada = -1;

  listar(f: FiltrosNotificacion, { pagina, tamano }: Paginacion): Observable<Pagina<NotificacionSistema>> {
    return this.responder(() => {
      const texto = normalizar(f.texto);
      const filtradas = this.leer().filter(
        (n) =>
          n.archivada === (f.bandeja === 'ARCHIVADAS') &&
          (!f.categoria || n.categoria === f.categoria) &&
          (!f.nivel || n.nivel === f.nivel) &&
          (!f.lectura || n.leida === (f.lectura === 'LEIDAS')) &&
          (!texto || normalizar(`${n.titulo} ${n.mensaje}`).includes(texto)),
      );
      const inicio = (pagina - 1) * tamano;
      return { items: filtradas.slice(inicio, inicio + tamano), total: filtradas.length, pagina, tamano };
    });
  }

  resumen(): Observable<ResumenNotificaciones> {
    return this.revisar().pipe(
      switchMap(() =>
        this.responder(() => {
          const entrada = this.leer().filter((n) => !n.archivada);
          const noLeidas = entrada.filter((n) => !n.leida);
          return {
            noLeidas: noLeidas.length,
            criticas: noLeidas.filter((n) => n.nivel === 'CRITICA').length,
            recientes: entrada.slice(0, RECIENTES_CAMPANA),
          };
        }),
      ),
    );
  }

  marcarLeidas(ids: string[], leida: boolean): Observable<void> {
    return this.modificar(ids, () => ({ leida }));
  }

  marcarTodasLeidas(): Observable<void> {
    return this.responder(() => this.escribir(this.leer().map((n) => (n.archivada ? n : { ...n, leida: true }))));
  }

  archivar(ids: string[], archivada: boolean): Observable<void> {
    return this.modificar(ids, (n) => ({ archivada, leida: archivada ? true : n.leida }));
  }

  eliminar(ids: string[]): Observable<void> {
    const quitar = new Set(ids);
    return this.responder(() => this.escribir(this.leer().filter((n) => !quitar.has(n.id))));
  }

  vaciar(bandeja: BandejaNotificaciones): Observable<void> {
    return this.responder(() => this.escribir(this.leer().filter((n) => n.archivada !== (bandeja === 'ARCHIVADAS'))));
  }

  /** Genera las notificaciones nuevas si cambiaron los datos o pasó el intervalo de revisión. */
  private revisar(): Observable<unknown> {
    const version = this.cambios.version();
    if (version === this.versionRevisada && Date.now() - this.ultimaRevision < REVISION_MS) {
      return of(null);
    }
    return this.cargarDatos().pipe(
      map((datos) => {
        const ahora = new Date();
        const vistas = new Set(this.leerVistas());
        const nuevas = generarNotificaciones(datos, ahora)
          .filter((n) => !vistas.has(n.clave))
          .map(
            (n): NotificacionSistema => ({
              ...n,
              id: crypto.randomUUID(),
              fecha: n.fecha ?? ahora.toISOString(),
              leida: false,
              archivada: false,
            }),
          );
        if (nuevas.length) {
          this.escribir([...nuevas, ...this.leer()]);
          this.escribirVistas([...vistas, ...nuevas.map((n) => n.clave)]);
        }
        this.versionRevisada = version;
        this.ultimaRevision = Date.now();
      }),
    );
  }

  private cargarDatos(): Observable<DatosNotificables> {
    const envios = this.programaciones.listar(FILTROS_PROGRAMACION_VACIOS, SIN_PAGINAR).pipe(
      switchMap(({ items }) =>
        items.length
          ? forkJoin(
              items.map((programacion) =>
                this.programaciones.historial(programacion.id).pipe(map((lista) => lista.map((envio) => ({ programacion, envio })))),
              ),
            ).pipe(map((listas) => listas.flat()))
          : of([]),
      ),
    );
    return forkJoin({
      vehiculos: this.vehiculos.listar(FILTROS_VEHICULO_VACIOS, SIN_PAGINAR).pipe(map((p) => p.items)),
      empleados: this.empleados.listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR).pipe(map((p) => p.items)),
      facturas: this.facturas.listar(FILTROS_FACTURA_VACIOS, SIN_PAGINAR).pipe(map((p) => p.items)),
      recibos: this.recibos.listar(FILTROS_RECIBO_VACIOS, SIN_PAGINAR).pipe(map((p) => p.items)),
      cotizaciones: this.cotizaciones.listar(FILTROS_COTIZACION_VACIOS, SIN_PAGINAR).pipe(map((p) => p.items)),
      envios,
      morosos: this.reportes.morosos({ texto: '', diasMinimos: 0 }),
      novedades: this.novedades.listar({ abiertas: true }).pipe(catchError(() => of([]))),
      suscripcion: this.suscripcion.actual().pipe(catchError(() => of(null))),
      diasAvisoVencimiento: this.suscripcion.condiciones().pipe(
        map((c) => c.diasAvisoVencimiento),
        catchError(() => of(5)),
      ),
    });
  }

  private modificar(ids: string[], cambio: (n: NotificacionSistema) => Partial<NotificacionSistema>): Observable<void> {
    const afectadas = new Set(ids);
    return this.responder(() =>
      this.escribir(this.leer().map((n) => (afectadas.has(n.id) ? { ...n, ...cambio(n) } : n))),
    );
  }

  /** Más recientes primero. */
  private leer(): NotificacionSistema[] {
    try {
      const lista = JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as NotificacionSistema[];
      return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch {
      return [];
    }
  }

  private escribir(lista: NotificacionSistema[]): void {
    const ordenada = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXIMO);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(ordenada));
    } catch {
      // Sin espacio: se conserva lo anterior.
    }
  }

  private leerVistas(): string[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_VISTAS) ?? '[]') as string[];
    } catch {
      return [];
    }
  }

  private escribirVistas(claves: string[]): void {
    try {
      localStorage.setItem(CLAVE_VISTAS, JSON.stringify(claves));
    } catch {
      // Sin espacio: en la próxima revisión se intentará de nuevo.
    }
  }

  private responder<R>(operacion: () => R): Observable<R> {
    return responderLocal(operacion, this.latenciaMs);
  }
}
