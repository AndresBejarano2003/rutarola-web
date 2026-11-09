import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Avatar } from './avatar';
import { TIPOS_FOTO, reducirFoto } from './foto';

/**
 * Campo de foto de perfil (`ControlValueAccessor`, valor = data URL JPG de 256 px o `''`): vista previa redonda,
 * "Subir foto" / "Cambiar" (desde el teléfono abre también la cámara) y "Quitar". La imagen se recorta al centro
 * y se reduce en el navegador antes de guardarla.
 */
@Component({
  selector: 'app-campo-foto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoFoto), multi: true }],
  host: { class: 'flex items-center gap-4' },
  template: `
    <app-avatar [foto]="valor()" [iniciales]="iniciales() || '?'" tamano="xl" tono="suave" [alt]="etiqueta()" />
    <div class="flex flex-col gap-2 min-w-0">
      <span class="label-text text-base-content/90">{{ etiqueta() }}</span>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" [disabled]="deshabilitado() || procesando()"
          (click)="abrirSelector()">
          @if (procesando()) {
            <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          } @else {
            <i class="fa-solid fa-camera" aria-hidden="true"></i>
          }
          {{ valor() ? 'Cambiar foto' : 'Subir foto' }}
        </button>
        @if (valor()) {
          <button type="button" class="btn btn-sm btn-ghost text-error" [disabled]="deshabilitado() || procesando()" (click)="quitar()">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Quitar
          </button>
        }
      </div>
      <span class="text-xs text-base-content/70">JPG, PNG o WebP. Se recorta en un cuadrado.</span>
      @if (error()) {
        <span class="text-xs text-error" role="alert">{{ error() }}</span>
      }
      <input #archivo type="file" class="hidden" [accept]="tipos" (change)="elegir($event)" [attr.aria-label]="etiqueta()" />
    </div>
  `,
})
export class CampoFoto implements ControlValueAccessor {
  readonly etiqueta = input('Foto');
  /** Se muestran mientras no haya foto. */
  readonly iniciales = input('');

  protected readonly tipos = TIPOS_FOTO;
  private readonly archivo = viewChild<ElementRef<HTMLInputElement>>('archivo');
  protected readonly valor = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal(false);
  protected readonly deshabilitado = signal(false);

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
    this.error.set(null);
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected abrirSelector(): void {
    this.archivo()?.nativeElement.click();
  }

  protected async elegir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.procesando.set(true);
    try {
      this.fijar(await reducirFoto(archivo));
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo leer la imagen.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected quitar(): void {
    this.fijar('');
  }

  private fijar(valor: string): void {
    this.valor.set(valor);
    this.alCambiar(valor);
    this.alTocar();
  }
}
