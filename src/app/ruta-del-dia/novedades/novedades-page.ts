import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { FormularioNovedad } from 'src/app/operacion/vehiculos/novedades-vehiculo/formulario-novedad';
import {
  NovedadVehiculo,
  SolicitudNovedad,
  estadoNovedad,
  gravedad,
  iconoTipoNovedad,
  nombreTipoNovedad,
} from 'src/app/operacion/vehiculos/novedades-vehiculo/novedad-vehiculo';
import { abrirSoporte } from 'src/app/operacion/vehiculos/novedades-vehiculo/novedades-vehiculo';
import { NovedadesVehiculoRepositorio } from 'src/app/operacion/vehiculos/novedades-vehiculo/novedades-vehiculo-repositorio';

/**
 * Ruta del día › Novedades del vehículo (conductor y monitora, pensada para el celular): reportar una avería, daño,
 * llanta, aseo… del vehículo de sus rutas, con foto, y ver en qué va cada una (el administrador la atiende y responde).
 */
@Component({
  selector: 'app-novedades-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink, FormularioNovedad],
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-center gap-2">
        <a routerLink="/ruta-del-dia" class="btn btn-ghost btn-sm btn-square" aria-label="Volver a mis rutas">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </a>
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold">Novedades del vehículo</h1>
          <p class="text-sm text-base-content/70">Reporta averías o daños para que el administrador los atienda.</p>
        </div>
        @if (modoLocal) {
          <span class="badge badge-soft badge-warning gap-1"><i class="fa-solid fa-database" aria-hidden="true"></i> Modo local</span>
        }
      </header>

      <div class="card bg-base-200 border border-base-300">
        <div class="card-body gap-4 p-4 sm:p-6">
          <h2 class="card-title text-lg">Reportar una novedad</h2>
          @if (cargando() && !vehiculos().length) {
            <div class="skeleton bg-base-300 h-40 w-full"></div>
          } @else if (!vehiculos().length) {
            <p class="text-base-content/70">
              <i class="fa-solid fa-circle-info text-info" aria-hidden="true"></i>
              No tienes vehículos asignados. Las novedades se reportan sobre el vehículo de tus rutas vigentes.
            </p>
          } @else {
            <app-formulario-novedad idFormulario="form-novedad" [vehiculos]="vehiculos()" (enviarNovedad)="reportar($event)" />
            <button type="submit" form="form-novedad" class="btn btn-primary btn-lg w-full sm:w-auto sm:self-end" [disabled]="guardando()">
              @if (guardando()) { <span class="loading loading-spinner" aria-hidden="true"></span> }
              <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Enviar novedad
            </button>
          }
        </div>
      </div>

      <section aria-labelledby="titulo-mis-novedades" class="space-y-3">
        <h2 id="titulo-mis-novedades" class="text-info uppercase text-sm font-semibold tracking-wide">Novedades de mis vehículos</h2>
        @if (error(); as e) {
          <div role="alert" class="alert alert-error alert-soft">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{{ e }}</span>
            <button type="button" class="btn btn-sm" (click)="cargar()">Reintentar</button>
          </div>
        } @else if (!cargando() && !novedades().length) {
          <p class="text-base-content/70"><i class="fa-solid fa-circle-check text-success" aria-hidden="true"></i> No hay novedades reportadas.</p>
        }
        <ul class="flex flex-col gap-2">
          @for (n of novedades(); track n.id) {
            <li class="rounded-box border border-base-300 bg-base-200 p-4">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-semibold"><i class="fa-solid {{ iconoTipo(n.tipo) }} text-base-content/60 mr-1" aria-hidden="true"></i>{{ nombreTipo(n.tipo) }}</p>
                  <p class="text-xs text-base-content/70">
                    {{ n.vehiculo }} · {{ n.reportadaPorMi ? 'Tú' : n.reporta }} · {{ n.fechaCreacion | date: 'd MMM, h:mm a' }}
                    @if (n.kilometraje !== null) { · {{ n.kilometraje | number }} km }
                  </p>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span class="badge badge-soft badge-sm" [class]="gravedad(n.gravedad).clase">{{ gravedad(n.gravedad).nombre }}</span>
                  <span class="badge badge-soft badge-sm" [class]="estado(n.estado).clase">{{ estado(n.estado).nombre }}</span>
                </div>
              </div>
              <p class="text-sm mt-2 whitespace-pre-line">{{ n.descripcion }}</p>
              @if (n.respuesta) {
                <p class="text-sm mt-2 rounded-box bg-base-100 p-2">
                  <span class="font-semibold">Respuesta{{ n.atiende ? ' de ' + n.atiende : '' }}:</span> {{ n.respuesta }}
                </p>
              }
              @if (n.archivo) {
                <button type="button" class="btn btn-xs btn-ghost text-info mt-2" (click)="verSoporte(n)">
                  <i class="fa-solid fa-paperclip" aria-hidden="true"></i> Ver foto o documento
                </button>
              }
            </li>
          }
        </ul>
      </section>
    </section>
  `,
})
export default class NovedadesPage {
  private readonly repositorio = inject(NovedadesVehiculoRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly formulario = viewChild(FormularioNovedad);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly nombreTipo = nombreTipoNovedad;
  protected readonly iconoTipo = iconoTipoNovedad;
  protected readonly gravedad = gravedad;
  protected readonly estado = estadoNovedad;

  protected readonly vehiculos = signal<OpcionCatalogo[]>([]);
  protected readonly novedades = signal<NovedadVehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [vehiculos, novedades] = await Promise.all([firstValueFrom(this.repositorio.misVehiculos()), firstValueFrom(this.repositorio.mias())]);
      this.vehiculos.set(vehiculos);
      this.novedades.set(novedades);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async reportar(s: SolicitudNovedad): Promise<void> {
    this.guardando.set(true);
    try {
      const creada = await firstValueFrom(this.repositorio.reportar(s));
      this.avisos.exito('Novedad enviada. El administrador ya la puede ver.');
      this.formulario()?.reiniciar();
      this.novedades.update((lista) => [{ ...creada, archivo: creada.archivo ? { ...creada.archivo, url: '' } : null }, ...lista]);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async verSoporte(n: NovedadVehiculo): Promise<void> {
    try {
      const detalle = await firstValueFrom(this.repositorio.obtenerMia(n.id));
      if (detalle.archivo?.url) abrirSoporte(detalle.archivo.url, detalle.archivo.nombre);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }
}
