import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { distinctUntilChanged } from 'rxjs';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { fechaIso, periodoDe, sumarMeses } from 'src/app/shared/fechas/fechas';
import { mensajeError, posteriorA, telefono } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { Cotizacion, ESTADOS_COTIZACION, EstadoCotizacion, EstudianteCotizado, calcularValores } from '../cotizacion';

/** Estudiante del acudiente elegido, con su colegio (lo trae la página). */
export interface EstudianteParaCotizar extends OpcionCatalogo {
  colegioId: string;
}

/** Opción del selector de colegio para escribir uno que no está registrado. */
const OTRO_COLEGIO = '__otro';

/**
 * Cotización para un acudiente registrado (se eligen acudiente y sus estudiantes; el colegio sale del registro) o
 * para un cliente nuevo (se escriben los nombres y se elige o escribe el colegio). Cada estudiante tiene su propio
 * valor mensual (pueden ser de colegios distintos) y el servicio va de un mes inicial a uno final, como la factura:
 * total = suma mensual × meses.
 */
/** Cada estudiante con valor mensual ≥ 1. */
function valoresValidos(control: AbstractControl<EstudianteCotizado[]>): ValidationErrors | null {
  return control.value.some((e) => !(e.valor >= 1)) ? { valores: true } : null;
}

@Component({
  selector: 'app-cotizacion-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, SelectorBusqueda, Campo, TituloSeccion, CurrencyPipe],
  templateUrl: './cotizacion-formulario.html',
})
export class CotizacionFormulario {
  readonly idFormulario = input.required<string>();
  readonly cotizacion = input<Cotizacion | null>(null);
  readonly modo = input.required<ModoFormulario>();
  readonly acudientes = input<OpcionCatalogo[]>([]);
  /** Estudiantes del acudiente elegido. */
  readonly estudiantesAcudiente = input<EstudianteParaCotizar[]>([]);
  readonly colegios = input<OpcionCatalogo[]>([]);

  readonly guardar = output<DatosRegistro<Cotizacion>>();
  readonly acudienteCambiado = output<string>();

