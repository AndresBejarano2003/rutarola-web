import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type * as L from 'leaflet';

/** Punto del mapa: un vehículo (con rumbo y estado) u otro lugar. */
export interface MarcadorMapa {
  id: string;
  latitud: number;
  longitud: number;
  /** Texto del globo y del lector de pantalla. */
  etiqueta: string;
  tipo: 'vehiculo' | 'inicio';
  /** Resaltado (p. ej. el seleccionado en la lista). */
  activo?: boolean;
  /** Posición vieja (sin señal hace rato): se muestra atenuado. */
  desactualizado?: boolean;
}

/** Centro inicial cuando no hay puntos (Colombia). */
const CENTRO_PREDETERMINADO: L.LatLngTuple = [4.6, -74.1];

/**
 * Mapa de OpenStreetMap con Leaflet (cargado solo cuando se muestra un mapa, fuera del bundle inicial).
 * Muestra marcadores y, opcionalmente, un trayecto; se ajusta para que se vean todos al cambiar el
 * conjunto de puntos (o siempre que `seguir` sea true). Los íconos son Font Awesome (`divIcon`).
 */
@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block relative' },
  template: `
    <div #contenedor class="size-full rounded-box overflow-hidden border border-base-300 bg-base-300" role="region" [attr.aria-label]="titulo()"></div>
    @if (fallo()) {
      <p class="absolute inset-0 grid place-items-center p-4 text-center text-sm text-base-content/80">
        No se pudo cargar el mapa. Revisa tu conexión.
      </p>
    }
  `,
})
export class Mapa {
  readonly marcadores = input<MarcadorMapa[]>([]);
  /** Puntos del trayecto en orden `[latitud, longitud]`. */
  readonly trayecto = input<[number, number][]>([]);
  /** Reencuadrar en cada cambio (seguir al vehículo); si es false, solo cuando aparecen o se van puntos. */
  readonly seguir = input(false);
  readonly titulo = input('Mapa');
  readonly seleccionar = output<string>();

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  protected readonly fallo = signal(false);

  private leaflet: typeof L | null = null;
  private mapa: L.Map | null = null;
  private capa: L.LayerGroup | null = null;
  private ultimoConjunto = '';
  private readonly listo = signal(false);

  constructor() {
    afterNextRender(() => void this.crear());
    inject(DestroyRef).onDestroy(() => this.mapa?.remove());
    effect(() => {
      const marcadores = this.marcadores();
      const trayecto = this.trayecto();
      if (this.listo()) this.dibujar(marcadores, trayecto);
    });
  }

  private async crear(): Promise<void> {
    try {
      const Lf = leafletDe(await import('leaflet'));
      this.leaflet = Lf;
      this.mapa = Lf.map(this.contenedor().nativeElement, { zoomControl: true, attributionControl: true }).setView(CENTRO_PREDETERMINADO, 6);
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(this.mapa);
      this.capa = Lf.layerGroup().addTo(this.mapa);
      // El contenedor puede cambiar de tamaño (modal, panel plegable): Leaflet necesita saberlo.
      if (typeof ResizeObserver !== 'undefined') {
        const observador = new ResizeObserver(() => this.mapa?.invalidateSize());
        observador.observe(this.contenedor().nativeElement);
        this.mapa.on('unload', () => observador.disconnect());
      }
      this.listo.set(true);
    } catch {
      this.fallo.set(true);
    }
  }

  private dibujar(marcadores: MarcadorMapa[], trayecto: [number, number][]): void {
    const Lf = this.leaflet;
    if (!Lf || !this.mapa || !this.capa) return;
    this.capa.clearLayers();
    const puntos: L.LatLngTuple[] = [];
    if (trayecto.length > 1) {
      Lf.polyline(trayecto, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(this.capa);
      puntos.push(...trayecto);
    }
    for (const m of marcadores) {
      const marcador = Lf.marker([m.latitud, m.longitud], {
        icon: icono(Lf, m),
        title: m.etiqueta,
        alt: m.etiqueta,
        keyboard: true,
        zIndexOffset: m.activo ? 1000 : 0,
      })
        .bindTooltip(escapar(m.etiqueta), { direction: 'top', offset: [0, -14] })
        .on('click', () => this.seleccionar.emit(m.id));
      marcador.addTo(this.capa);
      puntos.push([m.latitud, m.longitud]);
    }
    const conjunto = marcadores.map((m) => m.id).join('|') + `#${trayecto.length > 1}`;
    if (puntos.length > 0 && (this.seguir() || conjunto !== this.ultimoConjunto)) {
      if (puntos.length === 1) this.mapa.setView(puntos[0], Math.max(this.mapa.getZoom(), 15));
      else this.mapa.fitBounds(Lf.latLngBounds(puntos), { padding: [32, 32], maxZoom: 16 });
    }
    this.ultimoConjunto = conjunto;
  }
}

/**
 * Leaflet es CommonJS/UMD: en la compilación de producción (esbuild) el chunk solo trae `export default`,
 * así que `L.map` está en `modulo.default.map`; el servidor de desarrollo además expone los nombres sueltos.
 * Acepta ambas formas.
 */
export function leafletDe(modulo: typeof L & { default?: typeof L }): typeof L {
  const Lf = modulo.default ?? modulo;
  if (typeof Lf.map !== 'function') throw new Error('Leaflet no se cargó correctamente');
  return Lf;
}

function icono(Lf: typeof L, m: MarcadorMapa): L.DivIcon {
  const color = m.tipo === 'inicio' ? 'bg-secondary text-secondary-content' : m.activo ? 'bg-primary text-primary-content' : 'bg-base-100 text-primary';
  const figura = m.tipo === 'inicio' ? 'fa-flag' : 'fa-van-shuttle';
  return Lf.divIcon({
    className: '',
    html: `<span class="grid size-9 place-items-center rounded-full border-2 border-primary shadow-lg ${color} ${m.desactualizado ? 'opacity-60' : ''}"><i class="fa-solid ${figura}" aria-hidden="true"></i></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
