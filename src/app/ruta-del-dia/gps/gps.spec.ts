import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { urlHub } from 'src/app/core/tiempo-real';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { RecorridosRepositorio } from '../recorridos-repositorio';
import { CLAVE_COLA_GPS, EmisorGps } from './emisor-gps';
import { LecturaGps, MAXIMO_EN_COLA, ResultadoLoteGps, distanciaMetros, encolar, haceCuanto, lecturaDe, lecturaUtil, saltoImposible } from './gps';
import { GpsRepositorio } from './gps-repositorio';

const posicion = (t: number, precision = 10, velocidad: number | null = 10, lat = 2.9273): GeolocationPosition =>
  ({
    timestamp: t,
    coords: { latitude: lat, longitude: -75.2819, accuracy: precision, speed: velocidad, heading: 90, altitude: null, altitudeAccuracy: null },
  }) as unknown as GeolocationPosition;

describe('GPS: reglas puras', () => {
  it('convierte la lectura del navegador al formato del API', () => {
    const l = lecturaDe(posicion(Date.parse('2026-11-05T12:00:00Z'), 10, 10));
    expect(l).toEqual({ latitud: 2.9273, longitud: -75.2819, velocidad: 36, rumbo: 90, fecha: '2026-11-05T12:00:00.000Z' });
    expect(lecturaDe(posicion(0, 10, null)).velocidad).toBeNull();
    expect(lecturaDe(posicion(0, 10, 200)).velocidad).toBeNull(); // 720 km/h: fuera de rango
  });

  it('detecta saltos imposibles (más de 150 km/h) sin castigar el error normal en una parada', () => {
    const a = { latitud: 2.9273, longitud: -75.2819, fecha: '2026-11-05T12:00:00Z' };
    expect(Math.round(distanciaMetros(a, { ...a, latitud: 2.9283 }))).toBe(111);
    expect(saltoImposible(a, { ...a, latitud: 2.9283, fecha: '2026-11-05T12:00:06Z' })).toBe(false); // 66 km/h
    expect(saltoImposible(a, { ...a, latitud: 2.9373, fecha: '2026-11-05T12:00:06Z' })).toBe(true); // 1,1 km en 6 s
    expect(saltoImposible(a, { ...a, latitud: 2.9373, fecha: '2026-11-05T12:01:30Z' })).toBe(false); // tras 90 s sin señal
    expect(saltoImposible(a, { ...a, latitud: 2.928, fecha: '2026-11-05T12:00:01Z' })).toBe(false); // < 100 m
  });

  it('descarta lecturas imprecisas o demasiado seguidas y limita la cola', () => {
    const anterior = lecturaDe(posicion(10_000));
    expect(lecturaUtil(posicion(20_000, 500), anterior)).toBe(false);
    expect(lecturaUtil(posicion(12_000), anterior)).toBe(false);
    expect(lecturaUtil(posicion(15_000), anterior)).toBe(true);
    expect(lecturaUtil(posicion(0), undefined)).toBe(true);

    const llena = Array.from({ length: MAXIMO_EN_COLA }, (_, i) => lecturaDe(posicion(i * 5_000)));
    const nueva = encolar(llena, lecturaDe(posicion(MAXIMO_EN_COLA * 5_000)));
    expect(nueva.length).toBe(MAXIMO_EN_COLA);
    expect(nueva[0]).toBe(llena[1]);
  });

  it('describe la antigüedad y arma la URL del hub', () => {
    const ahora = Date.parse('2026-11-05T12:00:00Z');
    expect(haceCuanto('2026-11-05T11:59:30Z', ahora)).toBe('hace un momento');
    expect(haceCuanto('2026-11-05T11:55:00Z', ahora)).toBe('hace 5 min');
    expect(urlHub('https://api.rutarola.co/api/v1')).toBe('https://api.rutarola.co/hubs/recorridos');
    expect(urlHub('/api/v1')).toBe('/hubs/recorridos');
  });
});

describe('GPS local', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
  });

  const sesion = (rol: 'CONDUCTOR' | 'MONITORA' | 'ACUDIENTE' | 'ADMINISTRADOR', empleadoId: string | null) =>
    TestBed.inject(AuthService).abrirSesion({ usuario: 'u', nombre: 'U', correo: '', rol, empleadoId, imagen: '', inicio: '' });

  it('solo el personal envía; repetidas y fuera del periodo se descartan; el acudiente ve solo en curso', async () => {
    sesion('CONDUCTOR', 'emp-1');
    const recorridos = TestBed.inject(RecorridosRepositorio);
    const [ruta] = await firstValueFrom(recorridos.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(recorridos.iniciar(ruta.asignacionId, 'RECOGIDA'));
    const gps = TestBed.inject(GpsRepositorio);
    const ahora = Date.now();
    const l = (ms: number, lat = 2.9): LecturaGps => ({ latitud: lat, longitud: -75.28, velocidad: 20, rumbo: null, fecha: new Date(ahora + ms).toISOString() });

    const lote = await firstValueFrom(gps.enviar(r.id, [l(-20_000, 2.1), l(-10_000, 2.2), l(-10_000, 2.3), l(-3 * 3_600_000)]));
    expect([lote.recibidas, lote.descartadas]).toEqual([2, 2]);
    expect(lote.ultima?.latitud).toBe(2.2);
    expect((await firstValueFrom(gps.trayecto(r.id))).map((p) => p.latitud)).toEqual([2.1, 2.2]);

    sesion('ADMINISTRADOR', null);
    const mapa = await firstValueFrom(gps.enCurso());
    expect(mapa).toHaveLength(1);
    expect(mapa[0].posicion?.latitud).toBe(2.2);
    await expect(firstValueFrom(gps.enviar(r.id, [l(0)]))).rejects.toThrow('no pertenece a tus rutas');

    sesion('ACUDIENTE', null);
    expect((await firstValueFrom(gps.ultima(r.id)))?.latitud).toBe(2.2);
    await expect(firstValueFrom(gps.trayecto(r.id))).rejects.toThrow('permiso');
  });
});