  protected readonly estados = ESTADOS_COTIZACION;
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    fecha: [fechaIso(), Validators.required],
    registrados: this.fb.control(true),
    acudienteId: [''],
    nombreAcudiente: [''],
    telefonoAcudiente: ['', telefono],
    estudiantes: this.fb.control<EstudianteCotizado[]>([], [Validators.minLength(1), valoresValidos]),
    periodoInicio: [periodoDe(), Validators.required],
    periodoFin: [sumarMeses(periodoDe(), 9), Validators.required],
    estado: this.fb.control<EstadoCotizacion>('PENDIENTE', Validators.required),
    observaciones: ['', Validators.maxLength(500)],
  }, { validators: posteriorA('periodoInicio', 'periodoFin', 'rangoMeses', true) });

  // Campos para agregar un estudiante a la tabla (no se guardan directamente).
  protected readonly estudianteElegido = signal('');
  protected readonly nombreNuevo = signal('');
  protected readonly colegioElegido = signal('');
  protected readonly colegioEscrito = signal('');
  protected readonly valorNuevo = signal<number | null>(null);
  protected readonly errorAgregar = signal<string | null>(null);
  protected readonly otroColegio = OTRO_COLEGIO;
  protected readonly opcionesColegio = computed<OpcionCatalogo[]>(() => [...this.colegios(), { id: OTRO_COLEGIO, nombre: 'Otro colegio (escribirlo)' }]);

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly registrados = computed(() => this.valores().registrados ?? true);
  protected readonly lista = computed(() => this.valores().estudiantes ?? []);
  protected readonly calculo = computed(() =>
    calcularValores(this.lista(), this.valores().periodoInicio ?? '', this.valores().periodoFin ?? ''),
  );
  protected readonly disponibles = computed(() => {
    const elegidos = new Set(this.lista().map((e) => e.estudianteId));
    return this.estudiantesAcudiente().filter((o) => !elegidos.has(o.id));
  });

  private reiniciando = false;

  constructor() {
    this.form.controls.acudienteId.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe((id) => {
      if (!this.reiniciando) {
        // Otro acudiente: los estudiantes elegidos eran del anterior.
        this.form.controls.estudiantes.setValue([]);
      }
      this.acudienteCambiado.emit(id);
    });
    this.form.controls.registrados.valueChanges.pipe(takeUntilDestroyed()).subscribe((registrados) => {
      if (this.reiniciando) return;
      this.form.patchValue({ acudienteId: '', nombreAcudiente: '', telefonoAcudiente: '', estudiantes: [] });
      this.ajustarValidaciones(registrados);
    });

    effect(() => {
      const cotizacion = this.cotizacion();
      this.reiniciando = true;
      if (cotizacion) {
        this.form.reset({
          fecha: cotizacion.fecha,
          registrados: cotizacion.registrados,
          acudienteId: cotizacion.acudienteId ?? '',
          nombreAcudiente: cotizacion.nombreAcudiente,
          telefonoAcudiente: cotizacion.telefonoAcudiente,
          estudiantes: cotizacion.estudiantes,
          periodoInicio: cotizacion.periodoInicio,
          periodoFin: cotizacion.periodoFin,
          estado: cotizacion.estado,
          observaciones: cotizacion.observaciones,
        });
      } else {
        this.form.reset();
      }
      this.reiniciando = false;
      this.ajustarValidaciones(this.form.controls.registrados.value);
      if (this.soloLectura()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected errorLista(): string | null {
    const control = this.form.controls.estudiantes;
    if (!control.touched) return null;
    if (control.hasError('minlength') || !control.value.length) return 'Agrega al menos un estudiante a la cotización.';
    return control.hasError('valores') ? 'Cada estudiante necesita un valor mensual mayor que cero.' : null;
  }

  protected errorMeses(): string | null {
    const c = this.form.controls.periodoFin;
    if (c.errors?.['rangoMeses'] && (c.touched || c.dirty)) return 'Debe ser igual o posterior al mes inicial.';
    return this.error('periodoFin');
  }

  /** Colegio del estudiante registrado elegido (sale de su registro). */
  protected readonly colegioDelElegido = computed(() => {
    const e = this.estudiantesAcudiente().find((o) => o.id === this.estudianteElegido());
    return e ? (this.colegios().find((c) => c.id === e.colegioId)?.nombre ?? '') : '';
  });

  protected cambiarValor(indice: number, valor: number | null): void {
    const lista = this.form.controls.estudiantes.value.map((e, i) => (i === indice ? { ...e, valor: Number(valor) || 0 } : e));
    this.form.controls.estudiantes.setValue(lista);
    this.form.controls.estudiantes.markAsTouched();
  }

  protected agregar(): void {
    const actuales = this.form.controls.estudiantes.value;
    const valor = Number(this.valorNuevo()) || 0;
    let nuevo: EstudianteCotizado;
    if (this.registrados()) {
      const opcion = this.estudiantesAcudiente().find((o) => o.id === this.estudianteElegido());
      if (!opcion) {
        this.errorAgregar.set('Elige un estudiante del acudiente.');
        return;
      }
      if (valor < 1) {
        this.errorAgregar.set('Escribe el valor mensual del estudiante.');
        return;
      }
      nuevo = {
        estudianteId: opcion.id,
        nombre: opcion.nombre,
        colegioId: opcion.colegioId || null,
        nombreColegio: this.colegioDelElegido(),
        valor,
      };
    } else {
      const nombre = this.nombreNuevo().trim().replace(/\s+/g, ' ');
      if (nombre.length < 3) {
        this.errorAgregar.set('Escribe el nombre del estudiante.');
        return;
      }
      if (actuales.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase())) {
        this.errorAgregar.set('Ese estudiante ya está en la cotización.');
        return;
      }
      const colegioId = this.colegioElegido();
      const escrito = this.colegioEscrito().trim().replace(/\s+/g, ' ');
      if (!colegioId || (colegioId === OTRO_COLEGIO && escrito.length < 3)) {
        this.errorAgregar.set(colegioId ? 'Escribe el nombre del colegio.' : 'Elige el colegio del estudiante.');
        return;
      }
      if (valor < 1) {
        this.errorAgregar.set('Escribe el valor mensual del estudiante.');
        return;
      }
      const registrado = colegioId !== OTRO_COLEGIO;
      nuevo = {
        estudianteId: null,
        nombre,
        colegioId: registrado ? colegioId : null,
        nombreColegio: registrado ? (this.colegios().find((c) => c.id === colegioId)?.nombre ?? '') : escrito,
        valor,
      };
    }
    this.errorAgregar.set(null);
    this.form.controls.estudiantes.setValue([...actuales, nuevo]);
    this.form.controls.estudiantes.markAsTouched();
    this.estudianteElegido.set('');
    this.nombreNuevo.set('');
    this.colegioEscrito.set('');
    // El colegio y el valor se conservan: suelen repetirse entre hermanos.
  }

  protected quitar(indice: number): void {
    this.form.controls.estudiantes.setValue(this.form.controls.estudiantes.value.filter((_, i) => i !== indice));
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const nombreAcudiente = v.registrados
      ? (this.acudientes().find((a) => a.id === v.acudienteId)?.nombre ?? v.nombreAcudiente)
      : v.nombreAcudiente.trim();
    this.guardar.emit({
      ...v,
      numero: this.cotizacion()?.numero ?? '',
      acudienteId: v.registrados ? v.acudienteId : null,
      nombreAcudiente,
      telefonoAcudiente: v.telefonoAcudiente.trim(),
      ...calcularValores(v.estudiantes, v.periodoInicio, v.periodoFin),
      facturas: this.cotizacion()?.facturas ?? [],
      observaciones: v.observaciones.trim(),
    });
  }

  private ajustarValidaciones(registrados: boolean): void {
    const { acudienteId, nombreAcudiente } = this.form.controls;
    acudienteId.setValidators(registrados ? Validators.required : null);
    nombreAcudiente.setValidators(registrados ? null : [Validators.required, Validators.maxLength(100)]);
    acudienteId.updateValueAndValidity({ emitEvent: false });
    nombreAcudiente.updateValueAndValidity({ emitEvent: false });
  }
}
