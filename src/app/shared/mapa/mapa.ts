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

/** Marcador dibujado: se reutiliza entre actualizaciones para moverlo en vez de recrearlo. */
interface MarcadorDibujado {
  marcador: L.Marker;
  /** Clase visual del ícono (cambia con `activo`, `desactualizado`, `tipo`). */
  apariencia: string;
  etiqueta: string;
  /** Cuándo llegó la posición anterior (la animación dura lo que tardan en llegar las posiciones). */
  actualizado: number;
  animacion: number | null;
}

/** Duración de la animación entre dos posiciones (ms): lo que tardó en llegar la nueva, dentro de estos límites. */
const ANIMACION_MINIMA_MS = 600;
const ANIMACION_MAXIMA_MS = 4_500;
/** Saltos largos (p. ej. tras un rato sin señal) se recorren rápido, sin inventar un camino lento. */
const SALTO_LARGO_M = 2_000;
const ANIMACION_SALTO_MS = 1_200;

/** Centro inicial cuando no hay puntos (Colombia). */
const CENTRO_PREDETERMINADO: L.LatLngTuple = [4.6, -74.1];

/**
 * Mapa de OpenStreetMap con Leaflet (cargado solo cuando se muestra un mapa, fuera del bundle inicial).
 * Muestra marcadores y, opcionalmente, un trayecto; se ajusta para que se vean todos al cambiar el
 * conjunto de puntos (o siempre que `seguir` sea true). Los íconos son Font Awesome (`divIcon`).
 *
 * Los marcadores se conservan por `id` entre actualizaciones: cuando llega una posición nueva el vehículo se DESLIZA
 * desde donde está (durante lo que tardó en llegar, 0,6–4,5 s) en vez de aparecer de golpe en otro lugar, y con
 * `seguir` el mapa lo acompaña con un paneo suave. Con "reducir movimiento" del sistema se mueve sin animación.
 */
