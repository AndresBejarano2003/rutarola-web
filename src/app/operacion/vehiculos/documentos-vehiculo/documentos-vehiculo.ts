import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ArchivoAdjunto, ArchivoAdjuntoCampo } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { fechaCorta } from 'src/app/shared/fechas/fechas';
import { mensajeError, posteriorA } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { BadgeVencimiento } from 'src/app/shared/vencimiento/vencimiento';
import { TIPOS_DOCUMENTO_VEHICULO, TipoDocumentoVehiculo, nombreTipoDocumento } from '../vehiculo';
import { DocumentoVehiculo } from './documento-vehiculo';
import { DocumentosVehiculoRepositorio } from './documentos-vehiculo-repositorio';

/**
 * Historial de documentos del vehículo en su detalle: cada SOAT, revisión técnico-mecánica, tarjeta de operación,
 * póliza u otro documento que se renueva queda registrado con su número, entidad, fechas y PDF. El de vencimiento más
 * reciente de cada tipo es el vigente y fija la fecha del vehículo (alertas, asignaciones).
 */
@Component({
  selector: 'app-documentos-vehiculo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ArchivoAdjuntoCampo, Campo, SelectorBusqueda, BadgeVencimiento],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="titulo-historial-documentos">
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-4">
        <div>
          <h3 id="titulo-historial-documentos" class="text-info uppercase text-sm font-semibold tracking-wide">Historial de documentos</h3>
          <p class="text-xs text-base-content/70">Cada renovación con su PDF. El más reciente de cada tipo es el vigente.</p>
        </div>
        @if (!editando()) {
          <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="nuevo()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Registrar documento
          </button>
        }
      </div>

      @if (editando()) {
        <form [formGroup]="form" (ngSubmit)="guardar()" class="grid md:grid-cols-2 gap-x-4 gap-y-3 rounded-box border border-base-300 bg-base-100 p-4" novalidate>
          <p class="md:col-span-2 font-semibold">{{ editandoId() ? 'Editar documento' : 'Nuevo documento' }}</p>
          <div app-campo etiqueta="Tipo de documento" requerido [error]="error('tipo')">
            <app-selector-busqueda formControlName="tipo" [opciones]="tipos" etiqueta="Tipo de documento" [invalido]="!!error('tipo')" />
          </div>
          <label app-campo etiqueta="Número" [error]="error('numero')">
            <input formControlName="numero" class="input input-bordered bg-base-100 border-neutral w-full" placeholder="Ej. póliza 12345678" />
          </label>
          <label app-campo etiqueta="Entidad" [error]="error('entidad')" ayuda="Aseguradora, CDA, Secretaría de Movilidad…">
            <input formControlName="entidad" class="input input-bordered bg-base-100 border-neutral w-full" />
          </label>
          <label app-campo etiqueta="Fecha de expedición" [error]="error('fechaExpedicion')">
            <input type="date" formControlName="fechaExpedicion" class="input input-bordered bg-base-100 border-neutral w-full" />
          </label>
          <label app-campo etiqueta="Fecha de vencimiento" requerido [error]="errorVencimiento()">
            <input type="date" formControlName="fechaVencimiento" class="input input-bordered bg-base-100 border-neutral w-full"
              [class.input-error]="!!errorVencimiento()" />
          </label>
          <div class="flex flex-col gap-1">
            <span class="label-text text-base-content/90">Documento (PDF o imagen)</span>
            <app-archivo-adjunto formControlName="archivo" />
          </div>
          <label app-campo class="md:col-span-2" etiqueta="Observaciones" [error]="error('observaciones')">
            <textarea formControlName="observaciones" rows="2" class="textarea textarea-bordered bg-base-100 border-neutral w-full"></textarea>
          </label>
          <div class="md:col-span-2 flex flex-wrap justify-end gap-2">
            <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="cancelar()">Cancelar</button>
            <button type="submit" class="btn btn-sm btn-secondary" [disabled]="guardando()">
              @if (guardando()) { <span class="loading loading-spinner loading-xs" aria-hidden="true"></span> }
              Guardar documento
            </button>
          </div>
        </form>
      }

      @if (cargando()) {
        <div class="skeleton bg-base-300 h-16 w-full"></div>
      } @else if (error_()) {
        <p role="alert" class="text-sm text-error">{{ error_() }}</p>
      } @else if (documentos().length === 0) {
        <p class="text-sm text-base-content/70"><i class="fa-solid fa-folder-open text-base-content/60" aria-hidden="true"></i> Aún no hay documentos registrados.</p>
      } @else {
        <div class="@container overflow-x-auto rounded-box border border-base-300">
          <table class="table table-sm">
            <thead>
              <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
                <th>Documento</th>
                <th class="hidden @3xl:table-cell">Expedición</th>
                <th>Vencimiento</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (d of documentos(); track d.id) {
                <tr class="border-base-300 hover:bg-base-300/50" [class.opacity-80]="!d.vigente && d.tipo !== 'OTRO'">
                  <td class="whitespace-normal min-w-44">
                    <div class="font-medium">{{ nombreTipo(d.tipo) }}</div>
                    <div class="text-xs text-base-content/70">{{ detalle(d) }}</div>
                  </td>
                  <td class="hidden @3xl:table-cell text-sm">{{ d.fechaExpedicion ? fechaCorta(d.fechaExpedicion) : '—' }}</td>
                  <td>
                    @if (d.vigente || d.tipo === 'OTRO') {
                      <app-badge-vencimiento [fecha]="d.fechaVencimiento" />
                    } @else {
                      <span class="text-sm">{{ fechaCorta(d.fechaVencimiento) }}</span>
                      <span class="badge badge-sm bg-base-300 border-neutral ml-1">Reemplazado</span>
                    }
                  </td>
                  <td class="text-right whitespace-nowrap">
                    @if (borrandoId() === d.id) {
                      <span class="text-xs mr-1">¿Borrar?</span>
                      <button type="button" class="btn btn-xs btn-soft btn-error" [disabled]="guardando()" (click)="eliminar(d)">Sí, borrar</button>
                      <button type="button" class="btn btn-xs btn-ghost" (click)="borrandoId.set(null)">No</button>
                    } @else {
                      @if (d.archivo) {
                        <div class="tooltip tooltip-left" data-tip="Descargar documento">
                          <button type="button" class="btn btn-sm btn-ghost btn-square text-info hover:bg-info/15" (click)="descargar(d)"
                            [attr.aria-label]="'Descargar ' + d.archivo.nombre">
                            <i class="fa-solid" [class]="d.archivo.tipo === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image'" aria-hidden="true"></i>
                          </button>
                        </div>
                      }
                      <div class="tooltip tooltip-left" data-tip="Editar">
                        <button type="button" class="btn btn-sm btn-ghost btn-square text-primary hover:bg-primary/15" aria-label="Editar" (click)="editar(d)">
                          <i class="fa-solid fa-pen" aria-hidden="true"></i>
                        </button>
                      </div>
                      <div class="tooltip tooltip-left" data-tip="Eliminar">
                        <button type="button" class="btn btn-sm btn-ghost btn-square text-error hover:bg-error/15" aria-label="Eliminar" (click)="borrandoId.set(d.id)">
                          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class DocumentosVehiculo {
  readonly vehiculoId = input.required<string>();
  /** Cambió el historial (el vencimiento del vehículo puede haber cambiado). */
  readonly cambio = output<void>();

  private readonly repositorio = inject(DocumentosVehiculoRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tipos = TIPOS_DOCUMENTO_VEHICULO.map((t) => ({ id: t.id, nombre: t.nombre }));
  protected readonly nombreTipo = nombreTipoDocumento;
  protected readonly fechaCorta = fechaCorta;
  protected readonly documentos = signal<DocumentoVehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error_ = signal<string | null>(null);
  protected readonly editando = signal(false);
  protected readonly editandoId = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly borrandoId = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      tipo: this.fb.control<TipoDocumentoVehiculo | ''>('', Validators.required),
      numero: ['', Validators.maxLength(50)],
      entidad: ['', Validators.maxLength(100)],
      fechaExpedicion: [''],
      fechaVencimiento: ['', Validators.required],
      observaciones: ['', Validators.maxLength(500)],
      archivo: this.fb.control<ArchivoAdjunto | null>(null),
    },
    { validators: posteriorA('fechaExpedicion', 'fechaVencimiento', 'vencimientoAntes', true) },
  );

  constructor() {
    effect(() => {
      const id = this.vehiculoId();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    try {
      this.documentos.set(await firstValueFrom(this.repositorio.listar(id)));
      this.error_.set(null);
    } catch (e) {
      this.error_.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected detalle(d: DocumentoVehiculo): string {
    return [d.numero, d.entidad].filter(Boolean).join(' · ') || '—';
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected errorVencimiento(): string | null {
    const c = this.form.controls.fechaVencimiento;
    if (c.touched && c.hasError('vencimientoAntes')) return 'El vencimiento debe ser posterior a la expedición.';
    return mensajeError(c);
  }

  protected nuevo(): void {
    this.editandoId.set(null);
    this.form.reset();
    this.editando.set(true);
  }

  protected async editar(d: DocumentoVehiculo): Promise<void> {
    try {
      const detalle = await firstValueFrom(this.repositorio.obtener(this.vehiculoId(), d.id));
      this.editandoId.set(d.id);
      this.form.reset({ ...detalle, archivo: detalle.archivo });
      this.editando.set(true);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  protected cancelar(): void {
    this.editando.set(false);
    this.editandoId.set(null);
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const solicitud = { ...v, tipo: v.tipo as TipoDocumentoVehiculo, numero: v.numero.trim(), entidad: v.entidad.trim(), observaciones: v.observaciones.trim() };
    this.guardando.set(true);
    try {
      const id = this.editandoId();
      if (id) await firstValueFrom(this.repositorio.actualizar(this.vehiculoId(), id, solicitud));
      else await firstValueFrom(this.repositorio.crear(this.vehiculoId(), solicitud));
      this.avisos.exito(id ? 'Documento actualizado.' : 'Documento registrado en el historial.');
      this.cancelar();
      await this.cargar(this.vehiculoId());
      this.cambio.emit();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminar(d: DocumentoVehiculo): Promise<void> {
    this.guardando.set(true);
    try {
      await firstValueFrom(this.repositorio.eliminar(this.vehiculoId(), d.id));
      this.borrandoId.set(null);
      this.avisos.exito('Documento eliminado del historial.');
      await this.cargar(this.vehiculoId());
      this.cambio.emit();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  /** La lista no trae el contenido: se pide el detalle y se descarga. */
  protected async descargar(d: DocumentoVehiculo): Promise<void> {
    try {
      const detalle = await firstValueFrom(this.repositorio.obtener(this.vehiculoId(), d.id));
      if (!detalle.archivo?.url) return;
      const enlace = document.createElement('a');
      enlace.href = detalle.archivo.url;
      enlace.download = detalle.archivo.nombre;
      enlace.target = '_blank';
      enlace.click();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }
}
