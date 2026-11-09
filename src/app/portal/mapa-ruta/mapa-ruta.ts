import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription, firstValueFrom, interval } from 'rxjs';
import { PosicionGps, haceCuanto } from 'src/app/ruta-del-dia/gps/gps';
import { GpsRepositorio } from 'src/app/ruta-del-dia/gps/gps-repositorio';
import { TRAYECTOS } from 'src/app/ruta-del-dia/recorrido';
import { Mapa, MarcadorMapa } from 'src/app/shared/mapa/mapa';
import { Modal } from 'src/app/shared/modal/modal';
import { EstudiantePortal } from '../portal';
import { PortalEstado } from '../portal-estado';

/**
 * Botón "Ver en el mapa" del estudiante mientras su ruta está EN CURSO, con el vehículo en vivo en un
 * modal. El servidor solo entrega la ubicación del recorrido de SU estudiante y solo mientras está en
 * curso: al terminar el recorrido el botón desaparece y el modal se cierra. Si la empresa no comparte la
 * ubicación con los acudientes (`PortalAcudiente.ubicacionEnVivo`), no hay botón: el estado y la hora de inicio
 * ya salen en "Hoy en la ruta".
 */
@Component({
  selector: 'app-mapa-ruta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Mapa],
  template: `
    @if (enCurso() && ubicacionEnVivo()) {
      <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="abierto.set(true)">
        <i class="fa-solid fa-map-location-dot text-info" aria-hidden="true"></i> Ver en el mapa
      </button>
    }
    <app-modal [(abierto)]="abierto" titulo="¿Dónde va la ruta?" [subtitulo]="subtitulo()" ancho="max-w-3xl">
      @if (abierto()) {
        <div class="space-y-2">
          @if (cargando()) {
            <div class="skeleton h-72 w-full"></div>
          } @else if (posicion(); as p) {
            <app-mapa class="h-[60dvh] min-h-72" titulo="Ubicación del vehículo" [marcadores]="marcadores()" [seguir]="true" />
            <p class="text-sm text-base-content/80">
              <i class="fa-solid fa-van-shuttle text-primary" aria-hidden="true"></i>
              {{ p.vehiculo }} · ubicación {{ ultima() }}
            </p>
          } @else {
            <p class="text-sm text-base-content/80 flex items-center gap-2 py-6">
              <i class="fa-solid fa-location-pin-lock" aria-hidden="true"></i>
              La ruta va en camino, pero el vehículo aún no ha compartido su ubicación. Se verá aquí apenas tenga señal.
            </p>
          }
        </div>
      }
      @if (abierto()) {
        <div pie class="flex justify-end">
          <button type="button" class="btn bg-base-300 border-neutral hover:bg-neutral" (click)="abierto.set(false)">Cerrar</button>
        </div>
      }
    </app-modal>
  `,
})
export class MapaRuta {
  readonly estudiante = input.required<EstudiantePortal>();

  private readonly gps = inject(GpsRepositorio);
  private readonly portal = inject(PortalEstado, { optional: true });
  /** Sin datos aún (o fuera del portal) se asume que sí, como el valor por defecto del servidor. */
  protected readonly ubicacionEnVivo = computed(() => this.portal?.datos()?.ubicacionEnVivo ?? true);
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly posicion = signal<PosicionGps | null>(null);
  private readonly ahora = signal(Date.now());
  private suscripcion: Subscription | null = null;

  protected readonly enCurso = computed(() => this.estudiante().hoy.find((r) => r.enCurso) ?? null);
  protected readonly subtitulo = computed(() => {
    const r = this.enCurso();
    const t = TRAYECTOS.find((x) => x.id === r?.trayecto)?.nombre ?? '';
    return `${this.estudiante().nombre}${t ? ` · ${t}` : ''}${this.estudiante().transporte ? ` · ${this.estudiante().transporte!.ruta}` : ''}`;
  });
  protected readonly marcadores = computed((): MarcadorMapa[] => {
    const p = this.posicion();
    return p ? [{ id: p.recorridoId, tipo: 'vehiculo', activo: true, latitud: p.latitud, longitud: p.longitud, etiqueta: p.vehiculo || 'Vehículo' }] : [];
  });
  protected readonly ultima = computed(() => {
    this.ahora();
    const p = this.posicion();
    return p ? haceCuanto(p.fecha) : '';
  });

  constructor() {
    const reloj = interval(30_000).subscribe(() => this.ahora.set(Date.now()));
    inject(DestroyRef).onDestroy(() => {
      reloj.unsubscribe();
      this.suscripcion?.unsubscribe();
    });
    effect(() => {
      const id = this.abierto() ? this.enCurso()?.recorridoId : undefined;
      untracked(() => (id ? void this.seguir(id) : this.dejar()));
    });
  }

  private async seguir(id: string): Promise<void> {
    if (this.suscripcion) return;
    this.cargando.set(true);
    this.suscripcion = this.gps.observar(id).subscribe((p) => this.posicion.set(p));
    try {
      const ultima = await firstValueFrom(this.gps.ultima(id));
      if (ultima && (!this.posicion() || this.posicion()!.fecha < ultima.fecha)) this.posicion.set(ultima);
    } catch {
      /* sin ubicación: se muestra el aviso */
    } finally {
      this.cargando.set(false);
    }
  }

  private dejar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.posicion.set(null);
    if (this.abierto() && !this.enCurso()) this.abierto.set(false);
  }
}
