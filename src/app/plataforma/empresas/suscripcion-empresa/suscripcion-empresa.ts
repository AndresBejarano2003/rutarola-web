import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import {
  ESTADOS_PAGO,
  ESTADOS_SUSCRIPCION,
  EstadoSuscripcion,
  PLANES,
  PagoSuscripcion,
  PeriodoPago,
  PlanSuscripcion,
  Suscripcion,
  nombrePlan,
} from 'src/app/sistema/membresias/suscripcion';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';

/** `YYYY-MM-DD` local de una fecha ISO (para `<input type="date">`). */
function fechaLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Plan de UNA empresa en Plataforma › Empresas: estado, vigencia, uso y pagos en línea, y el ajuste manual
 * (convenio, pago por transferencia, extender la prueba). Va FUERA del `<form>` de la empresa.
 */
@Component({
  selector: 'app-suscripcion-empresa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, Campo, SelectorBusqueda],
  templateUrl: './suscripcion-empresa.html',
})
export class SuscripcionEmpresa {
  readonly empresaId = input.required<string>();
  /** Se ajustó el plan (la tabla de empresas refresca su membresía). */
  readonly cambio = output<void>();

  private readonly repositorio = inject(SuscripcionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly planes = PLANES.map((p) => ({ id: p.id, nombre: p.nombre }));
  protected readonly estados = ESTADOS_SUSCRIPCION;
  protected readonly periodos = [
    { id: 'MENSUAL', nombre: 'Mensual' },
    { id: 'ANUAL', nombre: 'Anual' },
  ];
  protected readonly estadosPago = ESTADOS_PAGO;
  protected readonly nombrePlan = nombrePlan;

  protected readonly suscripcion = signal<Suscripcion | null>(null);
  protected readonly pagos = signal<PagoSuscripcion[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly editando = signal(false);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.group({
    plan: this.fb.control<PlanSuscripcion>('PROFESIONAL', Validators.required),
    estado: this.fb.control<EstadoSuscripcion>('PRUEBA', Validators.required),
    periodo: this.fb.control<PeriodoPago | ''>(''),
    fechaFin: [''],
    nota: ['', Validators.maxLength(500)],
    codigoPromocional: ['', Validators.maxLength(30)],
  });
  protected readonly estadoForm = toSignal(this.form.controls.estado.valueChanges, { initialValue: this.form.controls.estado.value });
  protected readonly conVigencia = computed(() => this.estadoForm() !== 'GRATIS');

  constructor() {
    effect(() => {
      const id = this.empresaId();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    try {
      const [s, pagos] = await Promise.all([firstValueFrom(this.repositorio.deEmpresa(id)), firstValueFrom(this.repositorio.pagosDeEmpresa(id))]);
      this.suscripcion.set(s);
      this.pagos.set(pagos);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  protected editar(): void {
    const s = this.suscripcion();
    if (!s) return;
    this.form.reset({ plan: s.plan, estado: s.estado, periodo: s.periodo, fechaFin: fechaLocal(s.fechaFin), nota: s.nota, codigoPromocional: '' });
    this.editando.set(true);
  }

  protected errorDe(campo: 'fechaFin' | 'nota' | 'codigoPromocional'): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected async guardar(): Promise<void> {
    const v = this.form.getRawValue();
    const fechaFin = this.form.controls.fechaFin;
    if (v.estado === 'GRATIS') {
      this.form.controls.plan.setValue('GRATIS');
    } else if (!v.fechaFin) {
      fechaFin.setErrors({ required: true });
      fechaFin.markAsTouched();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      const final = this.form.getRawValue();
      // Fin del día elegido (hora local).
      const fin = final.estado === 'GRATIS' ? '' : new Date(`${final.fechaFin}T23:59:59`).toISOString();
      this.suscripcion.set(
        await firstValueFrom(
          this.repositorio.ajustar(this.empresaId(), {
            ...final,
            periodo: final.estado === 'ACTIVA' ? final.periodo || 'MENSUAL' : '',
            fechaFin: fin,
            codigoPromocional: final.estado === 'ACTIVA' ? final.codigoPromocional.trim().toUpperCase() : '',
          }),
        ),
      );
      this.editando.set(false);
      this.avisos.exito('Plan de la empresa actualizado.');
      this.cambio.emit();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
