import { TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from 'src/app/app.routes';
import { AuthService, Sesion } from 'src/app/core/auth';
import { estabilizar, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { Presentacion, VIDEO_HORIZONTAL, VIDEO_VERTICAL, videoPresentacion } from './presentacion';

describe('Presentacion', () => {
  // jsdom no reproduce video.
  let play: MockInstance<() => Promise<void>>;
  beforeEach(() => {
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  });
  afterEach(() => vi.restoreAllMocks());

  it('silencia el video como propiedad y lo reproduce (Chrome de escritorio no lo hacía con el atributo)', async () => {
    const fixture = TestBed.createComponent(Presentacion);
    fixture.detectChanges();
    await fixture.whenStable();
    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.getAttribute('src')).toMatch(/^videos\/rutarola-logo-(16x9-_1_|9x16)\.mp4$/);
    expect(play).toHaveBeenCalled();
  });

  it('pasa al login si el navegador no deja reproducir', async () => {
    play.mockImplementation(() => Promise.reject(new DOMException('bloqueado', 'NotAllowedError')));
    const fixture = TestBed.createComponent(Presentacion);
    let termino = false;
    fixture.componentInstance.termino.subscribe(() => (termino = true));
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 450));
    expect(termino).toBe(true);
  });

  it('pasa al login si el video se queda cargando a mitad', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(Presentacion);
      let termino = false;
      fixture.componentInstance.termino.subscribe(() => (termino = true));
      fixture.detectChanges();
      const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
      video.dispatchEvent(new Event('playing'));
      video.dispatchEvent(new Event('waiting'));
      vi.advanceTimersByTime(2000);
      expect(termino).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(termino).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('elige el video según la forma de la pantalla', () => {
    expect(videoPresentacion(true)).toBe(VIDEO_VERTICAL);
    expect(videoPresentacion(false)).toBe(VIDEO_HORIZONTAL);
  });

  it('avisa que terminó al tocar "Saltar"', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(Presentacion);
      let termino = false;
      fixture.componentInstance.termino.subscribe(() => (termino = true));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('video')).toBeTruthy();
      (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
      vi.advanceTimersByTime(500);
      expect(termino).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('no deja la pantalla bloqueada si el video no arranca', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(Presentacion);
      let termino = false;
      fixture.componentInstance.termino.subscribe(() => (termino = true));
      fixture.detectChanges();
      vi.advanceTimersByTime(6000);
      expect(termino).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Rutas públicas', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), ...repositoriosDePrueba()] });
  });

  for (const url of ['/', '/no-existe/para-nada', '/inicio', '/portal']) {
    it(`sin sesión ${url} lleva al login`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      await estabilizar(harness.fixture);
      expect(TestBed.inject(Router).url.split('?')[0]).toBe('/login');
    });
  }

  it('con sesión una ruta inexistente lleva al inicio de su rol', async () => {
    TestBed.inject(AuthService).abrirSesion(
      { usuario: 'admin', nombre: 'Admin', correo: '', rol: 'ADMINISTRADOR', empleadoId: null, imagen: '', inicio: new Date().toISOString() } satisfies Sesion,
      false,
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no-existe');
    await estabilizar(harness.fixture);
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });
});
