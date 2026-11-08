import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { INTERVALO_ENVIO_MS, LecturaGps, MAXIMO_POR_LOTE, encolar, lecturaDe, lecturaUtil } from './gps';
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
 */
@Injectable()
export class EmisorGps {
  private readonly repositorio = inject(GpsRepositorio);

  readonly estado = signal<EstadoEmisor>('APAGADO');
  /** Lecturas guardadas en el teléfono sin enviar (todas las rutas). */
  readonly pendientes = signal(0);
  /** ISO de la última lectura tomada. */
  readonly ultimaLectura = signal<string | null>(null);
  /** El último envío falló (sin red o el servidor no respondió). */
  readonly sinConexion = signal(false);
  /** Motivo con el que el servidor rechazó el último lote (p. ej. el plan de la empresa no incluye GPS en vivo). */
  readonly rechazo = signal<string | null>(null);

  private recorridoId: string | null = null;
  private vigilancia: number | null = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private enviando = false;
  private readonly alRecuperarRed = () => void this.enviarPendientes();

  constructor() {
    this.pendientes.set(this.contar(this.leer()));
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  iniciar(recorridoId: string): void {
    if (this.recorridoId === recorridoId && this.vigilancia !== null) return;
    this.detener();
    this.recorridoId = recorridoId;
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      this.estado.set('NO_DISPONIBLE');
      return;
    }
    this.estado.set('BUSCANDO');
    this.vigilancia = geo.watchPosition(
      (p) => this.registrar(p),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          this.estado.set('SIN_PERMISO');
          this.detenerVigilancia();
        }
        // Sin señal o tiempo agotado: watchPosition sigue intentando.
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );
    this.temporizador = setInterval(() => void this.enviarPendientes(), INTERVALO_ENVIO_MS);
    window.addEventListener('online', this.alRecuperarRed);
    void this.enviarPendientes();
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
    if (this.estado() === 'BUSCANDO' || this.estado() === 'ACTIVO') this.estado.set('APAGADO');
  }

  private detenerVigilancia(): void {
    if (this.vigilancia !== null) navigator.geolocation?.clearWatch(this.vigilancia);
    this.vigilancia = null;
  }

  private registrar(p: GeolocationPosition): void {
    const id = this.recorridoId;
    if (!id) return;
    const cola = this.leer();
    const propia = cola[id] ?? [];
    if (!lecturaUtil(p, propia.at(-1))) return;
    const lectura = lecturaDe(p);
    this.escribir({ ...cola, [id]: encolar(propia, lectura) });
    this.ultimaLectura.set(lectura.fecha);
    this.estado.set('ACTIVO');
  }

  /** Envía en lotes; lo enviado sale de la cola aunque se hayan agregado lecturas mientras tanto. */
  async enviarPendientes(): Promise<void> {
    if (this.enviando) return;
    this.enviando = true;
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
