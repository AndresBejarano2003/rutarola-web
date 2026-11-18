import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, firstValueFrom, of, switchMap } from 'rxjs';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { fechaCorta, nombrePeriodo, periodoDe, periodosEntre, sumarMeses } from 'src/app/shared/fechas/fechas';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { CuotaFactura, Factura } from '../factura';
import { FacturasRepositorio } from '../facturas-repositorio';

const ESTADOS: Record<CuotaFactura['estado'], { nombre: string; clase: string }> = {
  PAGADA: { nombre: 'Pagada', clase: 'badge-success' },
  VENCIDA: { nombre: 'Vencida', clase: 'badge-error' },
  PENDIENTE: { nombre: 'Pendiente', clase: 'badge-warning' },
  PROGRAMADA: { nombre: 'Programada', clase: 'bg-base-300' },
};

/**
 * Estado de cuenta de la factura en su detalle: cada mes que se cobra con lo pagado (abonos incluidos) y el saldo, y
 * el RETIRO del estudiante o del acudiente: desde el mes elegido la factura ya no cobra los meses que faltan (los
 * meses con pagos no se pueden retirar). También se registra solo al inactivar al estudiante o al acudiente.
 */
@Component({
  selector: 'app-cuenta-factura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, ReactiveFormsModule, Modal, Campo, SelectorBusqueda],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="titulo-cuenta-factura">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 id="titulo-cuenta-factura" class="text-info uppercase text-xs font-semibold tracking-wide">Estado de cuenta</h4>
        @if (factura().estado === 'ACTIVO') {
          <div class="flex flex-wrap gap-2">
            @if (factura().periodoRetiro) {
              <button type="button" class="btn btn-sm btn-ghost" [disabled]="guardando()" (click)="quitarRetiro()">
                <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Quitar retiro
              </button>
            }
            @if (opcionesRetiro().length) {
              <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="abrirRetiro()">
                <i class="fa-solid fa-user-minus text-warning" aria-hidden="true"></i>
                {{ factura().periodoRetiro ? 'Cambiar retiro' : 'Registrar retiro' }}
              </button>
            }
          </div>
        }
      </div>

      @if (factura().periodoRetiro) {
        <div role="status" class="alert alert-warning alert-soft text-sm">
          <i class="fa-solid fa-user-minus" aria-hidden="true"></i>
          <span>
            Retiro desde <span class="font-medium">{{ nombrePeriodo(factura().periodoRetiro!, true) }}</span>: esos meses ya no se cobran.
            @if (factura().motivoRetiro) {
              <span class="text-base-content/80">Motivo: {{ factura().motivoRetiro }}</span>
            }
          </span>
        </div>
      }

      <div class="grid grid-cols-3 gap-2 text-sm">
        <div class="rounded-box border border-base-300 px-3 py-2"><div class="text-base-content/70 text-xs">Total</div>
          <div class="font-semibold">{{ resumen().total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</div></div>
        <div class="rounded-box border border-base-300 px-3 py-2"><div class="text-base-content/70 text-xs">Pagado</div>
          <div class="font-semibold">{{ resumen().pagado | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</div></div>
        <div class="rounded-box border border-base-300 px-3 py-2"><div class="text-base-content/70 text-xs">Saldo</div>
          <div class="font-semibold">{{ resumen().saldo | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</div></div>
      </div>

      <div class="@container overflow-x-auto rounded-box border border-base-300">
        <table class="table table-sm">
          <thead>
            <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
              <th>Mes</th>
              <th class="hidden @md:table-cell">Fecha límite</th>
              <th class="text-right">Pagado</th>
              <th class="text-right">Saldo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (c of cuotas(); track c.periodo) {
              <tr class="border-base-300">
                <td class="capitalize whitespace-nowrap">{{ nombrePeriodo(c.periodo, true) }}</td>
                <td class="hidden @md:table-cell whitespace-nowrap">{{ fechaCorta(c.fechaLimite) }}</td>
                <td class="text-right whitespace-nowrap">{{ c.pagado | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td class="text-right whitespace-nowrap font-medium">{{ c.saldo | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td>
                  <span class="badge badge-soft badge-sm {{ estados[c.estado].clase }}">{{ estados[c.estado].nombre }}</span>
                  @if (c.pagado > 0 && c.saldo > 0) {
                    <span class="badge badge-soft badge-info badge-sm ml-1">Abono</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="text-center text-base-content/70 py-4">
                  {{ factura().estado === 'ACTIVO' ? 'Esta factura no cobra ningún mes.' : 'La factura está anulada: no tiene cuotas por cobrar.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <app-modal [(abierto)]="retiroAbierto" titulo="Registrar retiro" [subtitulo]="factura().numero + ' · ' + factura().nombreEstudiante" ancho="max-w-lg">
      @if (retiroAbierto()) {
        <form id="form-retiro-factura" [formGroup]="form" (ngSubmit)="guardarRetiro()" novalidate class="flex flex-col gap-3">
          <p class="text-sm text-base-content/70">
            Desde el mes elegido la factura deja de cobrar (no se cobran los meses que faltan). Los meses ya pagados se conservan.
          </p>
          <div app-campo etiqueta="Deja de cobrar desde" requerido [error]="error('periodoRetiro')">
            <app-selector-busqueda formControlName="periodoRetiro" [opciones]="opcionesRetiro()" etiqueta="Mes del retiro"
              [invalido]="!!error('periodoRetiro')" />
          </div>
          <label app-campo etiqueta="Motivo del retiro" requerido [error]="error('motivo')">
            <textarea formControlName="motivo" rows="2" maxlength="300" class="textarea textarea-bordered bg-base-100 border-neutral w-full"
              [class.textarea-error]="!!error('motivo')" placeholder="Cambio de colegio, traslado de ciudad…"></textarea>
          </label>
        </form>
      }
      @if (retiroAbierto()) {
        <div pie class="flex flex-wrap justify-end gap-2 w-full">
          <button type="button" class="btn btn-ghost" [disabled]="guardando()" (click)="retiroAbierto.set(false)">Cancelar</button>
          <button type="submit" form="form-retiro-factura" class="btn btn-primary" [disabled]="guardando()">
            @if (guardando()) {
              <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
            }
            Registrar retiro
          </button>
        </div>
      }
    </app-modal>
  `,
})
export class CuentaFactura {
  readonly factura = input.required<Factura>();
  /** La factura cambió (retiro registrado o quitado). */
  readonly cambio = output<Factura>();

  private readonly repositorio = inject(FacturasRepositorio);
  private readonly avisos = inject(NotificacionesService);
  protected readonly estados = ESTADOS;
  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly fechaCorta = fechaCorta;
  protected readonly guardando = signal(false);
  protected readonly retiroAbierto = signal(false);

  protected readonly cuotas = toSignal(
    toObservable(this.factura).pipe(switchMap((f) => this.repositorio.cuotas(f.id).pipe(catchError(() => of<CuotaFactura[]>([]))))),
    { initialValue: [] },
  );
  protected readonly resumen = computed(() => {
    const cuotas = this.cuotas();
    return {
      total: cuotas.reduce((s, c) => s + c.valor, 0),
      pagado: cuotas.reduce((s, c) => s + Math.min(c.pagado, c.valor), 0),
      saldo: cuotas.reduce((s, c) => s + c.saldo, 0),
    };
  });

  /** Meses posibles del retiro: del segundo al último, después del último mes con pagos. */
  protected readonly opcionesRetiro = computed(() => {
    const f = this.factura();
    const conPago = this.cuotas().filter((c) => c.pagado > 0).map((c) => c.periodo).sort();
    const desde = [sumarMeses(f.periodoInicio, 1), conPago.length ? sumarMeses(conPago[conPago.length - 1], 1) : ''].sort().at(-1)!;
    return desde > f.periodoFin ? [] : periodosEntre(desde, f.periodoFin).map((p) => ({ id: p, nombre: nombrePeriodo(p, true) }));
  });

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    periodoRetiro: ['', Validators.required],
    motivo: ['', [Validators.required, Validators.maxLength(300)]],
  });

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected abrirRetiro(): void {
    const opciones = this.opcionesRetiro();
    const siguiente = sumarMeses(periodoDe(), 1);
    const sugerido = opciones.find((o) => o.id >= siguiente)?.id ?? opciones[0]?.id ?? '';
    this.form.reset({ periodoRetiro: this.factura().periodoRetiro || sugerido, motivo: this.factura().motivoRetiro ?? '' });
    this.retiroAbierto.set(true);
  }

  protected async guardarRetiro(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { periodoRetiro, motivo } = this.form.getRawValue();
    if (await this.aplicar(periodoRetiro, motivo.trim(), `Retiro registrado: desde ${nombrePeriodo(periodoRetiro, true)} ya no se cobra.`)) {
      this.retiroAbierto.set(false);
    }
  }

  protected quitarRetiro(): Promise<boolean> {
    return this.aplicar('', '', 'Se quitó el retiro: la factura vuelve a cobrar todos sus meses.');
  }

  private async aplicar(periodoRetiro: string, motivo: string, mensaje: string): Promise<boolean> {
    this.guardando.set(true);
    try {
      const factura = await firstValueFrom(this.repositorio.retiro(this.factura().id, periodoRetiro, motivo));
      this.avisos.exito(mensaje);
      this.cambio.emit(factura);
      return true;
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
      return false;
    } finally {
      this.guardando.set(false);
    }
  }
}
