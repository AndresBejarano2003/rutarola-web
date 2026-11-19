import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { LecturaDispositivo } from './gps';

/** `SIN_PERMISO`: el usuario negó la ubicación (hay que habilitarla en los ajustes); `TEMPORAL`: sin señal, se sigue intentando. */
export type FalloUbicacion = 'SIN_PERMISO' | 'TEMPORAL';

/** ¿Corre dentro de la app instalada (Android/iOS con Capacitor) y no en un navegador? */
export function esAppNativa(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * De dónde salen las lecturas del teléfono que `EmisorGps` comparte:
 * - en el navegador, `navigator.geolocation` (solo mientras la página está en pantalla);
 * - en la app instalada, el plugin de ubicación en segundo plano: un servicio de Android con la notificación fija
 *   "RutaRola está compartiendo la ubicación" que sigue leyendo con otra app al frente o la pantalla bloqueada.
 */
@Injectable({
  providedIn: 'root',
  useFactory: () => (esAppNativa() ? new FuenteNativa() : new FuenteNavegador()),
})
export abstract class FuenteUbicacion {
  /** Sigue entregando lecturas con la app en segundo plano. */
  abstract readonly enSegundoPlano: boolean;
  /** El equipo tiene ubicación. */
  abstract disponible(): boolean;
  /** Empieza a leer; devuelve la función que la detiene. */
  abstract vigilar(alLeer: (l: LecturaDispositivo) => void, alFallar: (f: FalloUbicacion) => void): () => void;
  /** Pide una lectura ya (al volver a la app). */
  abstract leerAhora(alLeer: (l: LecturaDispositivo) => void, alFallar: (f: FalloUbicacion) => void): void;
}

const OPCIONES: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 30_000,
};

export class FuenteNavegador extends FuenteUbicacion {
  readonly enSegundoPlano = false;

  disponible(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }

  vigilar(alLeer: (l: LecturaDispositivo) => void, alFallar: (f: FalloUbicacion) => void): () => void {
    const id = navigator.geolocation.watchPosition(alLeer, (e) => alFallar(falloDe(e)), OPCIONES);
    return () => navigator.geolocation?.clearWatch(id);
  }

  leerAhora(alLeer: (l: LecturaDispositivo) => void, alFallar: (f: FalloUbicacion) => void): void {
    navigator.geolocation.getCurrentPosition?.(alLeer, (e) => alFallar(falloDe(e)), { ...OPCIONES, maximumAge: 0 });
  }
}

function falloDe(e: GeolocationPositionError): FalloUbicacion {
  return e.code === e.PERMISSION_DENIED ? 'SIN_PERMISO' : 'TEMPORAL';
}

export class FuenteNativa extends FuenteUbicacion {
  readonly enSegundoPlano = true;
  private readonly plugin = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
  /** Plugin propio de la app Android (`AjustesTelefono.java`): permiso de notificaciones de Android 13+. */
  private readonly ajustes = registerPlugin<{ solicitarNotificaciones(): Promise<{ concedido: boolean }> }>('AjustesTelefono');

  disponible(): boolean {
    return true;
  }

  vigilar(alLeer: (l: LecturaDispositivo) => void, alFallar: (f: FalloUbicacion) => void): () => void {
    let detenido = false;
    // Primero el permiso de notificaciones (para ver "compartiendo ubicación"); negarlo no impide compartir.
    const id = this.ajustes
      .solicitarNotificaciones()
      .catch(() => undefined)
      .then(() =>
        this.plugin.addWatcher(
          {
            backgroundTitle: 'RutaRola está compartiendo la ubicación',
            backgroundMessage: 'El colegio y los acudientes ven la ruta mientras el recorrido está en curso.',
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (ubicacion, error) => {
            if (detenido) return;
            if (error) {
              alFallar(error.code === 'NOT_AUTHORIZED' ? 'SIN_PERMISO' : 'TEMPORAL');
              return;
            }
            if (!ubicacion) return;
            alLeer({
              timestamp: ubicacion.time ?? Date.now(),
              coords: {
                latitude: ubicacion.latitude,
                longitude: ubicacion.longitude,
                accuracy: ubicacion.accuracy,
                speed: ubicacion.speed,
                heading: ubicacion.bearing,
              },
            });
          },
        ),
      )
      .catch(() => {
        alFallar('TEMPORAL');
        return null;
      });
    return () => {
      detenido = true;
      void id.then((i) => (i ? this.plugin.removeWatcher({ id: i }) : undefined)).catch(() => undefined);
    };
  }

  /** El servicio nativo no se pausa en segundo plano: no hace falta pedir otra lectura. */
  leerAhora(): void {
    /* nada */
  }

  /** Abre los ajustes de la app (para permitir la ubicación si se negó). */
  abrirAjustes(): Promise<void> {
    return this.plugin.openSettings();
  }
}
