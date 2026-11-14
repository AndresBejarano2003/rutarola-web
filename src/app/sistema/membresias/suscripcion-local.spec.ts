import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FILTROS_VEHICULO_VACIOS } from 'src/app/operacion/vehiculos/vehiculo';
import { VehiculosRepositorio } from 'src/app/operacion/vehiculos/vehiculos-repositorio';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { CLAVE_DIAS_PRUEBA } from './suscripcion';
import { CLAVE_SUSCRIPCION_LOCAL } from './suscripcion-local';
import { SuscripcionRepositorio } from './suscripcion-repositorio';

describe('Prueba gratuita y plan Gratis (modo local)', () => {
  const dia = 86_400_000;
  let ahora = new Date('2026-11-01T08:00:00').getTime();

  beforeEach(() => {
    localStorage.clear();
    ahora = new Date('2026-11-01T08:00:00').getTime();
    vi.useFakeTimers({ now: ahora, toFake: ['Date'] });
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
  });

  afterEach(() => vi.useRealTimers());

  it('la prueba conserva los días con que empezó aunque la plataforma los cambie', async () => {
    const repo = TestBed.inject(SuscripcionRepositorio);
    const s = await firstValueFrom(repo.actual());
    expect(s).toMatchObject({ estado: 'PRUEBA', plan: 'PROFESIONAL', diasPrueba: 15, pendienteDecision: false });

    await firstValueFrom(repo.actualizarParametroPlataforma(CLAVE_DIAS_PRUEBA, '20'));
    expect((await firstValueFrom(repo.condiciones())).diasPrueba).toBe(20);
    expect((await firstValueFrom(repo.actual())).diasPrueba).toBe(15);
  });

  it('al vencer pide decidir y "seguir en Gratis" inactiva los vehículos que sobran', async () => {
    const repo = TestBed.inject(SuscripcionRepositorio);
    const vehiculos = TestBed.inject(VehiculosRepositorio);
    await firstValueFrom(repo.actual());
    const activosAntes = (await firstValueFrom(vehiculos.listar({ ...FILTROS_VEHICULO_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR))).total;
    expect(activosAntes).toBeGreaterThan(1);

    vi.setSystemTime(ahora + 16 * dia);
    const vencida = await firstValueFrom(repo.actual());
    expect(vencida).toMatchObject({ plan: 'GRATIS', pendienteDecision: true, planVencido: 'PROFESIONAL' });

    const decision = await firstValueFrom(repo.continuarGratis());
    expect(decision.suscripcion.pendienteDecision).toBe(false);
    expect(decision.inactivados.vehiculos).toHaveLength(activosAntes - 1);
    expect((await firstValueFrom(vehiculos.listar({ ...FILTROS_VEHICULO_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR))).total).toBe(1);
    await expect(firstValueFrom(repo.continuarGratis())).rejects.toThrow();
  });

  it('quien se registró en Gratis puede iniciar la prueba una sola vez', async () => {
    const repo = TestBed.inject(SuscripcionRepositorio);
    // La prueba de siempre ya la usó: no se repite.
    await firstValueFrom(repo.actual());
    vi.setSystemTime(ahora + 16 * dia);
    await firstValueFrom(repo.actual());
    await firstValueFrom(repo.continuarGratis());
    await expect(firstValueFrom(repo.iniciarPrueba())).rejects.toThrow(/ya usó la prueba/);

    // Registro en Gratis (sin prueba usada): no vence ni pide decidir; puede probar Profesional.
    const gratis = await firstValueFrom(repo.actual());
    localStorage.setItem(CLAVE_SUSCRIPCION_LOCAL, JSON.stringify({ ...gratis, pruebaUsada: false, diasPrueba: 0, planVencido: '', fechaVencimiento: null }));
    vi.setSystemTime(ahora + 400 * dia);
    expect(await firstValueFrom(repo.actual())).toMatchObject({ estado: 'GRATIS', pendienteDecision: false, pruebaUsada: false });

    const prueba = await firstValueFrom(repo.iniciarPrueba());
    expect(prueba).toMatchObject({ estado: 'PRUEBA', plan: 'PROFESIONAL', pruebaUsada: true, diasPrueba: 15 });
    await expect(firstValueFrom(repo.iniciarPrueba())).rejects.toThrow(/ya tiene un plan/);
  });
});
