import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import PublicidadPage from './publicidad-page';

describe('PublicidadPage', () => {
  beforeEach(() => {
    localStorage.clear();
    simularDialogos();
  });

  it('abre el adhesivo y la tarjeta con la vista previa y recuerda los cambios en el equipo', async () => {
    TestBed.configureTestingModule({ imports: [PublicidadPage], providers: [provideRouter([]), ...repositoriosDePrueba()] });
    const fixture = TestBed.createComponent(PublicidadPage);
    await estabilizar(fixture, 3);
    const el = fixture.nativeElement as HTMLElement;
    const ui = pantalla(el);

    ui.boton('Adhesivo para vehículos').click();
    await estabilizar(fixture);
    const vista = el.querySelector('img[alt^="Vista previa del adhesivo"]') as HTMLImageElement;
    expect(vista.getAttribute('src')).toContain('data:image/svg+xml');
    const titulo = el.querySelector('app-modal input[maxlength="60"]') as HTMLInputElement;
    titulo.value = 'Tu ruta en el celular';
    titulo.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(decodeURIComponent(vista.getAttribute('src') ?? '')).toContain('celular');
    expect(localStorage.getItem('rutarola.publicidad.adhesivo')).toContain('Tu ruta en el celular');

    ui.boton('Cerrar').click();
    ui.boton('Tarjetas de presentación').click();
    await estabilizar(fixture);
    ui.boton('Reverso').click();
    await estabilizar(fixture);
    const reverso = el.querySelector('img[alt="Vista previa: reverso de la tarjeta"]') as HTMLImageElement;
    expect(decodeURIComponent(reverso.getAttribute('src') ?? '')).toContain('Google Play');
  });
});
