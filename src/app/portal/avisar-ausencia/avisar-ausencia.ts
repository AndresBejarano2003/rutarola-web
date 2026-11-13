import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AvisoAusencia, DIAS_MAXIMOS_AVISO, textoAviso } from 'src/app/ruta-del-dia/avisos-ausencia';
import { MotivoAusencia, Trayecto } from 'src/app/ruta-del-dia/recorrido';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { fechaCorta, fechaIso, sumarDias } from 'src/app/shared/fechas/fechas';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { EstudiantePortal } from '../portal';
import { PortalEstado } from '../portal-estado';
import { PortalRepositorio } from '../portal-repositorio';

/**
 * "¿Va hoy?" del portal: el acudiente avisa que su estudiante no va al colegio o no usa la ruta (hoy o un día de los
 * próximos 30) y ve sus avisos con su estado (pendiente de confirmar / confirmado por la ruta). Puede retirar uno que
 * la ruta aún no confirmó. El conductor y la monitora lo ven en la parada y lo confirman.
 */
@Component({
  selector: 'app-avisar-ausencia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal],
  template: `
    <div class="flex flex-col gap-2">
      @for (a of estudiante().avisos; track a.id) {
        <div class="flex flex-wrap items-center gap-2 rounded-box border px-3 py-2 text-sm"
          [class]="a.confirmado ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'">
          <i class="fa-solid fa-user-slash" [class]="a.confirmado ? 'text-success' : 'text-warning'" aria-hidden="true"></i>
          <span class="min-w-0 flex-1 basis-48">
            <strong>{{ a.fecha === hoy ? 'Hoy' : fechaCorta(a.fecha) }}:</strong> {{ textoAviso(a) }}
            @if (a.nota) { <span class="text-base-content/70"> · “{{ a.nota }}”</span> }
            <span class="block text-xs" [class]="a.confirmado ? 'text-success' : 'text-base-content/70'">
              {{ a.confirmado ? 'Confirmado por ' + (a.confirmadoPor || 'la ruta') : 'La ruta lo confirmará al pasar' }}
            </span>
          </span>
          @if (!a.confirmado) {
            <button type="button" class="btn btn-xs btn-ghost text-error" [disabled]="retirando() === a.id" (click)="retirar(a)"
              [attr.aria-label]="'Retirar el aviso del ' + fechaCorta(a.fecha)">
              @if (retirando() === a.id) { <span class="loading loading-spinner loading-xs" aria-hidden="true"></span> }
              Retirar
            </button>
          }
        </div>
      }
      @if (puedeAvisar()) {
        <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral self-start" (click)="abrir()">
          <i class="fa-solid fa-calendar-xmark text-warning" aria-hidden="true"></i> Avisar que no va
        </button>
      }
    </div>

    <app-modal [(abierto)]="abierto" titulo="Avisar que no va" [subtitulo]="estudiante().nombre" ancho="max-w-lg">
      @if (abierto()) {
        <form id="form-aviso-ausencia" [formGroup]="form" (ngSubmit)="enviar()" class="flex flex-col gap-4" novalidate>
          <label class="flex flex-col gap-1">
            <span class="label-text text-base-content/90">Fecha <span class="text-error">*</span></span>
            <input type="date" formControlName="fecha" [min]="hoy" [max]="maximo" class="input input-bordered bg-base-100 border-neutral w-full"
              [class.input-error]="!!errorFecha()" />
            @if (errorFecha(); as e) { <span class="text-xs text-error">{{ e }}</span> }
          </label>

          <fieldset class="flex flex-col gap-2">
            <legend class="label-text text-base-content/90 mb-1">¿Qué pasa ese día? <span class="text-error">*</span></legend>
            @for (m of motivos; track m.id) {
              <label class="rounded-box border border-base-300 bg-base-100 p-3 cursor-pointer has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2">
                <input type="radio" formControlName="motivo" [value]="m.id" class="sr-only" />
                <span class="font-medium flex items-center gap-2"><i [class]="m.icono" aria-hidden="true"></i> {{ m.nombre }}</span>
                <span class="block text-xs text-base-content/70">{{ m.descripcion }}</span>
              </label>
            }
          </fieldset>

          @if (form.controls.motivo.value === 'POR_SU_CUENTA') {
            <fieldset class="flex flex-col gap-2">
              <legend class="label-text text-base-content/90 mb-1">¿En qué trayecto no viaja?</legend>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                @for (t of trayectos; track t.id) {
                  <label class="rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm cursor-pointer text-center has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2">
                    <input type="radio" formControlName="trayecto" [value]="t.id" class="sr-only" /> {{ t.nombre }}
                  </label>
                }
              </div>
            </fieldset>
          }

          <label class="flex flex-col gap-1">
            <span class="label-text text-base-content/90">Nota para la ruta (opcional)</span>
            <textarea formControlName="nota" rows="2" maxlength="300" class="textarea bg-base-100 border-neutral w-full"
              placeholder="Ej.: tiene cita médica, lo recojo yo a las 12"></textarea>
          </label>
          <p class="text-xs text-base-content/70">
            <i class="fa-solid fa-circle-info text-info" aria-hidden="true"></i>
            La monitora y el conductor lo ven en su ruta y lo confirman; si tienen dudas te llaman o te escriben.
          </p>
        </form>
      }
      @if (abierto()) {
        <div pie class="flex flex-wrap justify-end gap-2">
          <button type="button" class="btn bg-base-300 border-neutral hover:bg-neutral" (click)="abierto.set(false)">Cancelar</button>
          <button type="submit" form="form-aviso-ausencia" class="btn btn-primary" [disabled]="enviando()">
            @if (enviando()) { <span class="loading loading-spinner loading-sm" aria-hidden="true"></span> }
            Enviar aviso
          </button>
        </div>
      }
    </app-modal>
  `,
})
export class AvisarAusencia {
  readonly estudiante = input.required<EstudiantePortal>();

