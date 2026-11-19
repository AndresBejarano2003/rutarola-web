import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { FalloUbicacion, FuenteNativa, FuenteUbicacion } from './fuente-ubicacion';
import { INTERVALO_ENVIO_MS, LecturaDispositivo, LecturaGps, MAXIMO_POR_LOTE, SALTOS_PARA_ACEPTAR, encolar, lecturaDe, lecturaUtil, saltoImposible } from './gps';
import { GpsRepositorio } from './gps-repositorio';

/** Clave de `localStorage` de las lecturas aún no enviadas: `{ [recorridoId]: LecturaGps[] }`. */
export const CLAVE_COLA_GPS = 'rutarola.gps.pendientes';

/**
 * - `APAGADO`: no se está enviando (recorrido terminado o este teléfono no es el que reporta).
 * - `BUSCANDO`: esperando la primera lectura.
 * - `ACTIVO`: enviando (puede haber pendientes por falta de red).
 * - `SIN_PERMISO` / `NO_DISPONIBLE`: el usuario negó la ubicación o el equipo no la tiene.
 */
export type EstadoEmisor = 'APAGADO' | 'BUSCANDO' | 'ACTIVO' | 'SIN_PERMISO' | 'NO_DISPONIBLE';

/**
 * Envía la ubicación del teléfono durante un recorrido EN CURSO (lo usa la pantalla del recorrido):
 * `watchPosition` → lecturas útiles (precisión ≤ 100 m, una cada ≥ 5 s) → cola en `localStorage`
 * (sobrevive a recargas y a la falta de señal) → lotes de ≤ 500 cada 15 s y al recuperar la red.
 * Lo que no se pudo enviar de recorridos anteriores se reintenta al iniciar (el servidor acepta
 * lecturas hasta 5 min después del fin y descarta las repetidas).
 *
 * Las lecturas vienen de `FuenteUbicacion`. En la APP INSTALADA siguen con otra app al frente o la pantalla bloqueada
 * (servicio nativo con notificación) y se envían también al llegar cada lectura, porque en segundo plano los
 * temporizadores del WebView se frenan. En el NAVEGADOR no hay ubicación en segundo plano: mantiene la pantalla
 * encendida (Wake Lock), al volver reanuda la lectura de inmediato y avisa cuánto tiempo estuvo en pausa (`pausa`). Las lecturas que implican un salto imposible se descartan (`saltoImposible`).
 */
@Injectable()
export class EmisorGps {
  private readonly repositorio = inject(GpsRepositorio);
  private readonly fuente = inject(FuenteUbicacion);
  /** La app instalada sigue compartiendo en segundo plano (no hace falta mantener la pantalla encendida). */
  readonly enSegundoPlano = this.fuente.enSegundoPlano;

  readonly estado = signal<EstadoEmisor>('APAGADO');
  /** Lecturas guardadas en el teléfono sin enviar (todas las rutas). */
  readonly pendientes = signal(0);
  /** ISO de la última lectura tomada. */
  readonly ultimaLectura = signal<string | null>(null);
  /** El último envío falló (sin red o el servidor no respondió). */
  readonly sinConexion = signal(false);
  /** Motivo con el que el servidor rechazó el último lote (p. ej. el plan de la empresa no incluye GPS en vivo). */
  readonly rechazo = signal<string | null>(null);
  /** Minutos que la ubicación estuvo en pausa la última vez que la app pasó a segundo plano (`null` = sin aviso). */
  readonly pausa = signal<number | null>(null);
  /** La pantalla se mantiene encendida mientras se comparte (el navegador lo permite). */
  readonly pantallaEncendida = signal(false);

