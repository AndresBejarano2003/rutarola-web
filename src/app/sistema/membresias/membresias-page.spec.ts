import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import MembresiasPage from './membresias-page';
import PlanesPublicosPage from './planes-publicos/planes-publicos-page';
import { costoPorEstudiante, leerRetornoPago, PLANES } from './suscripcion';

describe('Planes y membresías', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...repositoriosDePrueba()] });
  });

  it('muestra la prueba, el uso, los cuatro planes y cambia a precios anuales', async () => {
    const fixture = TestBed.createComponent(MembresiasPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    const ui = pantalla(el);
    expect(el.textContent).toContain('Prueba gratuita');
    expect(el.textContent).toContain('Vehículos activos');
    expect(el.querySelectorAll('app-tarjeta-plan').length).toBe(4);
    expect(el.textContent).toContain('Quedarme con Profesional');
    expect(el.textContent).toContain('Compara los planes');

    ui.boton('Anual').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('al año');
    expect(el.textContent).toContain('ahorras');

    // Sin Wompi configurado: el plan se solicita por Soporte.
    ui.boton('Mejorar a Empresarial').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('El pago en línea estará disponible muy pronto');
    expect(el.textContent).not.toContain('Pagar con Wompi');
    expect(ui.boton('Solicitar por Soporte')).toBeTruthy();
  });

  it('la página pública invita a registrarse', async () => {
    const fixture = TestBed.createComponent(PlanesPublicosPage);
    await estabilizar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('3 meses gratis');
    expect(el.querySelectorAll('app-tarjeta-plan').length).toBe(4);
  });

  it('lee la referencia y la transacción del retorno de Wompi y calcula el costo por estudiante', () => {
    expect(leerRetornoPago('RR-abc', '123-xyz')).toEqual({ referencia: 'RR-abc', idTransaccion: '123-xyz' });
    expect(leerRetornoPago('RR-abc?id=123-xyz', null)).toEqual({ referencia: 'RR-abc', idTransaccion: '123-xyz' });
    expect(leerRetornoPago(null, null)).toBeNull();
    expect(costoPorEstudiante(PLANES.find((p) => p.id === 'PROFESIONAL')!)).toBe(475);
    expect(PLANES.every((p) => p.precioAnual === p.precioMensual * 10)).toBe(true);
  });
});
