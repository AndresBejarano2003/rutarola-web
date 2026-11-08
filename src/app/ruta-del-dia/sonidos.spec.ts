import { TestBed } from '@angular/core/testing';
import { Sonidos } from './sonidos';

/** AudioContext mínimo: jsdom no tiene audio. Cuenta los osciladores que arrancan. */
class AudioContextFalso {
  static iniciados = 0;
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {};
  resume = () => Promise.resolve();
  createGain() {
    const param = { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined };
    return { gain: param, connect: (d: unknown) => d };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: (d: unknown) => d,
      start: () => AudioContextFalso.iniciados++,
      stop: () => undefined,
    };
  }
}

describe('Sonidos de la Ruta del día', () => {
  beforeEach(() => {
    localStorage.clear();
    AudioContextFalso.iniciados = 0;
    vi.stubGlobal('AudioContext', AudioContextFalso);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('suena el aviso de cambio de orden y respeta el silencio guardado en el teléfono', () => {
    const sonidos = TestBed.inject(Sonidos);
    sonidos.cambioOrden();
    expect(AudioContextFalso.iniciados).toBe(2);

    sonidos.alternar();
    expect(sonidos.silenciados()).toBe(true);
    expect(localStorage.getItem('rutarola.sonidos.silenciados')).toBe('1');
    sonidos.cambioOrden();
    expect(AudioContextFalso.iniciados).toBe(2);

    sonidos.alternar(); // al reactivar suena la confirmación
    expect(AudioContextFalso.iniciados).toBe(3);
  });

  it('sin Web Audio no falla', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => TestBed.inject(Sonidos).cambioOrden()).not.toThrow();
  });
});