  private recorridoId: string | null = null;
  /** Última lectura aceptada (la cola se vacía al enviar, pero el salto se mide contra ella). */
  private ultimaAceptada: LecturaGps | undefined;
  private vigilancia: (() => void) | null = null;
  private ultimoEnvio = 0;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private enviando = false;
  /** Lecturas seguidas descartadas por salto (si se repiten, la equivocada era la anterior). */
  private saltos = 0;
  private ocultaDesde: number | null = null;
  private bloqueo: { release(): Promise<void> } | null = null;
  private readonly alRecuperarRed = () => void this.enviarPendientes();
  private readonly alCambiarVisibilidad = () => {
    if (document.visibilityState === 'hidden') {
      this.ocultaDesde = Date.now();
      return;
    }
    const pausa = this.ocultaDesde ? Date.now() - this.ocultaDesde : 0;
    this.ocultaDesde = null;
    if (!this.recorridoId || this.estado() === 'NO_DISPONIBLE') return;
    if (this.estado() === 'SIN_PERMISO') {
      // En la app instalada se pudo haber dado el permiso en los ajustes: se vuelve a intentar.
      if (this.fuente.enSegundoPlano) {
        this.estado.set('BUSCANDO');
        this.vigilar();
      }
      return;
    }
    if (!this.fuente.enSegundoPlano) {
      if (pausa >= 30_000) this.pausa.set(Math.max(1, Math.round(pausa / 60_000)));
      // Algunos navegadores dejan la vigilancia muerta al volver: se reinicia, se pide una lectura ya y se envía.
      this.vigilar();
      void this.mantenerPantalla();
    }
    void this.enviarPendientes();
  };

