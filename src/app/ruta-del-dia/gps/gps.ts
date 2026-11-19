import type { PosicionTiempoReal } from 'src/app/core/tiempo-real';
import { ConteoParadas, Trayecto } from '../recorrido';

/** Lectura del teléfono que se envía al API (`POST /recorridos/{id}/gps`). */
export interface LecturaGps {
  latitud: number;
  longitud: number;
  /** km/h */
  velocidad: number | null;
  /** Grados 0–360 */
  rumbo: number | null;
  /** ISO UTC (momento de la lectura en el dispositivo) */
  fecha: string;
}

/** Posición guardada del vehículo de un recorrido. */
export type PosicionGps = PosicionTiempoReal;

export interface ResultadoLoteGps {
  recibidas: number;
  descartadas: number;
  ultima: PosicionGps | null;
}

/** Recorrido EN CURSO de la empresa con su última posición (mapa del administrador). */
export interface RecorridoEnMapa {
  recorridoId: string;
  ruta: string;
  trayecto: Trayecto;
  conductor: string;
  vehiculo: string;
  conteo: ConteoParadas;
  posicion: PosicionGps | null;
}

/** Máximo de lecturas por lote (igual que el API). */
export const MAXIMO_POR_LOTE = 500;
/** Lecturas por recorrido que se guardan en el teléfono mientras no hay red (las más antiguas se descartan). */
export const MAXIMO_EN_COLA = 5_000;
/** Menos de esto entre lecturas no aporta al mapa y gasta batería y datos. */
export const INTERVALO_MINIMO_LECTURA_MS = 5_000;
/** Cada cuánto se envía lo acumulado (cada pocos segundos para que el mapa de quien sigue la ruta se mueva fluido). */
export const INTERVALO_ENVIO_MS = 5_000;
/**
 * Un vehículo escolar no va a más de esto: una lectura que implica más velocidad desde la anterior es un salto del GPS
 * (ubicación por antena o wifi, rebote al volver a la app) y se descarta. Igual que `ReglasGps.VelocidadMaximaKmh`.
 */
export const VELOCIDAD_MAXIMA_KMH = 150;
/** Si tantas lecturas seguidas "saltan" respecto a la anterior, la equivocada era la anterior: se aceptan. */
export const SALTOS_PARA_ACEPTAR = 3;
/** Lecturas con más de esto de error (m) se ignoran (señal pobre, ubicación por antena). */
export const PRECISION_MAXIMA_M = 100;
/** Días que se conservan las ubicaciones (igual que `Gps:DiasRetencion` del API). */
export const DIAS_RETENCION_GPS = 30;

/** Convierte una lectura del navegador al formato del API (velocidad m/s → km/h, valores fuera de rango → null). */
export function lecturaDe(p: Pick<GeolocationPosition, 'coords' | 'timestamp'>): LecturaGps {
  const { latitude, longitude, speed, heading } = p.coords;
  const kmh = speed != null && Number.isFinite(speed) ? Math.round(speed * 3.6 * 100) / 100 : null;
  return {
    latitud: Math.round(latitude * 1e6) / 1e6,
    longitud: Math.round(longitude * 1e6) / 1e6,
    velocidad: kmh != null && kmh >= 0 && kmh <= 300 ? kmh : null,
    rumbo: heading != null && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? Math.round(heading * 100) / 100 : null,
    fecha: new Date(p.timestamp).toISOString(),
  };
}

/** ¿Vale la pena guardar la lectura? (precisión suficiente y separada de la anterior). */
export function lecturaUtil(p: Pick<GeolocationPosition, 'coords' | 'timestamp'>, anterior: LecturaGps | undefined): boolean {
  if (p.coords.accuracy > PRECISION_MAXIMA_M) return false;
  return !anterior || p.timestamp - new Date(anterior.fecha).getTime() >= INTERVALO_MINIMO_LECTURA_MS;
}

/** Distancia en metros entre dos puntos (fórmula del haversine). */
export function distanciaMetros(a: Pick<LecturaGps, 'latitud' | 'longitud'>, b: Pick<LecturaGps, 'latitud' | 'longitud'>): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * rad;
  const dLon = (b.longitud - a.longitud) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitud * rad) * Math.cos(b.latitud * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ¿Llegar de `anterior` a `nueva` exige ir a más de `VELOCIDAD_MAXIMA_KMH`? (= `ReglasGps.SaltoImposible`). */
export function saltoImposible(anterior: Pick<LecturaGps, 'latitud' | 'longitud' | 'fecha'>, nueva: Pick<LecturaGps, 'latitud' | 'longitud' | 'fecha'>): boolean {
  const segundos = Math.abs(new Date(nueva.fecha).getTime() - new Date(anterior.fecha).getTime()) / 1000;
  const metros = distanciaMetros(anterior, nueva);
  // Menos de 100 m nunca es un salto (el error normal del GPS en una parada).
  if (metros < 100) return false;
  return metros / Math.max(segundos, 1) * 3.6 > VELOCIDAD_MAXIMA_KMH;
}

/** Agrega a la cola sin pasar del máximo (se conservan las más recientes). */
export function encolar(cola: LecturaGps[], lectura: LecturaGps): LecturaGps[] {
  const nueva = [...cola, lectura];
  return nueva.length > MAXIMO_EN_COLA ? nueva.slice(nueva.length - MAXIMO_EN_COLA) : nueva;
}

/** Hace cuánto (texto corto) se tomó una posición. */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}
