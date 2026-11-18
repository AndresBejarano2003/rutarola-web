import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { fechaIso, sumarDias } from 'src/app/shared/fechas/fechas';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { VehiculosRepositorio } from '../vehiculos-repositorio';
import { FILTROS_GASTO_VACIOS, GastoVehiculo, fechasDeRango, mesesEntre, resumirGastos } from './gasto-vehiculo';
import { GastosVehiculoRepositorio } from './gastos-vehiculo-repositorio';

describe('Gastos del vehículo', () => {
  const gasto = (cambios: Partial<GastoVehiculo>): GastoVehiculo => ({
    id: crypto.randomUUID(), vehiculoId: 'v1', vehiculo: 'AAA111 · Interno 1', tipo: 'OTRO', fecha: '2026-01-10', valor: 0, descripcion: '',
    proveedor: '', referencia: '', kilometraje: null, cantidad: null, archivo: null, ...cambios,
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
  });

  it('resume totales, promedio mensual, combustible y rendimiento (igual que el API)', () => {
    const r = resumirGastos([
      gasto({ tipo: 'COMBUSTIBLE', fecha: '2026-01-05', valor: 200000, kilometraje: 10000, cantidad: 15 }),
      gasto({ tipo: 'COMBUSTIBLE', fecha: '2026-02-05', valor: 200000, kilometraje: 10600, cantidad: 20 }),
      gasto({ tipo: 'REPUESTO', fecha: '2026-02-20', valor: 400000 }),
      gasto({ vehiculoId: 'v2', vehiculo: 'BBB222 · Interno 2', tipo: 'LAVADO', fecha: '2026-02-21', valor: 30000 }),
    ]);
    expect(r).toMatchObject({ total: 830000, cantidad: 4, promedioMensual: 415000, combustible: 400000, galones: 35 });
    expect([r.kilometrosRecorridos, r.costoPorKilometro, r.kilometrosPorGalon]).toEqual([600, 1383, 30]);
    expect(r.porTipo[0].tipo).toBe('COMBUSTIBLE');
    expect(r.porMes).toEqual([
      { periodo: '2026-01', total: 200000, combustible: 200000 },
      { periodo: '2026-02', total: 630000, combustible: 200000 },
    ]);
    expect(r.porVehiculo.map((v) => v.vehiculoId)).toEqual(['v1', 'v2']);
    expect(resumirGastos([])).toMatchObject({ total: 0, promedioMensual: 0, kilometrosRecorridos: null, costoPorKilometro: null });
    expect(mesesEntre('2025-11-30', '2026-01-01')).toBe(3);
    expect(fechasDeRango('TRES_MESES', new Date(2026, 4, 15))).toEqual({ desde: '2026-03-01', hasta: '' });
  });

  it('registra con las validaciones del API y el vehículo con gastos no se elimina', async () => {
    const repo = TestBed.inject(GastosVehiculoRepositorio);
    const base = { vehiculoId: 'veh-4', vehiculo: '', tipo: 'COMBUSTIBLE' as const, fecha: fechaIso(), valor: 150000, descripcion: '', proveedor: ' Terpel ',
      referencia: '', kilometraje: 1000, cantidad: null, archivo: null };
    await expect(firstValueFrom(repo.crear(base))).rejects.toThrow('galones');
    await expect(firstValueFrom(repo.crear({ ...base, cantidad: 10, fecha: sumarDias(fechaIso(), 1) }))).rejects.toThrow('futura');
    const creado = await firstValueFrom(repo.crear({ ...base, cantidad: 10 }));
    expect(creado.proveedor).toBe('Terpel');
    expect(creado.vehiculo).toMatch(/· Interno /);

    const delVehiculo = await firstValueFrom(repo.listar({ ...FILTROS_GASTO_VACIOS, vehiculoId: 'veh-4' }, SIN_PAGINAR));
    expect(delVehiculo.total).toBe(1);
    const resumen = await firstValueFrom(repo.resumen({ ...FILTROS_GASTO_VACIOS, vehiculoId: 'veh-4' }));
    expect(resumen.total).toBe(150000);
    expect(await firstValueFrom(TestBed.inject(VehiculosRepositorio).motivoNoEliminar('veh-4'))).toContain('gasto');
  });
});
