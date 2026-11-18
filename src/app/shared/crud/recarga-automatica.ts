import { DestroyRef, InjectionToken, inject } from '@angular/core';

/**
 * Cada cuánto (ms) se recargan solas las tablas mientras la pantalla está VISIBLE (`0` = nunca; las pruebas lo
 * apagan). Con la pestaña oculta, otra app al frente o el teléfono bloqueado no se consulta nada, y al volver se
 * recarga enseguida si ya pasó el intervalo.
 */
export const INTERVALO_RECARGA = new InjectionToken<number>('INTERVALO_RECARGA', { factory: () => 60_000 });

export interface RecargaAutomatica {
  /** Arranca el temporizador (idempotente). */
  iniciar(): void;
  /** Avisa que se acaba de cargar (cuenta para el intervalo). */
  marcar(): void;
}

/**
 * Recarga periódica SOLO con la pantalla visible. Llamar en un contexto de inyección (constructor o campo); se
 * detiene sola al destruirse el componente o servicio. `recargar` debe ser silenciosa (sin "cargando" ni errores
 * en pantalla) y `puede` permite saltarse un turno (p. ej. mientras se guarda o ya hay una carga en curso).
 *
 * ```ts
 * private readonly recarga = recargaAutomatica(() => this.cargar(true), () => !this.cargando());
 * ```
 */
export function recargaAutomatica(recargar: () => void, puede: () => boolean = () => true, iniciarYa = true): RecargaAutomatica {
  const intervalo = inject(INTERVALO_RECARGA);
  let temporizador: ReturnType<typeof setInterval> | null = null;
  let ultima = Date.now();
  const hayDocumento = typeof document !== 'undefined';
  const visible = () => !hayDocumento || document.visibilityState === 'visible';
  const turno = () => {
    if (!visible() || !puede()) return;
    ultima = Date.now();
    recargar();
  };
  const alCambiarVisibilidad = () => {
    if (visible() && Date.now() - ultima >= intervalo) turno();
  };
  const control: RecargaAutomatica = {
    iniciar() {
      if (temporizador || intervalo <= 0 || !hayDocumento) return;
      temporizador = setInterval(turno, intervalo);
      document.addEventListener('visibilitychange', alCambiarVisibilidad);
    },
    marcar() {
      ultima = Date.now();
    },
  };
  inject(DestroyRef).onDestroy(() => {
    if (temporizador) clearInterval(temporizador);
    if (hayDocumento) document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  });
  if (iniciarYa) control.iniciar();
  return control;
}
