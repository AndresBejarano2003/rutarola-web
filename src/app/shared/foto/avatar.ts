import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TAMANOS = {
  xs: 'w-7 text-[0.65rem]',
  sm: 'w-9 text-xs',
  md: 'w-10 text-sm',
  lg: 'w-12 text-lg',
  xl: 'w-24 text-3xl',
} as const;

export type TamanoAvatar = keyof typeof TAMANOS;

/**
 * Avatar redondo: la foto de perfil si la hay (recortada para llenar el círculo) o, si no, las iniciales.
 * `tono`: `primario` (registro activo, amarillo de marca), `suave` (portal), `neutro` (inactivo).
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'avatar shrink-0', '[class.avatar-placeholder]': '!foto()' },
  template: `
    <div class="rounded-full font-bold" [class]="clases()">
      @if (foto()) {
        <img [src]="foto()" [alt]="alt()" class="object-cover" loading="lazy" decoding="async" draggable="false" />
      } @else {
        <span aria-hidden="true">{{ iniciales() }}</span>
      }
    </div>
  `,
})
export class Avatar {
  readonly foto = input<string | null | undefined>('');
  readonly iniciales = input('');
  readonly tamano = input<TamanoAvatar>('sm');
  readonly tono = input<'primario' | 'suave' | 'neutro'>('primario');
  /** Texto alternativo de la foto (vacío = decorativa, el nombre ya está al lado). */
  readonly alt = input('');

  protected readonly clases = computed(() => {
    const color =
      this.foto() ? 'bg-base-300' :
      this.tono() === 'primario' ? 'bg-primary text-primary-content' :
      this.tono() === 'suave' ? 'bg-primary/15 text-primary' :
      'bg-base-300 text-base-content/70';
    return `${TAMANOS[this.tamano()]} ${color}`;
  });
}
