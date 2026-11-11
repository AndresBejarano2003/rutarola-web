import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { DatosRegistro, ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { mensajeError, posteriorA } from 'src/app/shared/formularios/formularios';
import { ListaSeleccion } from 'src/app/shared/lista-seleccion/lista-seleccion';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { PLANES, PeriodoPago, PlanSuscripcion } from 'src/app/sistema/membresias/suscripcion';
import {
  ALCANCES_CODIGO,
  AlcanceCodigo,
  CodigoPromocional,
  PATRON_CODIGO,
  PATRON_PREFIJO,
  TIPOS_DESCUENTO,
  TipoDescuento,
  descuentoCodigo,
  generarCodigo,
  normalizarCodigo,
} from '../codigo-promocional';

/** Al menos una empresa cuando el alcance es EMPRESAS (se valida en el grupo). */
function empresasSiAplica(grupo: AbstractControl): ValidationErrors | null {
  const control = grupo.get('empresaIds');
  const falta = grupo.get('alcance')?.value === 'EMPRESAS' && !(control?.value as string[] | undefined)?.length;
  const { requerido: _previo, ...otros } = control?.errors ?? {};
  control?.setErrors(falta ? { ...otros, requerido: true } : Object.keys(otros).length ? otros : null);
  return null;
}

/** Campos del código promocional (los botones van en el pie del modal). */
@Component({
  selector: 'app-codigo-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe, Campo, TituloSeccion, SelectorBusqueda, ListaSeleccion],
  templateUrl: './codigo-formulario.html',
})
export class CodigoFormulario {
  readonly idFormulario = input.required<string>();
  readonly codigo = input<CodigoPromocional | null>(null);
  readonly modo = input.required<ModoFormulario>();
  readonly empresas = input<OpcionCatalogo[]>([]);
  readonly guardar = output<DatosRegistro<CodigoPromocional>>();

  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly tipos = TIPOS_DESCUENTO;
  protected readonly alcances = ALCANCES_CODIGO;
  protected readonly planesDePago = PLANES.filter((p) => p.precioMensual > 0);
  protected readonly periodos: { id: PeriodoPago; nombre: string }[] = [
    { id: 'MENSUAL', nombre: 'Solo mensual' },
    { id: 'ANUAL', nombre: 'Solo anual' },
  ];
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group(
    {
      /** Al crear: true = lo genera el sistema al guardar (con el prefijo opcional). */
      generar: [true],
      prefijo: ['', Validators.pattern(PATRON_PREFIJO)],
      codigo: [''],
      descripcion: ['', Validators.maxLength(200)],
      tipoDescuento: this.fb.control<TipoDescuento>('PORCENTAJE'),
      valor: this.fb.control<number | null>(20, [Validators.required, Validators.min(1)]),
      fechaInicio: [fechaIso(), Validators.required],
      fechaFin: ['', Validators.required],
      alcance: this.fb.control<AlcanceCodigo>('TODAS'),
      empresaIds: this.fb.control<string[]>([]),
      planes: this.fb.control<PlanSuscripcion[]>([]),
      periodo: this.fb.control<PeriodoPago | ''>(''),
      usosMaximos: this.fb.control<number | null>(null, Validators.min(1)),
      usosPorEmpresa: this.fb.control<number | null>(1, [Validators.required, Validators.min(1), Validators.max(120)]),
      estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
    },
    { validators: [posteriorA('fechaInicio', 'fechaFin', 'rango', true), empresasSiAplica] },
  );

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly tipo = computed(() => this.valores().tipoDescuento ?? 'PORCENTAJE');
  protected readonly alcance = computed(() => this.valores().alcance ?? 'TODAS');
  protected readonly planesElegidos = computed(() => this.valores().planes ?? []);
  protected readonly creando = computed(() => this.modo() === 'crear');
  /** El sistema genera el código (solo al crear). */
  protected readonly automatico = computed(() => this.creando() && (this.valores().generar ?? true));
  protected readonly ejemploCodigo = computed(() => {
    const p = (this.valores().prefijo ?? '').toUpperCase();
    return p ? `${p}-7KQ9M2XT` : '7KQ9-M2XT';
  });
  /** Ejemplo en vivo con el primer plan al que aplica (mensual). */
  protected readonly ejemplo = computed(() => {
    const v = this.valores();
    const plan = this.planesDePago.find((p) => !v.planes?.length || v.planes.includes(p.id)) ?? this.planesDePago[0];
    const descuento = descuentoCodigo(v.tipoDescuento ?? 'PORCENTAJE', Number(v.valor) || 0, plan.precioMensual, plan.precioMensual);
    return { plan: plan.nombre, precio: plan.precioMensual, descuento, total: plan.precioMensual - descuento };
  });

  constructor() {
    effect(() => {
      const c = this.codigo();
      if (c) {
        this.form.reset({
          generar: false,
          codigo: c.codigo,
          descripcion: c.descripcion,
          tipoDescuento: c.tipoDescuento,
          valor: c.valor,
          fechaInicio: c.fechaInicio,
          fechaFin: c.fechaFin,
          alcance: c.alcance,
          empresaIds: c.empresaIds,
          planes: c.planes,
          periodo: c.periodo,
          usosMaximos: c.usosMaximos,
          usosPorEmpresa: c.usosPorEmpresa,
          estado: c.estado,
        });
      } else {
        const fin = new Date();
        fin.setDate(fin.getDate() + 30);
        this.form.reset({ fechaInicio: fechaIso(), fechaFin: fechaIso(fin) });
      }
      if (this.soloLectura()) this.form.disable();
      else this.form.enable();
      this.ajustarCodigo();
    });
    this.form.controls.generar.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.ajustarCodigo());
    // El tope del valor depende del tipo: 100 % o $10.000.000.
    this.form.controls.tipoDescuento.valueChanges.pipe(takeUntilDestroyed()).subscribe((t) => {
      this.form.controls.valor.setValidators([Validators.required, Validators.min(t === 'PORCENTAJE' ? 1 : 1000), Validators.max(t === 'PORCENTAJE' ? 100 : 10_000_000)]);
      this.form.controls.valor.updateValueAndValidity();
    });
  }

  /** Código obligatorio solo si lo escribe el administrador (o al editar). */
  private ajustarCodigo(): void {
    const codigo = this.form.controls.codigo;
    const automatico = this.modo() === 'crear' && this.form.controls.generar.value;
    codigo.setValidators(automatico ? null : [Validators.required, Validators.pattern(PATRON_CODIGO)]);
    codigo.updateValueAndValidity({ emitEvent: false });
  }

  /** "Escribirlo yo" con una sugerencia aleatoria que se puede cambiar. */
  protected sugerir(): void {
    this.form.controls.codigo.setValue(generarCodigo(this.form.controls.prefijo.value));
    this.form.controls.codigo.markAsDirty();
  }

  protected prefijoMayusculas(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const valor = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (valor !== campo.value) this.form.controls.prefijo.setValue(valor);
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[campo];
    if (campo === 'prefijo' && control.errors?.['pattern']) return 'Hasta 12 letras o números, sin espacios ni guiones.';
    if (campo === 'codigo' && control.errors?.['pattern'] && control.touched) return 'De 4 a 30 letras, números o guiones, sin espacios.';
    if (campo === 'empresaIds' && control.errors?.['requerido'] && (control.touched || this.form.touched)) return 'Elige al menos una empresa.';
    if (campo === 'fechaFin' && control.errors?.['rango'] && control.touched) return 'Debe ser igual o posterior a la fecha inicial.';
    return mensajeError(control);
  }

  protected mayusculas(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const valor = campo.value.toUpperCase().replace(/\s+/g, '');
    if (valor !== campo.value) this.form.controls.codigo.setValue(valor);
  }

  protected alternarPlan(plan: PlanSuscripcion): void {
    const actuales = this.form.controls.planes.value;
    this.form.controls.planes.setValue(actuales.includes(plan) ? actuales.filter((p) => p !== plan) : [...actuales, plan]);
    this.form.controls.planes.markAsDirty();
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { generar: _generar, prefijo, ...v } = this.form.getRawValue();
    const automatico = this.automatico();
    this.guardar.emit({
      ...v,
      codigo: automatico ? '' : normalizarCodigo(v.codigo),
      prefijo: automatico ? prefijo : '',
      descripcion: v.descripcion.trim(),
      valor: Number(v.valor),
      usosMaximos: v.usosMaximos ? Number(v.usosMaximos) : null,
      usosPorEmpresa: Number(v.usosPorEmpresa),
      empresaIds: v.alcance === 'EMPRESAS' ? v.empresaIds : [],
    });
  }
}