describe('Emisor GPS', () => {
  let enviados: LecturaGps[][];
  let responder: () => Observable<ResultadoLoteGps>;
  let alLeer: ((p: GeolocationPosition) => void) | null;

  beforeEach(() => {
    localStorage.clear();
    enviados = [];
    alLeer = null;
    responder = () => of({ recibidas: 1, descartadas: 0, ultima: null });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (exito: (p: GeolocationPosition) => void) => {
          alLeer = exito;
          return 7;
        },
        clearWatch: vi.fn(),
      },
    });
    TestBed.configureTestingModule({
      providers: [
        EmisorGps,
        {
          provide: GpsRepositorio,
          useValue: {
            enviar: (_id: string, lecturas: LecturaGps[]) => {
              enviados.push(lecturas);
              return responder();
            },
          },
        },
      ],
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('guarda las lecturas, las envía y conserva las pendientes sin red', async () => {
    const emisor = TestBed.inject(EmisorGps);
    emisor.iniciar('rec-1');
    expect(emisor.estado()).toBe('BUSCANDO');

    responder = () => throwError(() => ({ status: 0 }));
    alLeer?.(posicion(Date.now() - 10_000, 10, 5, 2.1));
    alLeer?.(posicion(Date.now(), 10, 5, 2.1005));
    expect(emisor.estado()).toBe('ACTIVO');
    expect(emisor.pendientes()).toBe(2);
    await emisor.enviarPendientes();
    expect(emisor.sinConexion()).toBe(true);
    expect(emisor.pendientes()).toBe(2);

    responder = () => of({ recibidas: 2, descartadas: 0, ultima: null });
    await emisor.detenerYEnviar();
    expect(enviados.at(-1)?.map((l) => l.latitud)).toEqual([2.1, 2.1005]);
    expect(emisor.pendientes()).toBe(0);
    expect(localStorage.getItem(CLAVE_COLA_GPS)).toBe('{}');
    expect(emisor.estado()).toBe('APAGADO');
  });

  it('descarta un salto imposible del GPS, pero si se repite acepta la nueva ubicación', () => {
    const emisor = TestBed.inject(EmisorGps);
    emisor.iniciar('rec-1');
    const t = Date.now() - 60_000;
    alLeer?.(posicion(t, 10, 5, 2.9273));
    alLeer?.(posicion(t + 6_000, 10, 5, 2.9283)); // 110 m en 6 s ≈ 66 km/h: normal
    alLeer?.(posicion(t + 12_000, 10, 5, 3.4)); // 52 km en 6 s: salto
    expect(emisor.pendientes()).toBe(2);
    alLeer?.(posicion(t + 18_000, 10, 5, 3.4001));
    alLeer?.(posicion(t + 24_000, 10, 5, 3.4002)); // tercera seguida lejos: la equivocada era la anterior
    expect(emisor.pendientes()).toBe(3);
    emisor.detener();
  });

  it('avisa cuánto estuvo en pausa la ubicación al volver de otra app y reanuda la lectura', () => {
    let visibilidad: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidad });
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const emisor = TestBed.inject(EmisorGps);
      emisor.iniciar('rec-1');
      visibilidad = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      vi.setSystemTime(Date.now() + 4 * 60_000);
      visibilidad = 'visible';
      alLeer = null;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(emisor.pausa()).toBe(4);
      expect(alLeer).not.toBeNull(); // volvió a vigilar la posición
      emisor.detener();
      expect(emisor.pausa()).toBeNull();
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('descarta las lecturas que el servidor nunca aceptará (recorrido ajeno)', async () => {
    localStorage.setItem(CLAVE_COLA_GPS, JSON.stringify({ viejo: [lecturaDe(posicion(0))] }));
    responder = () => throwError(() => ({ status: 404 }));
    const emisor = TestBed.inject(EmisorGps);
    expect(emisor.pendientes()).toBe(1);
    await emisor.enviarPendientes();
    expect(emisor.pendientes()).toBe(0);
  });
});
