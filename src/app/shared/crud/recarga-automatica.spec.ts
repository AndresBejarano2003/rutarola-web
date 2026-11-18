import { TestBed } from '@angular/core/testing';
import { INTERVALO_RECARGA, recargaAutomatica } from './recarga-automatica';

describe('recargaAutomatica', () => {
  let visibilidad: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.useFakeTimers();
    visibilidad = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidad });
    TestBed.configureTestingModule({ providers: [{ provide: INTERVALO_RECARGA, useValue: 1000 }] });
  });

  afterEach(() => vi.useRealTimers());

  function crear(puede = () => true) {
    const recargar = vi.fn();
    TestBed.runInInjectionContext(() => recargaAutomatica(recargar, puede));
    return { recargar };
  }

  it('recarga cada intervalo solo con la pantalla visible y se pone al día al volver', () => {
    const { recargar } = crear();
    vi.advanceTimersByTime(1000);
    expect(recargar).toHaveBeenCalledTimes(1);

    visibilidad = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);
    expect(recargar).toHaveBeenCalledTimes(1);

    visibilidad = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it('se salta el turno cuando no se puede (p. ej. guardando)', () => {
    let ocupado = true;
    const { recargar } = crear(() => !ocupado);
    vi.advanceTimersByTime(1000);
    expect(recargar).not.toHaveBeenCalled();
    ocupado = false;
    vi.advanceTimersByTime(1000);
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
