import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { FILTROS_RUTA_VACIOS } from './ruta';
import { RutasRepositorio } from './rutas-repositorio';
import RutasPage from './rutas-page';

describe('RutasPage', () => {
  let fixture: ComponentFixture<RutasPage>;
  let el: HTMLElement;
  let ui: ReturnType<typeof pantalla>;

  /** Elige en el selector "Agregar colegio" (no tiene formControlName). */
  const elegirColegio = (texto: string) => {
    const campo = el.querySelector('app-modal form app-selector-busqueda:not([formcontrolname]) input') as HTMLInputElement;
    campo.dispatchEvent(new Event('focus'));
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  };

  beforeEach(async () => {
    localStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ imports: [RutasPage], providers: [provideRouter([]), ...repositoriosDePrueba()] });
    fixture = TestBed.createComponent(RutasPage);
    el = fixture.nativeElement;
    ui = pantalla(el);
    await estabilizar(fixture);
  });

  it('lista las rutas', () => {
    expect(ui.filas('app-rutas-tabla').length).toBe(4);
    expect(el.textContent).toContain('R-01');
  });

  it('arma una ruta con varios colegios: precarga sus estudiantes libres de la jornada y se quitan los que no van', async () => {
    ui.boton('Nueva ruta').click();
    await estabilizar(fixture);
    ui.boton('Registrar ruta').click();
    await estabilizar(fixture);
    expect(el.querySelector('app-modal')?.textContent).toContain('obligatorio');

    ui.escribir('nombre', 'Mixta');
    ui.escribir('sector', 'Kennedy');
    ui.elegir('jornada', 'Mañana');
    await estabilizar(fixture, 3);
    // El Colegio Enrique Olaya Herrera: sus dos estudiantes de la mañana entran solos.
    elegirColegio('Olaya');
    await estabilizar(fixture);
    ui.boton('Agregar colegio').click();
    await estabilizar(fixture, 4);
    const modal = el.querySelector('app-modal') as HTMLElement;
    expect(modal.textContent).toContain('Emiliano');
    expect(modal.textContent).toContain('Sara');
    // El San José: sus estudiantes ya van en la R-01, no se precargan.
    elegirColegio('San José');
    await estabilizar(fixture);
    ui.boton('Agregar colegio').click();
    await estabilizar(fixture, 4);
    expect(modal.textContent).toContain('Sin estudiantes de este colegio');

    // Quitar a Sara con su casilla.
    const casilla = modal.querySelector('input[aria-label^="Seleccionar a Sara"]') as HTMLInputElement;
    casilla.checked = true;
    casilla.dispatchEvent(new Event('change'));
    await estabilizar(fixture);
    ui.boton('Quitar seleccionados').click();
    await estabilizar(fixture);

    ui.boton('Registrar ruta').click();
    await estabilizar(fixture, 4);
    const { items } = await firstValueFrom(TestBed.inject(RutasRepositorio).listar({ ...FILTROS_RUTA_VACIOS, texto: 'Mixta' }, { pagina: 1, tamano: 10 }));
    expect(items[0]).toMatchObject({ colegioIds: ['col-4', 'col-5'], estudianteIds: ['est-8'], codigo: 'R-05' });
  });
});
