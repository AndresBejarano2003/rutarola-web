import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { mensajeError, posteriorA } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { Asignacion } from '../asignacion';

/** Opciones de los selectores (vienen de rutas, vehículos y empleados). */
export interface OpcionesAsignacion {
  rutas: OpcionCatalogo[];
  vehiculos: OpcionCatalogo[];
  conductores: OpcionCatalogo[];
  monitoras: OpcionCatalogo[];
}

/** Horario: las dos horas o ninguna (error `incompleto` en la que falta). */
const horarioCompleto: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const inicio = grupo.get('horaInicio');
  const fin = grupo.get('horaFin');
  if (!inicio || !fin) return null;
  for (const [control, otro] of [[inicio, fin], [fin, inicio]] as const) {
    const { incompleto: _previo, ...otros } = control.errors ?? {};
    const errores = !control.value && !!otro.value ? { ...otros, incompleto: true } : otros;
    control.setErrors(Object.keys(errores).length ? errores : null);
  }
  return null;
};

@Component({
  selector: 'app-asignacion-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, Campo, TituloSeccion],
  templateUrl: './asignacion-formulario.html',
})
export class AsignacionFormulario {
  readonly idFormulario = input.required<string>();
  readonly asignacion = input<Asignacion | null>(null);
  readonly modo = input.required<ModoFormulario>();
  readonly opciones = input.required<OpcionesAsignacion>();
  readonly guardar = output<DatosRegistro<Asignacion>>();

  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group(
    {
      rutaId: ['', Validators.required],
      vehiculoId: ['', Validators.required],
      conductorId: ['', Validators.required],
      monitoraId: [''],
      fechaInicio: ['', Validators.required],
      fechaFin: [''],
      horaInicio: [''],
      horaFin: [''],
      estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
      observaciones: ['', Validators.maxLength(500)],
    },
    { validators: [posteriorA('fechaInicio', 'fechaFin', 'rango', true), posteriorA('horaInicio', 'horaFin'), horarioCompleto] },
  );

  protected readonly monitoras = computed(() => [{ id: '', nombre: 'Sin monitora' }, ...this.opciones().monitoras]);

  constructor() {
    effect(() => {
      const asignacion = this.asignacion();
      if (asignacion) {
        const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = asignacion;
        this.form.reset({ ...datos, horaInicio: datos.horaInicio ?? '', horaFin: datos.horaFin ?? '' });
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

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardar.emit({ ...v, observaciones: v.observaciones.trim() });
  }
}