@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `isolate`: los paneles y controles de Leaflet (z-index 400–1000) quedan dentro del mapa y no tapan el menú,
  // las barras ni los desplegables del shell.
  host: { class: 'block relative isolate' },
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
  private linea: L.Polyline | null = null;
  private readonly dibujados = new Map<string, MarcadorDibujado>();
  private ultimoConjunto = '';
  private readonly listo = signal(false);

  constructor() {
    afterNextRender(() => void this.crear());
    inject(DestroyRef).onDestroy(() => {
      for (const d of this.dibujados.values()) if (d.animacion !== null) cancelAnimationFrame(d.animacion);
      this.mapa?.remove();
    });
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
    const mapa = this.mapa;
    const capa = this.capa;
    if (!Lf || !mapa || !capa) return;
    const puntos: L.LatLngTuple[] = [];

    if (trayecto.length > 1) {
      if (this.linea) this.linea.setLatLngs(trayecto);
      else this.linea = Lf.polyline(trayecto, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(capa);
      puntos.push(...trayecto);
    } else if (this.linea) {
      this.linea.remove();
      this.linea = null;
    }

    const ahora = Date.now();
    let duracionSeguir = 0;
    const vigentes = new Set(marcadores.map((m) => m.id));
    for (const [id, d] of this.dibujados) {
      if (vigentes.has(id)) continue;
      if (d.animacion !== null) cancelAnimationFrame(d.animacion);
      d.marcador.remove();
      this.dibujados.delete(id);
    }
    for (const m of marcadores) {
      const destino: L.LatLngTuple = [m.latitud, m.longitud];
      puntos.push(destino);
      const apariencia = claseIcono(m);
      const d = this.dibujados.get(m.id);
      if (!d) {
        const marcador = Lf.marker(destino, { icon: icono(Lf, m), title: m.etiqueta, alt: m.etiqueta, keyboard: true, zIndexOffset: m.activo ? 1000 : 0 })
          .bindTooltip(escapar(m.etiqueta), { direction: 'top', offset: [0, -14] })
          .on('click', () => this.seleccionar.emit(m.id))
          .addTo(capa);
        this.dibujados.set(m.id, { marcador, apariencia, etiqueta: m.etiqueta, actualizado: ahora, animacion: null });
        continue;
      }
      if (d.apariencia !== apariencia) {
        d.marcador.setIcon(icono(Lf, m));
        d.marcador.setZIndexOffset(m.activo ? 1000 : 0);
        d.apariencia = apariencia;
      }
      if (d.etiqueta !== m.etiqueta) {
        d.marcador.setTooltipContent(escapar(m.etiqueta));
        d.etiqueta = m.etiqueta;
      }
      const duracion = this.mover(d, destino, ahora);
      duracionSeguir = Math.max(duracionSeguir, duracion);
    }

    const conjunto = marcadores.map((m) => m.id).join('|') + `#${trayecto.length > 1}`;
    const cambioConjunto = conjunto !== this.ultimoConjunto;
    this.ultimoConjunto = conjunto;
    if (puntos.length === 0 || (!this.seguir() && !cambioConjunto)) return;
    // Al aparecer o irse puntos se encuadra al instante; al seguir un vehículo, el mapa lo acompaña suavemente.
    const suave = !cambioConjunto && duracionSeguir > 0;
    const opciones = suave ? { animate: true, duration: duracionSeguir / 1000, easeLinearity: 1 } : { animate: false };
    if (puntos.length === 1) {
      if (suave) mapa.panTo(puntos[0], opciones);
      else mapa.setView(puntos[0], Math.max(mapa.getZoom(), 15), opciones);
    } else {
      mapa.fitBounds(Lf.latLngBounds(puntos), { padding: [32, 32], maxZoom: 16, ...opciones });
    }
  }

  /** Desliza el marcador hasta `destino`; devuelve la duración usada (0 = sin animación). */
  private mover(d: MarcadorDibujado, destino: L.LatLngTuple, ahora: number): number {
    const desde = d.marcador.getLatLng();
    const transcurrido = ahora - d.actualizado;
    d.actualizado = ahora;
    if (d.animacion !== null) cancelAnimationFrame(d.animacion);
    d.animacion = null;
    if (desde.lat === destino[0] && desde.lng === destino[1]) return 0;
    const metros = desde.distanceTo(destino);
    const sinAnimacion = typeof requestAnimationFrame === 'undefined' || reducirMovimiento();
    if (sinAnimacion) {
      d.marcador.setLatLng(destino);
      return 0;
    }
    const duracion = duracionAnimacion(metros, transcurrido);
    const inicio = performance.now();
    const paso = (t: number) => {
      const avance = Math.min(1, (t - inicio) / duracion);
      d.marcador.setLatLng([desde.lat + (destino[0] - desde.lat) * avance, desde.lng + (destino[1] - desde.lng) * avance]);
      d.animacion = avance < 1 ? requestAnimationFrame(paso) : null;
    };
    d.animacion = requestAnimationFrame(paso);
    return duracion;
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

/** Cuánto dura el desplazamiento del marcador: lo que tardó en llegar la posición (0,6–4,5 s); los saltos largos, 1,2 s. */
export function duracionAnimacion(metros: number, transcurridoMs: number): number {
  if (metros > SALTO_LARGO_M) return ANIMACION_SALTO_MS;
  return Math.min(ANIMACION_MAXIMA_MS, Math.max(ANIMACION_MINIMA_MS, transcurridoMs));
}

function reducirMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function claseIcono(m: Pick<MarcadorMapa, 'tipo' | 'activo' | 'desactualizado'>): string {
  const color = m.tipo === 'inicio' ? 'bg-secondary text-secondary-content' : m.activo ? 'bg-primary text-primary-content' : 'bg-base-100 text-primary';
  return `${color} ${m.desactualizado ? 'opacity-60' : ''} ${m.tipo}`;
}

function icono(Lf: typeof L, m: MarcadorMapa): L.DivIcon {
  const figura = m.tipo === 'inicio' ? 'fa-flag' : 'fa-van-shuttle';
  return Lf.divIcon({
    className: '',
    html: `<span class="grid size-9 place-items-center rounded-full border-2 border-primary shadow-lg ${claseIcono(m)}"><i class="fa-solid ${figura}" aria-hidden="true"></i></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
