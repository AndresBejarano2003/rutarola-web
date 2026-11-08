import { Injectable, signal } from '@angular/core';

const CLAVE_SILENCIO = 'rutarola.sonidos.silenciados';

/** Una nota del sonido: frecuencia (Hz), inicio y duración (s) relativos al momento de sonar. */
interface Nota {
  frecuencia: number;
  inicio: number;
  duracion: number;
}

/** Aviso al compañero: dos tonos ascendentes, fáciles de oír con el ruido del vehículo. */
const AVISO_CAMBIO_ORDEN: Nota[] = [
  { frecuencia: 880, inicio: 0, duracion: 0.18 },
  { frecuencia: 1318.5, inicio: 0.16, duracion: 0.32 },
];
/** Confirmación suave para quien cambió el orden. */
const ORDEN_GUARDADO: Nota[] = [{ frecuencia: 1046.5, inicio: 0, duracion: 0.12 }];

/**
 * Sonidos de la Ruta del día generados con Web Audio (sin archivos). Los navegadores solo permiten sonar
 * después de que el usuario toque la pantalla, así que el contexto de audio se "desbloquea" en el primer
 * toque o tecla. Se pueden silenciar (preferencia de este teléfono en `localStorage`). En iPhone el
 * interruptor de silencio también los apaga.
 */
@Injectable({ providedIn: 'root' })
export class Sonidos {
  private contexto: AudioContext | null = null;
  readonly silenciados = signal(leerSilencio());

  constructor() {
    if (typeof window === 'undefined') return;
    const desbloquear = () => {
      if (this.preparar()?.state === 'running') {
        window.removeEventListener('pointerdown', desbloquear);
        window.removeEventListener('keydown', desbloquear);
      }
    };
    window.addEventListener('pointerdown', desbloquear, { passive: true });
    window.addEventListener('keydown', desbloquear);
  }

  /** La monitora (o el conductor) cambió el orden: avisa al compañero. */
  cambioOrden(): void {
    this.tocar(AVISO_CAMBIO_ORDEN);
  }

  /** El nuevo orden quedó guardado. */
  ordenGuardado(): void {
    this.tocar(ORDEN_GUARDADO, 0.12);
  }

  alternar(): void {
    const silenciar = !this.silenciados();
    this.silenciados.set(silenciar);
    try {
      localStorage.setItem(CLAVE_SILENCIO, silenciar ? '1' : '0');
    } catch {
      // Sin almacenamiento (modo privado): la preferencia dura mientras la página esté abierta.
    }
    if (!silenciar) this.ordenGuardado();
  }

  private preparar(): AudioContext | null {
    const Contexto = typeof AudioContext !== 'undefined' ? AudioContext : null;
    if (!Contexto) return null;
    try {
      this.contexto ??= new Contexto();
      if (this.contexto.state === 'suspended') void this.contexto.resume().catch(() => undefined);
      return this.contexto;
    } catch {
      return null;
    }
  }

  private tocar(notas: Nota[], volumen = 0.25): void {
    if (this.silenciados()) return;
    const ctx = this.preparar();
    if (!ctx) return;
    const ahora = ctx.currentTime + 0.01;
    for (const nota of notas) {
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.value = nota.frecuencia;
      // Envolvente corta (ataque rápido y caída suave) para que no "chasquee".
      const inicio = ahora + nota.inicio;
      ganancia.gain.setValueAtTime(0.0001, inicio);
      ganancia.gain.exponentialRampToValueAtTime(volumen, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + nota.duracion);
      oscilador.connect(ganancia).connect(ctx.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + nota.duracion + 0.02);
    }
  }
}

function leerSilencio(): boolean {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === '1';
  } catch {
    return false;
  }
}