  constructor() {
    this.pendientes.set(this.contar(this.leer()));
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  iniciar(recorridoId: string): void {
    if (this.recorridoId === recorridoId && this.vigilancia !== null) return;
    this.detener();
    this.recorridoId = recorridoId;
    this.ultimaAceptada = undefined;
    if (!this.fuente.disponible()) {
      this.estado.set('NO_DISPONIBLE');
      return;
    }
    this.estado.set('BUSCANDO');
    this.saltos = 0;
    this.vigilar();
    this.temporizador = setInterval(() => void this.enviarPendientes(), INTERVALO_ENVIO_MS);
    window.addEventListener('online', this.alRecuperarRed);
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
    void this.mantenerPantalla();
    void this.enviarPendientes();
  }

  /** (Re)inicia la lectura continua y pide una lectura inmediata. */
  private vigilar(): void {
    this.detenerVigilancia();
    const fallo = (f: FalloUbicacion) => {
      if (f === 'SIN_PERMISO') {
        this.estado.set('SIN_PERMISO');
        this.detenerVigilancia();
      }
      // Sin señal o tiempo agotado: la vigilancia sigue intentando.
    };
    const leer = (p: LecturaDispositivo) => this.registrar(p);
    this.vigilancia = this.fuente.vigilar(leer, fallo);
    this.fuente.leerAhora(leer, fallo);
  }

  /** Pantalla encendida mientras se comparte (el sistema la suelta al ocultar la app; se vuelve a pedir al volver). */
  private async mantenerPantalla(): Promise<void> {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(tipo: 'screen'): Promise<{ release(): Promise<void>; addEventListener(e: 'release', f: () => void): void }> } }).wakeLock;
    if (this.fuente.enSegundoPlano || !wakeLock || document.visibilityState !== 'visible' || this.bloqueo) return;
    try {
      const bloqueo = await wakeLock.request('screen');
      this.bloqueo = bloqueo;
      this.pantallaEncendida.set(true);
      bloqueo.addEventListener('release', () => {
        this.bloqueo = null;
        this.pantallaEncendida.set(false);
      });
    } catch {
      this.pantallaEncendida.set(false); // Ahorro de batería u otra política del navegador.
    }
  }

  /** Abre los ajustes de la app para permitir la ubicación (solo en la app instalada). */
  abrirAjustes(): void {
    if (this.fuente instanceof FuenteNativa) void this.fuente.abrirAjustes().catch(() => undefined);
  }

  /** Deja de leer la ubicación y envía lo que quede (p. ej. al finalizar el recorrido). */
  async detenerYEnviar(): Promise<void> {
    this.detener();
    await this.enviarPendientes();
  }

  detener(): void {
    this.detenerVigilancia();
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    window.removeEventListener('online', this.alRecuperarRed);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    void this.bloqueo?.release().catch(() => undefined);
    this.bloqueo = null;
    this.pantallaEncendida.set(false);
    this.pausa.set(null);
    if (this.estado() === 'BUSCANDO' || this.estado() === 'ACTIVO') this.estado.set('APAGADO');
  }

  private detenerVigilancia(): void {
    this.vigilancia?.();
    this.vigilancia = null;
  }

  private registrar(p: LecturaDispositivo): void {
    const id = this.recorridoId;
    if (!id) return;
    const cola = this.leer();
    const propia = cola[id] ?? [];
    const anterior = propia.at(-1) ?? this.ultimaAceptada;
    if (!lecturaUtil(p, anterior)) return;
    const lectura = lecturaDe(p);
    if (anterior && saltoImposible(anterior, lectura) && ++this.saltos < SALTOS_PARA_ACEPTAR) return;
    this.saltos = 0;
    this.ultimaAceptada = lectura;
    this.escribir({ ...cola, [id]: encolar(propia, lectura) });
    this.ultimaLectura.set(lectura.fecha);
    this.estado.set('ACTIVO');
    // En segundo plano el temporizador se frena: cada lectura también dispara el envío si ya toca.
    if (Date.now() - this.ultimoEnvio >= INTERVALO_ENVIO_MS) void this.enviarPendientes();
  }

  /** Envía en lotes; lo enviado sale de la cola aunque se hayan agregado lecturas mientras tanto. */
  async enviarPendientes(): Promise<void> {
    if (this.enviando) return;
    this.enviando = true;
    this.ultimoEnvio = Date.now();
    try {
      for (const id of Object.keys(this.leer())) {
        let lote = (this.leer()[id] ?? []).slice(0, MAXIMO_POR_LOTE);
        while (lote.length > 0) {
          try {
            await firstValueFrom(this.repositorio.enviar(id, lote));
            this.sinConexion.set(false);
            this.rechazo.set(null);
          } catch (error) {
            // 4xx (recorrido ajeno o inexistente, plan sin GPS): esas lecturas no se aceptarán nunca, se descartan.
            if (!esRechazoDefinitivo(error)) {
              this.sinConexion.set(true);
              return;
            }
            this.rechazo.set(mensajeDeError(error));
          }
          const enviadas = new Set(lote.map((l) => l.fecha));
          const cola = this.leer();
          const resto = (cola[id] ?? []).filter((l) => !enviadas.has(l.fecha));
          const nueva = { ...cola, [id]: resto };
          if (resto.length === 0) delete nueva[id];
          this.escribir(nueva);
          lote = resto.slice(0, MAXIMO_POR_LOTE);
        }
      }
    } finally {
      this.enviando = false;
    }
  }

  private leer(): Record<string, LecturaGps[]> {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_COLA_GPS) ?? '{}') as Record<string, LecturaGps[]>;
    } catch {
      return {};
    }
  }

  private escribir(cola: Record<string, LecturaGps[]>): void {
    try {
      localStorage.setItem(CLAVE_COLA_GPS, JSON.stringify(cola));
    } catch {
      /* sin espacio: se pierde esta lectura, no se interrumpe el recorrido */
    }
    this.pendientes.set(this.contar(cola));
  }

  private contar(cola: Record<string, LecturaGps[]>): number {
    return Object.values(cola).reduce((n, l) => n + l.length, 0);
  }
}

/** Rechazos que no cambian al reintentar (400/403/404/422); 401 lo renueva el interceptor, 0/5xx se reintentan. */
function esRechazoDefinitivo(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === 'number') return [400, 403, 404, 422].includes(status);
  // Errores del repositorio local (ErrorCrud): definitivos.
  return error instanceof Error && error.name === 'ErrorCrud';
}
