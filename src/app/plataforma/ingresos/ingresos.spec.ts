import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { estabilizar, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { PagoSuscripcion } from 'src/app/sistema/membresias/suscripcion';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';
import { PagoConEmpresa, calcularIngresos, rangoPreset, variacion } from './ingresos';
import IngresosPage from './ingresos-page';
import { IngresosRepositorio } from './ingresos-repositorio';

function pago(dia: string, valor: number, cambios: Partial<PagoConEmpresa> = {}): PagoConEmpresa {
  const base: PagoSuscripcion = {
    id: `${dia}-${valor}`,
    referencia: 'MAN-1',
    plan: 'ESENCIAL',
    periodo: 'MENSUAL',
    valor,
    estado: 'APROBADO',
    metodoPago: 'MANUAL',
    idTransaccion: '',
    fechaCreacion: `${dia}T15:00:00Z`,
    fechaAplicacion: `${dia}T15:00:00Z`,
    codigoPromocional: '',
    descuento: 0,
  };
  return { ...base, empresaId: 'e1', empresa: 'Transportes Uno', ...cambios };
}

describe('Ingresos de la plataforma', () => {
  it('presets de periodo', () => {
    expect(rangoPreset('ESTE_MES', '2026-11-17')).toEqual({ desde: '2026-11-01', hasta: '2026-11-17' });
    expect(rangoPreset('MES_PASADO', '2026-01-10')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(rangoPreset('ULTIMOS_3', '2026-02-15')).toEqual({ desde: '2025-12-01', hasta: '2026-02-15' });
    expect(rangoPreset('ANIO_PASADO', '2026-02-15')).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(10, 0)).toBeNull();
  });

  it('suma solo los pagos aprobados del rango, compara con el periodo anterior y agrupa', () => {
    const pagos = [
      pago('2026-11-03', 89_900),
      pago('2026-11-10', 189_900, { plan: 'PROFESIONAL', empresaId: 'e2', empresa: 'Rutas Dos', metodoPago: 'CARD', descuento: 20_000 }),
      pago('2026-11-12', 50_000, { estado: 'PENDIENTE' }),
      pago('2026-10-20', 100_000),
    ];
    const r = calcularIngresos(pagos, '2026-11-01', '2026-11-30');
    expect(r).toMatchObject({ total: 279_800, pagos: 2, empresas: 2, ticketPromedio: 139_900, descuentos: 20_000, totalAnterior: 100_000, agrupacion: 'DIA' });
    expect(r.serie).toHaveLength(30);
    expect(r.serie.find((p) => p.periodo === '2026-11-10')?.total).toBe(189_900);
    expect(r.porPlan[0]).toMatchObject({ clave: 'PROFESIONAL', nombre: 'Profesional' });
    expect(r.porMetodo.map((m) => m.nombre)).toEqual(['Tarjeta', 'Registrado por la plataforma']);
    expect(r.topEmpresas[0].nombre).toBe('Rutas Dos');
    expect(r.detalle[0].fecha.slice(0, 10)).toBe('2026-11-10');

    const anual = calcularIngresos(pagos, '2026-01-01', '2026-12-31');
    expect(anual.agrupacion).toBe('MES');
    expect(anual.serie).toHaveLength(12);
  });

  describe('modo local', () => {
    beforeEach(() => {
      localStorage.clear();
      simularDialogos();
      TestBed.configureTestingModule({ providers: [provideRouter([]), ...repositoriosDePrueba()] });
    });

    it('el valor recibido al activar un plan a mano cuenta como ingreso', async () => {
      const suscripcion = TestBed.inject(SuscripcionRepositorio);
      await firstValueFrom(suscripcion.actual());
      const fin = new Date(Date.now() + 30 * 86_400_000).toISOString();
      await firstValueFrom(suscripcion.ajustar('local', { plan: 'ESENCIAL', estado: 'ACTIVA', periodo: 'MENSUAL', fechaFin: fin, nota: '', valorPagado: 89_900 }));
      const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
      const r = await firstValueFrom(TestBed.inject(IngresosRepositorio).obtener(`${hoy.slice(0, 7)}-01`, hoy));
      expect(r).toMatchObject({ total: 89_900, pagos: 1, empresasPagando: 1, recurrenteMensual: 89_900 });
      expect(r.detalle[0].metodo).toBe('Registrado por la plataforma');

      const fixture = TestBed.createComponent(IngresosPage);
      await estabilizar(fixture, 4);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Ingresos del periodo');
      expect(el.querySelectorAll('tbody tr').length).toBe(1);
      expect(el.querySelector('[role="alert"].alert-error')).toBeNull();
    });
  });
});
