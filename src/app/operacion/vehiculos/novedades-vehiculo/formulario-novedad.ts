import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ArchivoAdjunto, ArchivoAdjuntoCampo } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Campo } from 'src/app/shared/campo/campo';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { GRAVEDADES_NOVEDAD, GravedadNovedad, SolicitudNovedad, TIPOS_NOVEDAD, TipoNovedadVehiculo } from './novedad-vehiculo';

/**
 * Campos para reportar una novedad del vehículo (los usa el conductor/monitora en la Ruta del día y el administrador
 * en el detalle del vehículo). Solo campos: el botón de envío va fuera, con `form="…"`.
 */
@Component({
  selector: 'app-formulario-novedad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ArchivoAdjuntoCampo, Campo, SelectorBusqueda],
  template: `
    <form [id]="idFormulario()" [formGroup]="form" (ngSubmit)="enviar()" class="grid md:grid-cols-2 gap-x-4 gap-y-3" novalidate>
      @if (!vehiculoFijo()) {
        <div class="flex flex-col md:col-span-2">
          <span class="label-text text-base-content/90 mb-1">Vehículo <span class="text-error">*</span></span>
          <app-selector-busqueda formControlName="vehiculoId" [opciones]="vehiculos()" etiqueta="Vehículo" [invalido]="!!error('vehiculoId')" />
          @if (error('vehiculoId'); as e) { <span class="text-xs text-error mt-1">{{ e }}</span> }
        </div>
      }
      <div class="flex flex-col">
        <span class="label-text text-base-content/90 mb-1">¿Qué pasó? <span class="text-error">*</span></span>
        <app-selector-busqueda formControlName="tipo" [opciones]="tipos" etiqueta="Tipo de novedad" [invalido]="!!error('tipo')" />
        @if (error('tipo'); as e) { <span class="text-xs text-error mt-1">{{ e }}</span> }
      </div>
      <label app-campo etiqueta="Kilometraje (odómetro)" [error]="error('kilometraje')" ayuda="Opcional.">
        <input type="number" min="0" step="1" inputmode="numeric" formControlName="kilometraje" class="input input-bordered bg-base-100 border-neutral w-full" />
      </label>
      <fieldset class="md:col-span-2 flex flex-col gap-1">
        <legend class="label-text text-base-content/90 mb-1">Gravedad <span class="text-error">*</span></legend>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          @for (g of gravedades; track g.id) {
            <label class="flex items-start gap-2 rounded-box border border-base-300 bg-base-100 p-3 cursor-pointer
              has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2">
              <input type="radio" class="sr-only" formControlName="gravedad" [value]="g.id" />
              <span class="badge badge-soft badge-sm mt-0.5" [class]="g.clase">{{ g.nombre }}</span>
              <span class="text-sm text-base-content/90">{{ g.descripcion }}</span>
            </label>
          }
        </div>
      </fieldset>
      <label app-campo class="md:col-span-2" etiqueta="Descripción" requerido [error]="error('descripcion')"
        ayuda="Qué se nota, desde cuándo y dónde está el vehículo.">
        <textarea formControlName="descripcion" rows="3" maxlength="1000" class="textarea textarea-bordered bg-base-100 border-neutral w-full"
          [class.textarea-error]="!!error('descripcion')" placeholder="Ej. al frenar suena la rueda trasera derecha desde ayer"></textarea>
      </label>
      <div class="md:col-span-2 flex flex-col gap-1">
        <span class="label-text text-base-content/90">Foto o documento (opcional, máx. 2 MB)</span>
        <app-archivo-adjunto formControlName="archivo" />
      </div>
    </form>
  `,
})
export class FormularioNovedad {
  readonly idFormulario = input.required<string>();
  readonly vehiculos = input<OpcionCatalogo[]>([]);
  /** Vehículo ya elegido (detalle del vehículo): oculta el selector. */
  readonly vehiculoFijo = input('');
  readonly enviarNovedad = output<SolicitudNovedad>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly tipos = TIPOS_NOVEDAD.map((t) => ({ id: t.id, nombre: t.nombre }));
  protected readonly gravedades = GRAVEDADES_NOVEDAD;

  protected readonly form = this.fb.group({
    vehiculoId: ['', Validators.required],
    tipo: this.fb.control<TipoNovedadVehiculo | ''>('', Validators.required),
    gravedad: this.fb.control<GravedadNovedad>('MEDIA', Validators.required),
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    kilometraje: this.fb.control<number | null>(null, Validators.min(0)),
    archivo: this.fb.control<ArchivoAdjunto | null>(null),
  });

  constructor() {
    effect(() => {
      const fijo = this.vehiculoFijo();
      const opciones = this.vehiculos();
      untracked(() => {
        const c = this.form.controls.vehiculoId;
        if (fijo) c.setValue(fijo);
        else if (!c.value && opciones.length === 1) c.setValue(opciones[0].id);
      });
    });
  }

  /** Deja el formulario listo para otra novedad (conserva el vehículo). */
  reiniciar(): void {
    const vehiculoId = this.form.controls.vehiculoId.value;
    this.form.reset({ vehiculoId, tipo: '', gravedad: 'MEDIA', descripcion: '', kilometraje: null, archivo: null });
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    const c = this.form.controls[campo];
    if (campo === 'descripcion' && (c.touched || c.dirty) && c.hasError('minlength')) return 'Describe la novedad con al menos 10 caracteres.';
    return mensajeError(c);
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviarNovedad.emit({
      vehiculoId: v.vehiculoId,
      tipo: v.tipo as TipoNovedadVehiculo,
      gravedad: v.gravedad,
      descripcion: v.descripcion.trim(),
      kilometraje: v.kilometraje === null || (v.kilometraje as unknown) === '' ? null : Math.round(Number(v.kilometraje)),
      archivo: v.archivo,
    });
  }
}