  private readonly repositorio = inject(PortalRepositorio);
  private readonly estado = inject(PortalEstado);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly textoAviso = textoAviso;
  protected readonly fechaCorta = fechaCorta;
  protected readonly hoy = fechaIso();
  protected readonly maximo = sumarDias(this.hoy, DIAS_MAXIMOS_AVISO);
  protected readonly motivos: { id: MotivoAusencia; nombre: string; descripcion: string; icono: string }[] = [
    { id: 'NO_ASISTE', nombre: 'No va al colegio', descripcion: 'No lo recogen ni lo traen ese día.', icono: 'fa-solid fa-bed text-warning' },
    { id: 'POR_SU_CUENTA', nombre: 'Va al colegio, pero no en la ruta', descripcion: 'Lo llevas o lo recoges tú en uno o en los dos trayectos.', icono: 'fa-solid fa-car-side text-info' },
  ];
  protected readonly trayectos: { id: Trayecto | ''; nombre: string }[] = [
    { id: '', nombre: 'Ambos' },
    { id: 'RECOGIDA', nombre: 'Solo la recogida' },
    { id: 'ENTREGA', nombre: 'Solo la entrega' },
  ];

  protected readonly abierto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly retirando = signal<string | null>(null);
  protected readonly puedeAvisar = computed(() => this.estudiante().estado === 'ACTIVO' && !!this.estudiante().transporte);

  protected readonly form = this.fb.group({
    fecha: [this.hoy, Validators.required],
    motivo: ['NO_ASISTE' as MotivoAusencia, Validators.required],
    trayecto: ['' as Trayecto | ''],
    nota: ['', Validators.maxLength(300)],
  });

  protected errorFecha(): string | null {
    const c = this.form.controls.fecha;
    if (!c.touched) return null;
    if (!c.value) return 'Elige la fecha.';
    if (c.value < this.hoy || c.value > this.maximo) return `Puedes avisar desde hoy y hasta ${DIAS_MAXIMOS_AVISO} días adelante.`;
    return null;
  }

  protected abrir(): void {
    this.form.reset({ fecha: this.hoy, motivo: 'NO_ASISTE', trayecto: '', nota: '' });
    this.abierto.set(true);
  }

  protected async enviar(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.errorFecha()) return;
    const v = this.form.getRawValue();
    this.enviando.set(true);
    try {
      await firstValueFrom(
        this.repositorio.crearAviso({
          estudianteId: this.estudiante().id,
          fecha: v.fecha,
          motivo: v.motivo,
          trayecto: v.motivo === 'NO_ASISTE' || !v.trayecto ? null : v.trayecto,
          nota: v.nota.trim(),
        }),
      );
      this.abierto.set(false);
      this.avisos.exito('Aviso enviado. La ruta lo verá y lo confirmará.');
      await this.estado.cargar(true);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async retirar(a: AvisoAusencia): Promise<void> {
    this.retirando.set(a.id);
    try {
      await firstValueFrom(this.repositorio.cancelarAviso(a.id));
      this.avisos.exito('Aviso retirado.');
      await this.estado.cargar(true);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.retirando.set(null);
    }
  }
}
