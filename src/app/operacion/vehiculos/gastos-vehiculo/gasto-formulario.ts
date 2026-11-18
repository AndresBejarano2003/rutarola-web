import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ArchivoAdjunto, ArchivoAdjuntoCampo } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { GastoVehiculo, TIPOS_GASTO, TipoGasto } from './gasto-vehiculo';

/** Formulario de un gasto del vehículo (solo campos; los botones van en el pie del modal con `form="…"`). */
@Component({
  selector: 'app-gasto-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ArchivoAdjuntoCampo, Campo, TituloSeccion, SelectorBusqueda],
  template: `
    <form [id]="idFormulario()" [formGroup]="form" (ngSubmit)="enviar()" class="grid md:grid-cols-2 gap-x-4 gap-y-3" novalidate>
      <app-titulo-seccion class="md:col-span-2">Gasto</app-titulo-seccion>
      <div class="flex flex-col">
        <span class="label-text text-base-content/90 mb-1">Vehículo <span class="text-error">*</span></span>
        <app-selector-busqueda formControlName="vehiculoId" [opciones]="vehiculos()" etiqueta="Vehículo" [invalido]="!!error('vehiculoId')" />
        @if (error('vehiculoId'); as e) { <span class="text-xs text-error mt-1">{{ e }}</span> }
      </div>
      <div class="flex flex-col">
        <span class="label-text text-base-content/90 mb-1">Tipo de gasto <span class="text-error">*</span></span>
        <app-selector-busqueda formControlName="tipo" [opciones]="tipos" etiqueta="Tipo de gasto" [invalido]="!!error('tipo')" />
        @if (error('tipo'); as e) { <span class="text-xs text-error mt-1">{{ e }}</span> }
      </div>
      <label app-campo etiqueta="Fecha" requerido [error]="errorFecha()">
        <input type="date" formControlName="fecha" [max]="hoy" class="input input-bordered bg-base-100 border-neutral w-full" [class.input-error]="!!errorFecha()" />
      </label>
      <label app-campo etiqueta="Valor (COP)" requerido [error]="error('valor')">
        <input type="number" min="1" step="1" inputmode="numeric" formControlName="valor" class="input input-bordered bg-base-100 border-neutral w-full"
          [class.input-error]="!!error('valor')" />
      </label>
      <label app-campo [etiqueta]="esCombustible() ? 'Galones' : 'Cantidad'" [requerido]="esCombustible()" [error]="error('cantidad')"
        [ayuda]="esCombustible() ? 'Con el kilometraje calcula el rendimiento (km por galón).' : 'Opcional: unidades compradas.'">
        <input type="number" min="0" step="0.01" inputmode="decimal" formControlName="cantidad" class="input input-bordered bg-base-100 border-neutral w-full"
          [class.input-error]="!!error('cantidad')" />
      </label>
      <label app-campo etiqueta="Kilometraje (odómetro)" [error]="error('kilometraje')" ayuda="Opcional. Sirve para el costo por kilómetro.">
        <input type="number" min="0" step="1" inputmode="numeric" formControlName="kilometraje" class="input input-bordered bg-base-100 border-neutral w-full" />
      </label>

      <app-titulo-seccion class="md:col-span-2 mt-2">Soporte</app-titulo-seccion>
      <label app-campo etiqueta="Proveedor" [error]="error('proveedor')" ayuda="Estación, taller, almacén…">
        <input formControlName="proveedor" maxlength="120" class="input input-bordered bg-base-100 border-neutral w-full" />
      </label>
      <label app-campo etiqueta="N.° de factura o comprobante" [error]="error('referencia')">
        <input formControlName="referencia" maxlength="50" class="input input-bordered bg-base-100 border-neutral w-full" />
      </label>
      <label app-campo class="md:col-span-2" etiqueta="Descripción" [error]="error('descripcion')">
        <textarea formControlName="descripcion" rows="2" maxlength="300" class="textarea textarea-bordered bg-base-100 border-neutral w-full"
          placeholder="Ej. cambio de aceite 15W-40 y filtro de aire"></textarea>
      </label>
      <div class="md:col-span-2 flex flex-col gap-1">
        <span class="label-text text-base-content/90">Factura o foto (PDF o imagen, máx. 2 MB)</span>
        <app-archivo-adjunto formControlName="archivo" />
      </div>
    </form>
  `,
})
export class GastoFormulario {
  readonly idFormulario = input.required<string>();
  readonly gasto = input<GastoVehiculo | null>(null);
  readonly vehiculos = input<OpcionCatalogo[]>([]);
  /** Vehículo elegido al crear (el del filtro). */
  readonly vehiculoInicial = input('');
  readonly guardar = output<DatosRegistro<GastoVehiculo>>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly tipos = TIPOS_GASTO.map((t) => ({ id: t.id, nombre: t.nombre }));
  protected readonly hoy = fechaIso();

  protected readonly form = this.fb.group({
    vehiculoId: ['', Validators.required],
    tipo: this.fb.control<TipoGasto | ''>('', Validators.required),
    fecha: [fechaIso(), Validators.required],
    valor: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    cantidad: this.fb.control<number | null>(null, [Validators.min(0.01)]),
    kilometraje: this.fb.control<number | null>(null, [Validators.min(0)]),
    proveedor: ['', Validators.maxLength(120)],
    referencia: ['', Validators.maxLength(50)],
    descripcion: ['', Validators.maxLength(300)],
    archivo: this.fb.control<ArchivoAdjunto | null>(null),
  });

  private readonly tipo = toSignal(this.form.controls.tipo.valueChanges, { initialValue: this.form.controls.tipo.value });
  protected readonly esCombustible = computed(() => this.tipo() === 'COMBUSTIBLE');

  constructor() {
    effect(() => {
      const g = this.gasto();
      untracked(() => {
        this.form.reset(
          g
            ? { ...g }
            : { vehiculoId: this.vehiculoInicial(), tipo: '', fecha: fechaIso(), valor: null, cantidad: null, kilometraje: null, proveedor: '', referencia: '', descripcion: '', archivo: null },
        );
      });
    });
    // Los galones son obligatorios en las tanqueadas.
    effect(() => {
      const c = this.form.controls.cantidad;
      c.setValidators(this.esCombustible() ? [Validators.required, Validators.min(0.01)] : [Validators.min(0.01)]);
      c.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected errorFecha(): string | null {
    const c = this.form.controls.fecha;
    if ((c.touched || c.dirty) && c.value > this.hoy) return 'La fecha del gasto no puede ser futura.';
    return mensajeError(c);
  }

  protected enviar(): void {
    if (this.form.invalid || this.form.controls.fecha.value > this.hoy) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardar.emit({
      vehiculoId: v.vehiculoId,
      vehiculo: '',
      tipo: v.tipo as TipoGasto,
      fecha: v.fecha,
      valor: Number(v.valor),
      cantidad: v.cantidad === null || (v.cantidad as unknown) === '' ? null : Number(v.cantidad),
      kilometraje: v.kilometraje === null || (v.kilometraje as unknown) === '' ? null : Math.round(Number(v.kilometraje)),
      proveedor: v.proveedor.trim(),
      referencia: v.referencia.trim(),
      descripcion: v.descripcion.trim(),
      archivo: v.archivo,
    });
  }
}
