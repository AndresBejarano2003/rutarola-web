import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';

/** Animación del logo según la forma de la pantalla (fondo negro, se ve completa con `object-contain`). */
export const VIDEO_HORIZONTAL = 'videos/rutarola-logo-16x9-_1_.mp4';
export const VIDEO_VERTICAL = 'videos/rutarola-logo-9x16.mp4';

/** Si el video no empieza en este tiempo (red lenta, ahorro de energía en iOS) se pasa directo al login. */
const ESPERA_INICIO_MS = 5000;
/** Tope total aunque el video se quede cargando a mitad (dura 10 s). */
const DURACION_MAXIMA_MS = 13000;
const SALIDA_MS = 400;

/** Pantalla vertical (celular de pie) → video 9:16; horizontal (computador, tablet o celular acostado) → 16:9. */
export function videoPresentacion(vertical = typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches): string {
  return vertical ? VIDEO_VERTICAL : VIDEO_HORIZONTAL;
}

/**
 * Precarga del login: reproduce la animación de RutaRola a pantalla completa y, al terminar (o al tocar "Saltar"),
 * se desvanece y avisa con `termino`. Va silenciada porque los navegadores solo reproducen solos los videos sin sonido.
 */
@Component({
  selector: 'app-presentacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-400"
      [class.opacity-0]="saliendo()" role="img" aria-label="RutaRola, control escolar">
      <video class="w-full h-full object-contain" [src]="video" autoplay muted playsinline preload="auto"
        aria-hidden="true" (playing)="empezo()" (ended)="terminar()" (error)="terminar()"></video>
      <button type="button" class="btn btn-sm btn-ghost text-white/90 hover:bg-white/10 absolute right-4
        bottom-[max(1rem,env(safe-area-inset-bottom))]" (click)="terminar()">
        Saltar <i class="fa-solid fa-forward" aria-hidden="true"></i>
      </button>
    </div>
  `,
})
export class Presentacion {
  readonly termino = output<void>();

  protected readonly video = videoPresentacion();
  protected readonly saliendo = signal(false);
  private readonly temporizadores: ReturnType<typeof setTimeout>[] = [];
  private inicio: ReturnType<typeof setTimeout> | undefined = undefined;

  constructor() {
    this.inicio = setTimeout(() => this.terminar(), ESPERA_INICIO_MS);
    this.temporizadores.push(this.inicio, setTimeout(() => this.terminar(), DURACION_MAXIMA_MS));
    inject(DestroyRef).onDestroy(() => this.temporizadores.forEach(clearTimeout));
  }

  protected empezo(): void {
    clearTimeout(this.inicio);
  }

  protected terminar(): void {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    this.temporizadores.push(setTimeout(() => this.termino.emit(), SALIDA_MS));
  }
}
