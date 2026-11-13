import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { DatosRegistro, ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { mensajeError, placa } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { BadgeVencimiento } from 'src/app/shared/vencimiento/vencimiento';
import { CampoFoto } from 'src/app/shared/foto/campo-foto';
import { DOCUMENTOS_VEHICULO, TIPOS_VEHICULO, TipoVehiculo, Vehiculo } from '../vehiculo';

const ANIO_ACTUAL = new Date().getFullYear();

/**
 * Foto y datos del vehículo y vencimiento de sus documentos (cambiar una fecha agrega el registro al historial de
 * documentos). Botones en el pie del modal.
 */
@Component({
  selector: 'app-vehiculo-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, Campo, TituloSeccion, BadgeVencimiento, CampoFoto],
  templateUrl: './vehiculo-formulario.html',
})
export class VehiculoFormulario {
  readonly idFormulario = input.required<string>();
  readonly vehiculo = input<Vehiculo | null>(null);
  readonly modo = input.required<ModoFormulario>();
  readonly guardar = output<DatosRegistro<Vehiculo>>();

  protected readonly tipos = TIPOS_VEHICULO;
  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly documentos = DOCUMENTOS_VEHICULO;
  protected readonly anioMaximo = ANIO_ACTUAL + 1;
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    placa: ['', [Validators.required, placa]],
    numeroInterno: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{1,10}$/)]],
    tipo: this.fb.control<TipoVehiculo | ''>('', Validators.required),
    marca: ['', [Validators.required, Validators.maxLength(40)]],
    linea: ['', Validators.maxLength(40)],
    modelo: this.fb.control<number | null>(null, [Validators.required, Validators.min(1990), Validators.max(ANIO_ACTUAL + 1)]),
    color: ['', Validators.maxLength(30)],
    capacidad: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(80)]),
    vencimientoSoat: ['', Validators.required],
    vencimientoTecnomecanica: ['', Validators.required],
    vencimientoTarjetaOperacion: ['', Validators.required],
    vencimientoPolizas: ['', Validators.required],
    estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
    observaciones: ['', Validators.maxLength(500)],
    foto: [''],
  });

  /** Valores en vivo para mostrar el estado de cada documento al lado de la fecha. */
  protected readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  constructor() {
    effect(() => {
      const vehiculo = this.vehiculo();
      if (vehiculo) {
        const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = vehiculo;
        this.form.reset({ ...datos, foto: datos.foto ?? '' });
      } else {
        this.form.reset();
      }
      if (this.soloLectura()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected fecha(campo: (typeof DOCUMENTOS_VEHICULO)[number]['campo']): string {
    return this.valores()[campo] ?? this.form.controls[campo].value;
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardar.emit({
      ...v,
      placa: v.placa.replace(/[\s-]/g, '').toUpperCase(),
      numeroInterno: v.numeroInterno.trim(),
      tipo: v.tipo as TipoVehiculo,
      marca: v.marca.trim(),
      linea: v.linea.trim(),
      modelo: v.modelo ?? ANIO_ACTUAL,
      color: v.color.trim(),
      capacidad: v.capacidad ?? 0,
      observaciones: v.observaciones.trim(),
    });
  }
}
