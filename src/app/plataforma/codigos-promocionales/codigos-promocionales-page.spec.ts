import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { PLANES } from 'src/app/sistema/membresias/suscripcion';
import { CodigoPromocional, descuentoCodigo, evaluarCodigo, vigenciaDe } from './codigo-promocional';
import CodigosPromocionalesPage from './codigos-promocionales-page';

describe('Códigos promocionales', () => {
  let fixture: ComponentFixture<CodigosPromocionalesPage>;
  let el: HTMLElement;
  let ui: ReturnType<typeof pantalla>;
  /** El radio de la tarjeta con ese texto (el `[value]` de un radio reactivo no llega al DOM). */
  const radio = (texto: string) =>
    [...el.querySelectorAll<HTMLLabelElement>('app-modal label')].find((l) => l.textContent?.includes(texto))!.querySelector('input') as HTMLInputElement;

  beforeEach(async () => {
    localStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ imports: [CodigosPromocionalesPage], providers: [provideRouter([]), ...repositoriosDePrueba()] });
    fixture = TestBed.createComponent(CodigosPromocionalesPage);
    el = fixture.nativeElement;
    ui = pantalla(el);
    await estabilizar(fixture);
  });

  it('lista, filtra, crea con validación y elimina un código sin usos', async () => {
    expect(ui.filas('table').length).toBe(1);
    expect(el.textContent).toContain('BIENVENIDA20');
    expect(el.textContent).toContain('20 % del primer mes');

    const buscar = el.querySelector('input[type="search"]') as HTMLInputElement;
    buscar.value = 'no-existe';
    buscar.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // filtros en vivo con 300 ms de espera
    await estabilizar(fixture, 3);
    expect(el.textContent).not.toContain('BIENVENIDA20');
    buscar.value = '';
    buscar.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350)); // filtros en vivo con 300 ms de espera
    await estabilizar(fixture, 3);

    ui.boton('Nuevo código').click();
    await estabilizar(fixture);
    ui.escribir('codigo', 'ab');
    ui.boton('Crear código').click();
    await estabilizar(fixture);
    expect(el.querySelector('app-modal')?.textContent).toContain('sin espacios');

    ui.escribir('codigo', 'regreso-50');
    radio('Valor fijo').click();
    ui.escribir('valor', '50000');
    radio('Empresas elegidas').click();
    await estabilizar(fixture);
    ui.boton('Crear código').click();
    await estabilizar(fixture);
    expect(el.querySelector('app-modal')?.textContent).toContain('Elige al menos una empresa');

    radio('Todas las empresas').click();
    ui.boton('Crear código').click();
    await estabilizar(fixture, 3);
    expect(ui.filas('table').length).toBe(2);
    expect(el.textContent).toContain('REGRESO-50');

    const fila = [...ui.filas('table')].find((f) => f.textContent?.includes('REGRESO-50')) as HTMLElement;
    (fila.querySelector('button[aria-label="Eliminar"]') as HTMLButtonElement).click();
    await estabilizar(fixture, 3);
    (el.querySelector('app-dialogo-confirmacion button.btn-error') as HTMLButtonElement).click();
    await estabilizar(fixture, 3);
    expect(ui.filas('table').length).toBe(1);
    expect(el.querySelector('table')?.textContent).not.toContain('REGRESO-50');
  });

  it('el descuento es solo de un mes y respeta vigencia, plan, periodo, alcance y usos', () => {
    const profesional = PLANES.find((p) => p.id === 'PROFESIONAL')!;
    expect(descuentoCodigo('PORCENTAJE', 20, 189_900, 1_899_000)).toBe(37_980);
    expect(descuentoCodigo('VALOR_FIJO', 500_000, 89_900, 89_900)).toBe(89_900);
    expect(vigenciaDe('2026-01-10', '2026-01-20', '2026-01-09')).toBe('PROGRAMADO');
    expect(vigenciaDe('2026-01-10', '2026-01-20', '2026-01-20')).toBe('VIGENTE');

    const base: CodigoPromocional = {
      id: 'c1', codigo: 'PROMO', descripcion: '', tipoDescuento: 'PORCENTAJE', valor: 20, fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
      alcance: 'TODAS', planes: [], periodo: '', usosMaximos: null, usosPorEmpresa: 1, estado: 'ACTIVO', empresaIds: [], usos: 0,
    };
    const ctx = { empresaId: 'e1', usosDeLaEmpresa: () => 0, primeraCompra: true };
    const hoy = '2026-06-01';
    expect(evaluarCodigo([base], ' promo ', profesional, 'ANUAL', ctx, hoy)).toMatchObject({ precio: 1_899_000, descuento: 37_980, total: 1_861_020 });
    expect(() => evaluarCodigo([base], 'promo', profesional, 'MENSUAL', ctx, '2027-01-01')).toThrow('venció');
    expect(() => evaluarCodigo([{ ...base, planes: ['ESENCIAL'] }], 'promo', profesional, 'MENSUAL', ctx, hoy)).toThrow('plan Profesional');
    expect(() => evaluarCodigo([{ ...base, periodo: 'ANUAL' }], 'promo', profesional, 'MENSUAL', ctx, hoy)).toThrow('anual');
    expect(() => evaluarCodigo([{ ...base, alcance: 'EMPRESAS', empresaIds: ['e2'] }], 'promo', profesional, 'MENSUAL', ctx, hoy)).toThrow('tu empresa');
    expect(() => evaluarCodigo([{ ...base, alcance: 'PRIMERA_COMPRA' }], 'promo', profesional, 'MENSUAL', { ...ctx, primeraCompra: false }, hoy)).toThrow('primera compra');
    expect(() => evaluarCodigo([{ ...base, usosMaximos: 3, usos: 3 }], 'promo', profesional, 'MENSUAL', ctx, hoy)).toThrow('límite');
    expect(() => evaluarCodigo([base], 'promo', profesional, 'MENSUAL', { ...ctx, usosDeLaEmpresa: () => 1 }, hoy)).toThrow('ya usó');
    expect(() => evaluarCodigo([{ ...base, estado: 'INACTIVO' }], 'promo', profesional, 'MENSUAL', ctx, hoy)).toThrow('no está activo');
  });
});
