import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { FormularioNovedad } from './formulario-novedad';
import {
  EstadoNovedadVehiculo,
  NovedadVehiculo,
  SolicitudNovedad,
  estadoNovedad,
  gravedad,
  iconoTipoNovedad,
  nombreTipoNovedad,
} from './novedad-vehiculo';
import { NovedadesVehiculoRepositorio } from './novedades-vehiculo-repositorio';

/** Abre el archivo de soporte (data URL) en una pestaña nueva o lo descarga si el navegador no puede mostrarlo. */
export function abrirSoporte(url: string, nombre: string): void {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.target = '_blank';
  enlace.rel = 'noopener';
  enlace.click();
}

/**
 * Novedades del vehículo en su detalle: lo que reportaron el conductor y la monitora (o registró el administrador),
 * abiertas y graves primero. El administrador la pasa a "En proceso", la resuelve contando qué se hizo o la reabre.
 */
@Component({
  selector: 'app-novedades-vehiculo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, FormularioNovedad],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="titulo-novedades-vehiculo" id="novedades-vehiculo">
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-4">
        <div>
          <h3 id="titulo-novedades-vehiculo" class="text-info uppercase text-sm font-semibold tracking-wide">
            Novedades
            @if (abiertas() > 0) { <span class="badge badge-sm badge-soft badge-warning ml-1">{{ abiertas() }} abierta(s)</span> }
          </h3>
          <p class="text-xs text-base-content/70">Averías, daños y demás que reportan el conductor y la monitora desde su app.</p>
        </div>
        @if (!registrando()) {
          <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="registrando.set(true)">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Registrar novedad
          </button>
        }
      </div>

      @if (registrando()) {
        <div class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
          <p class="font-semibold">Nueva novedad</p>
          <app-formulario-novedad idFormulario="form-novedad-admin" [vehiculoFijo]="vehiculoId()" (enviarNovedad)="registrar($event)" />
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="registrando.set(false)">Cancelar</button>
            <button type="submit" form="form-novedad-admin" class="btn btn-sm btn-secondary" [disabled]="guardando()">
              @if (guardando()) { <span class="loading loading-spinner loading-xs" aria-hidden="true"></span> }
              Guardar novedad
            </button>
          </div>
        </div>
      }

      @if (cargando()) {
        <div class="skeleton bg-base-300 h-16 w-full"></div>
      } @else if (error()) {
        <p role="alert" class="text-sm text-error">{{ error() }}</p>
      } @else if (novedades().length === 0) {
        <p class="text-sm text-base-content/70"><i class="fa-solid fa-circle-check text-success" aria-hidden="true"></i> Sin novedades reportadas.</p>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (n of novedades(); track n.id) {
            <li class="rounded-box border bg-base-100 p-3" [class]="n.id === resaltada() ? 'border-primary' : 'border-base-300'" [attr.id]="'novedad-' + n.id">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium">
                    <i class="fa-solid {{ iconoTipo(n.tipo) }} text-base-content/60 mr-1" aria-hidden="true"></i>{{ nombreTipo(n.tipo) }}
                  </p>
                  <p class="text-xs text-base-content/70">
                    {{ n.reporta }} · {{ n.fechaCreacion | date: 'd MMM y, h:mm a' }}
                    @if (n.kilometraje !== null) { · {{ n.kilometraje | number }} km }
                  </p>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span class="badge badge-soft badge-sm" [class]="gravedad(n.gravedad).clase">Gravedad {{ gravedad(n.gravedad).nombre.toLowerCase() }}</span>
                  <span class="badge badge-soft badge-sm" [class]="estado(n.estado).clase">{{ estado(n.estado).nombre }}</span>
                </div>
              </div>
              <p class="text-sm mt-2 whitespace-pre-line">{{ n.descripcion }}</p>
              @if (n.respuesta) {
                <p class="text-sm mt-2 rounded-box bg-base-200 p-2">
                  <span class="font-semibold">Respuesta{{ n.atiende ? ' de ' + n.atiende : '' }}:</span> {{ n.respuesta }}
                </p>
              }

              @if (resolviendo() === n.id) {
                <div class="mt-3 flex flex-col gap-2">
                  <label class="flex flex-col gap-1">
                    <span class="label-text text-base-content/90">¿Qué se hizo? <span class="text-error">*</span></span>
                    <textarea rows="2" maxlength="1000" class="textarea textarea-bordered bg-base-100 border-neutral w-full" [(ngModel)]="respuesta"
                      placeholder="Ej. se cambiaron las pastillas de freno en el taller"></textarea>
                  </label>
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="resolviendo.set(null)">Cancelar</button>
                    <button type="button" class="btn btn-sm btn-success" [disabled]="guardando() || !respuesta.trim()" (click)="cambiar(n, 'RESUELTA')">
                      @if (guardando()) { <span class="loading loading-spinner loading-xs" aria-hidden="true"></span> }
                      Marcar resuelta
                    </button>
                  </div>
                </div>
              } @else {
                <div class="mt-2 flex flex-wrap justify-end gap-2">
                  @if (n.archivo) {
                    <button type="button" class="btn btn-xs btn-ghost text-info" (click)="verSoporte(n)">
                      <i class="fa-solid fa-paperclip" aria-hidden="true"></i> Ver soporte
                    </button>
                  }
                  @if (n.estado === 'PENDIENTE') {
                    <button type="button" class="btn btn-xs bg-base-300 border-neutral hover:bg-neutral" [disabled]="guardando()" (click)="cambiar(n, 'EN_PROCESO')">
                      En proceso
                    </button>
                  }
                  @if (n.estado !== 'RESUELTA') {
                    <button type="button" class="btn btn-xs btn-soft btn-success" (click)="resolver(n)">Resolver</button>
                  } @else {
                    <button type="button" class="btn btn-xs bg-base-300 border-neutral hover:bg-neutral" [disabled]="guardando()" (click)="cambiar(n, 'PENDIENTE')">
                      Reabrir
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class NovedadesVehiculo {
  readonly vehiculoId = input.required<string>();
  /** Novedad a resaltar (enlace de la campana). */
  readonly resaltada = input<string | null>(null);
  readonly cambio = output<void>();

  private readonly repositorio = inject(NovedadesVehiculoRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly cambios = inject(CambiosDatos);

  protected readonly nombreTipo = nombreTipoNovedad;
  protected readonly iconoTipo = iconoTipoNovedad;
  protected readonly gravedad = gravedad;
  protected readonly estado = estadoNovedad;

  protected readonly novedades = signal<NovedadVehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly registrando = signal(false);
  protected readonly resolviendo = signal<string | null>(null);
  protected respuesta = '';
  protected readonly abiertas = computed(() => this.novedades().filter((n) => n.estado !== 'RESUELTA').length);

  constructor() {
    effect(() => {
      const id = this.vehiculoId();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    try {
      this.novedades.set(await firstValueFrom(this.repositorio.listar({ vehiculoId: id })));
      this.error.set(null);
      const resaltada = untracked(this.resaltada);
      if (resaltada) setTimeout(() => document.getElementById(`novedad-${resaltada}`)?.scrollIntoView({ block: 'center' }));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async registrar(s: SolicitudNovedad): Promise<void> {
    this.guardando.set(true);
    try {
      await firstValueFrom(this.repositorio.registrar(s));
      this.avisos.exito('Novedad registrada.');
      this.registrando.set(false);
      this.terminado();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected resolver(n: NovedadVehiculo): void {
    this.respuesta = n.respuesta;
    this.resolviendo.set(n.id);
  }

  protected async cambiar(n: NovedadVehiculo, estado: EstadoNovedadVehiculo): Promise<void> {
    this.guardando.set(true);
    try {
      await firstValueFrom(this.repositorio.cambiarEstado(n.id, { estado, respuesta: estado === 'RESUELTA' ? this.respuesta.trim() : '' }));
      this.avisos.exito(estado === 'RESUELTA' ? 'Novedad resuelta.' : estado === 'EN_PROCESO' ? 'Novedad en proceso.' : 'Novedad reabierta.');
      this.resolviendo.set(null);
      this.terminado();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async verSoporte(n: NovedadVehiculo): Promise<void> {
    try {
      const detalle = await firstValueFrom(this.repositorio.obtener(n.id));
      if (detalle.archivo?.url) abrirSoporte(detalle.archivo.url, detalle.archivo.nombre);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  private terminado(): void {
    this.cambios.notificar();
    this.cambio.emit();
    void this.cargar(this.vehiculoId());
  }
}
