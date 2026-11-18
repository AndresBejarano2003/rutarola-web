import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { distinctUntilChanged } from 'rxjs';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ErrorCrud, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { fechaIso, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { fechaNoFutura, mensajeError } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { AplicacionRecibo, ResultadoPago, simularPago, unirMeses } from '../../cuotas';
import { CuotaFactura, Factura } from '../../facturas/factura';
import { ESTADOS_RECIBO, MEDIOS_PAGO, MedioPago, Recibo, mesesRecibo } from '../recibo';

/** Vista previa del pago: cómo quedaría o por qué no se puede registrar. */
type VistaPrevia = { ok: true; resultado: ResultadoPago } | { ok: false; mensaje: string } | null;

/**
 * Registro de un pago. Al elegir la factura, la página entrega sus cuotas (valor, pagado y saldo por mes; sin este
 * recibo al editarlo). El pago se aplica a VARIOS meses elegidos o como abono al saldo de la factura (los meses más
 * antiguos primero). El valor se sugiere con el saldo de lo elegido y, si no alcanza, se avisa cuántos meses quedan
 * cancelados, cuánto se abona a cuál y cuáles siguen pendientes. Las reglas son las de `finanzas/cuotas.ts` (= API).
 */
@Component({
  selector: 'app-recibo-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, Campo, TituloSeccion, CurrencyPipe],
  templateUrl: './recibo-formulario.html',
})
export class ReciboFormulario {
  readonly idFormulario = input.required<string>();
  readonly recibo = input<Recibo | null>(null);
  readonly modo = input.required<ModoFormulario>();
  readonly facturas = input<OpcionCatalogo[]>([]);
  /** Factura elegida (completa) y sus cuotas sin contar este recibo. */
  readonly factura = input<Factura | null>(null);
  readonly cuotas = input<CuotaFactura[]>([]);

  readonly guardar = output<DatosRegistro<Recibo>>();
  readonly facturaCambiada = output<string>();

  protected readonly medios = MEDIOS_PAGO;
  protected readonly estados = ESTADOS_RECIBO;
  protected readonly hoy = fechaIso();
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');
  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly unirMeses = unirMeses;

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    facturaId: ['', Validators.required],
    aplicacion: this.fb.control<AplicacionRecibo>('MESES'),
    periodos: this.fb.control<string[]>([]),
    fechaPago: [fechaIso(), [Validators.required, fechaNoFutura]],
    valor: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    medioPago: this.fb.control<MedioPago | ''>('', Validators.required),
    referencia: ['', Validators.maxLength(40)],
    estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
    observaciones: ['', Validators.maxLength(300)],
  });

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly aplicacion = computed(() => this.valores().aplicacion ?? 'MESES');
  protected readonly elegidos = computed(() => this.valores().periodos ?? []);
  /** Meses con saldo (los que se pueden pagar o abonar). */
  protected readonly pendientes = computed(() => this.cuotas().filter((c) => c.saldo > 0));
  protected readonly pagadas = computed(() => this.cuotas().filter((c) => c.saldo <= 0).length);
  protected readonly saldoFactura = computed(() => this.pendientes().reduce((s, c) => s + c.saldo, 0));
  protected readonly saldoElegido = computed(() => {
    const elegidos = new Set(this.elegidos());
    return this.cuotas().filter((c) => elegidos.has(c.periodo)).reduce((s, c) => s + c.saldo, 0);
  });
  /** Lo que se sugiere pagar: el saldo de los meses elegidos (o de la factura al abonar). */
  protected readonly sugerido = computed(() => (this.aplicacion() === 'MESES' ? this.saldoElegido() : this.saldoFactura()));

  protected readonly vistaPrevia = computed<VistaPrevia>(() => {
    const factura = this.factura();
    const valor = Number(this.valores().valor) || 0;
    if (!factura || valor < 1 || this.soloLectura()) return null;
    if (this.aplicacion() === 'MESES' && !this.elegidos().length) return null;
    try {
      return { ok: true, resultado: simularPago(this.cuotas(), valor, this.aplicacion(), this.elegidos(), factura.numero) };
    } catch (e) {
      return { ok: false, mensaje: e instanceof ErrorCrud ? e.message : 'No se puede aplicar este pago.' };
    }
  });

  /** En consulta: cómo se aplicó el recibo. */
  protected readonly aplicado = computed(() => {
    const r = this.recibo();
    return r ? mesesRecibo(r) : [];
  });

  private reiniciando = false;

  constructor() {
    this.form.controls.facturaId.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe((id) => {
      if (!this.reiniciando) this.form.patchValue({ periodos: [], valor: null });
      this.facturaCambiada.emit(id);
    });

    // Mientras el usuario no escriba el valor, se sugiere el saldo de lo elegido.
    effect(() => {
      const sugerido = this.sugerido();
      untracked(() => {
        const valor = this.form.controls.valor;
        if (!this.soloLectura() && !valor.dirty && !this.reiniciando && sugerido > 0) valor.setValue(sugerido);
      });
    });

    effect(() => {
      const recibo = this.recibo();
      this.reiniciando = true;
      if (recibo) {
        this.form.reset({
          facturaId: recibo.facturaId,
          aplicacion: recibo.aplicacion ?? 'MESES',
          periodos: recibo.periodos?.length ? recibo.periodos : recibo.aplicacion === 'SALDO' ? [] : mesesRecibo(recibo).map((m) => m.periodo),
          fechaPago: recibo.fechaPago,
          valor: recibo.valor,
          medioPago: recibo.medioPago,
          referencia: recibo.referencia,
          estado: recibo.estado,
          observaciones: recibo.observaciones,
        });
        // Al editar se conserva el valor registrado (no se reemplaza por el sugerido).
        this.form.controls.valor.markAsDirty();
      } else {
        this.form.reset();
      }
      this.reiniciando = false;
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

  protected elegirAplicacion(aplicacion: AplicacionRecibo): void {
    this.form.patchValue({ aplicacion });
    if (!this.form.controls.valor.dirty) this.form.controls.valor.setValue(this.sugerido() || null);
  }

  protected alternarMes(periodo: string): void {
    const actuales = this.form.controls.periodos.value;
    const periodos = actuales.includes(periodo) ? actuales.filter((p) => p !== periodo) : [...actuales, periodo].sort();
    this.form.controls.periodos.setValue(periodos);
    this.form.controls.periodos.markAsTouched();
  }

  /** Elige todos los meses con saldo hasta el actual (vencidos y del mes). */
  protected elegirExigibles(): void {
    this.form.controls.periodos.setValue(this.pendientes().filter((c) => c.estado !== 'PROGRAMADA').map((c) => c.periodo));
  }

  protected usarSugerido(): void {
    this.form.controls.valor.setValue(this.sugerido());
  }

  protected errorMeses(): string | null {
    const c = this.form.controls.periodos;
    return this.aplicacion() === 'MESES' && c.touched && !c.value.length ? 'Elige al menos un mes a pagar.' : null;
  }

  protected enviar(): void {
    const v = this.form.getRawValue();
    if (this.form.invalid || (v.aplicacion === 'MESES' && !v.periodos.length)) {
      this.form.markAllAsTouched();
      return;
    }
    const previa = this.vistaPrevia();
    if (previa && !previa.ok) return; // El mensaje ya está a la vista.
    const factura = this.factura();
    const actual = this.recibo();
    const periodos = v.aplicacion === 'MESES' ? v.periodos : [];
    this.guardar.emit({
      ...v,
      periodos,
      periodo: periodos[0] ?? (previa?.ok ? (previa.resultado.lineas[0]?.periodo ?? '') : (actual?.periodo ?? '')),
      numero: actual?.numero ?? '',
      numeroFactura: factura?.numero ?? actual?.numeroFactura ?? '',
      nombreAcudiente: factura?.nombreAcudiente ?? actual?.nombreAcudiente ?? '',
      nombreEstudiante: factura?.nombreEstudiante ?? actual?.nombreEstudiante ?? '',
      valor: v.valor ?? 0,
      medioPago: v.medioPago as MedioPago,
      referencia: v.referencia.trim(),
      observaciones: v.observaciones.trim(),
    });
  }
}
