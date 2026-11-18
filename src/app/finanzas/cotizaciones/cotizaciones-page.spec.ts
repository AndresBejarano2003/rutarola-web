import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import CotizacionesPage from './cotizaciones-page';

describe('CotizacionesPage', () => {
  let fixture: ComponentFixture<CotizacionesPage>;
  let el: HTMLElement;
  let ui: ReturnType<typeof pantalla>;

  beforeEach(async () => {
    localStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ imports: [CotizacionesPage], providers: [provideRouter([]), ...repositoriosDePrueba()] });
    fixture = TestBed.createComponent(CotizacionesPage);
    el = fixture.nativeElement;
    ui = pantalla(el);
    await estabilizar(fixture);
  });

  it('lista las cotizaciones', () => {
    expect(ui.filas('app-cotizaciones-tabla').length).toBeGreaterThan(0);
    expect(el.textContent).toContain('COT-0001');
  });

  it('cotiza a un cliente nuevo con un valor por estudiante y calcula el total del servicio', async () => {
    ui.boton('Nueva cotización').click();
    await estabilizar(fixture);
    ui.boton('No, es un cliente nuevo').click();
    await estabilizar(fixture);
    ui.escribir('nombreAcudiente', 'Cliente Nuevo');
    const modal = el.querySelector('app-modal') as HTMLElement;
    const nombre = modal.querySelector('input[aria-label="Nombre del estudiante"]') as HTMLInputElement;
    const valor = modal.querySelector('input[aria-label="Valor mensual del estudiante"]') as HTMLInputElement;
    const colegio = modal.querySelector('app-selector-busqueda[etiqueta="Colegio"] input') as HTMLInputElement;
    for (const [estudiante, mensual] of [['Ana', '400000'], ['Luis', '350000']]) {
      nombre.value = estudiante;
      nombre.dispatchEvent(new Event('input'));
      colegio.dispatchEvent(new Event('focus'));
      colegio.value = 'San José';
      colegio.dispatchEvent(new Event('input'));
      colegio.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      valor.value = mensual;
      valor.dispatchEvent(new Event('input'));
      await estabilizar(fixture);
      ui.boton('Agregar').click();
      await estabilizar(fixture);
    }
    const texto = modal.textContent?.replace(/\s/g, '') ?? '';
    expect(texto).toContain('ColegioSanJosé');
    expect(texto).toMatch(/750[.,]000/); // mensual = 400.000 + 350.000
    expect(texto).toMatch(/7[.,]500[.,]000/); // × 10 meses (valor por defecto del servicio)

    ui.boton('Registrar cotización').click();
    await estabilizar(fixture, 3);
    expect(el.textContent).toContain('Cliente Nuevo');
  });
});
