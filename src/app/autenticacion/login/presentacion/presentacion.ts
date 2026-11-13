import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';

/** Animación del logo según la forma de la pantalla (fondo negro, se ve completa con `object-contain`). */
export const VIDEO_HORIZONTAL = 'videos/rutarola-logo-16x9-_1_.mp4';
export const VIDEO_VERTICAL = 'videos/rutarola-logo-9x16.mp4';

/** Si el video no empieza en este tiempo (red lenta, ahorro de energía en iOS) se pasa directo al login. */
const ESPERA_INICIO_MS = 5000;
/** Tope total aunque el video se quede cargando a mitad (dura 10 s). */
const DURACION_MAXIMA_MS = 13000;
/** Si el video se queda cargando a mitad (red lenta) más de esto, se pasa al login. */
const ESPERA_ATASCO_MS = 2500;
const SALIDA_MS = 400;

/** Pantalla vertical (celular de pie) → video 9:16; horizontal (computador, tablet o celular acostado) → 16:9. */
export function videoPresentacion(vertical = typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches): string {
  return vertical ? VIDEO_VERTICAL : VIDEO_HORIZONTAL;
}

/**
 * Precarga del login: reproduce la animación de RutaRola a pantalla completa y, al terminar (o al tocar "Saltar"),
 * se desvanece y avisa con `termino`. Va silenciada porque los navegadores solo reproducen solos los videos sin sonido.
 *
 * `muted` se pone como PROPIEDAD y se llama a `play()`: el atributo que Angular agrega después de crear el elemento no
 * silencia el video y Chrome de escritorio lo dejaba quieto en el primer cuadro. Si el navegador aun así no deja
 * reproducirlo, se muestra el login de una vez.
 */
@Component({
  selector: 'app-presentacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-400"
      [class.opacity-0]="saliendo()" role="img" aria-label="RutaRola, control escolar">
      <video #video class="w-full h-full object-contain" [src]="archivo" [muted]="true" autoplay playsinline preload="auto"
        aria-hidden="true" (playing)="empezo()" (timeupdate)="avanzo()" (waiting)="seDetuvo()" (stalled)="seDetuvo()"
        (ended)="terminar()" (error)="terminar()"></video>
      <button type="button" class="btn btn-sm btn-ghost text-white/90 hover:bg-white/10 absolute right-4
        bottom-[max(1rem,env(safe-area-inset-bottom))]" (click)="terminar()">
        Saltar <i class="fa-solid fa-forward" aria-hidden="true"></i>
      </button>
    </div>
  `,
})
export class Presentacion {
  readonly termino = output<void>();

  protected readonly archivo = videoPresentacion();
  protected readonly saliendo = signal(false);
  private readonly temporizadores: ReturnType<typeof setTimeout>[] = [];
  private readonly elemento = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private inicio: ReturnType<typeof setTimeout> | undefined = undefined;
  private atasco: ReturnType<typeof setTimeout> | undefined = undefined;

  constructor() {
    this.inicio = setTimeout(() => this.terminar(), ESPERA_INICIO_MS);
    this.temporizadores.push(this.inicio, setTimeout(() => this.terminar(), DURACION_MAXIMA_MS));
    inject(DestroyRef).onDestroy(() => {
      this.temporizadores.forEach(clearTimeout);
      clearTimeout(this.atasco);
    });
    afterNextRender(() => this.reproducir());
  }

  private reproducir(): void {
    const video = this.elemento().nativeElement;
    video.muted = true;
    try {
      // Bloqueado por el navegador (sin interacción, ahorro de energía) → directo al login.
      const intento = video.play() as Promise<void> | undefined;
      intento?.catch(() => this.terminar());
    } catch {
      this.terminar();
    }
  }

  protected empezo(): void {
    clearTimeout(this.inicio);
    this.avanzo();
  }

  protected avanzo(): void {
    clearTimeout(this.atasco);
    this.atasco = undefined;
  }

  protected seDetuvo(): void {
    if (this.atasco === undefined && !this.saliendo()) this.atasco = setTimeout(() => this.terminar(), ESPERA_ATASCO_MS);
  }

  protected terminar(): void {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    this.temporizadores.push(setTimeout(() => this.termino.emit(), SALIDA_MS));
  }
}
