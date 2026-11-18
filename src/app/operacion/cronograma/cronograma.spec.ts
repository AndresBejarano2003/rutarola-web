import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CLAVE_AVISOS_AUSENCIA, AvisoGuardado } from 'src/app/ruta-del-dia/avisos-ausencia';
import { RutasRepositorio } from 'src/app/operacion/rutas/rutas-repositorio';
import { FILTROS_RUTA_VACIOS } from 'src/app/operacion/rutas/ruta';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { estabilizar, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { esHabil, moverVista, rangoVista, semanasDelMes, sumarDiasCronograma } from './cronograma';
import CronogramaPage from './cronograma-page';
import { CronogramaRepositorio } from './cronograma-repositorio';

describe('Cronograma: calendario', () => {
  it('la semana va de lunes a domingo, el mes y el año completos', () => {
    expect(rangoVista('SEMANA', '2026-11-19')).toEqual({ desde: '2026-11-16', hasta: '2026-11-22' });
    expect(rangoVista('MES', '2026-02-10')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoVista('ANIO', '2026-07-04')).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' });
    expect(moverVista('MES', '2026-01-31', 1)).toBe('2026-02-01');
    expect(moverVista('SEMANA', '2026-11-19', -1)).toBe('2026-11-12');
    expect(esHabil('2026-11-21')).toBe(false);
    // Noviembre 2026 empieza en domingo: la primera semana tiene 6 huecos.
    const semanas = semanasDelMes('2026-11-01');
    expect(semanas[0].filter((d) => d === null)).toHaveLength(6);
    expect(semanas.flat().filter(Boolean)).toHaveLength(30);
  });
});

describe('Cronograma (modo local)', () => {
  beforeEach(() => {
    localStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...repositoriosDePrueba()] });
  });

  async function diaHabil(): Promise<string> {
    let d = sumarDiasCronograma(fechaIso(), 1);
    while (!esHabil(d)) d = sumarDiasCronograma(d, 1);
    return d;
  }

  it('cuenta las rutas de los días hábiles y muestra las ausencias avisadas', async () => {
    const repo = TestBed.inject(CronogramaRepositorio);
    const fecha = await diaHabil();
    const ruta = (await firstValueFrom(TestBed.inject(RutasRepositorio).listar({ ...FILTROS_RUTA_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR))).items[0];
    const aviso: Partial<AvisoGuardado> = {
      id: 'a1',
      estudianteId: ruta.estudianteIds[0],
      estudiante: 'Estudiante de prueba',
      fecha,
      trayecto: 'ENTREGA',
      motivo: 'POR_SU_CUENTA',
      nota: 'Lo recoge la abuela',
      acudiente: 'Acudiente',
      confirmado: false,
      confirmadoPor: '',
    };
    localStorage.setItem(CLAVE_AVISOS_AUSENCIA, JSON.stringify([aviso]));

    const semana = await firstValueFrom(repo.obtener(...(Object.values(rangoVista('SEMANA', fecha)) as [string, string])));
    expect(semana.dias).toHaveLength(7);
    expect(semana.dias.filter((d) => !d.habil).every((d) => d.rutas === 0)).toBe(true);
    const delDia = semana.dias.find((d) => d.fecha === fecha)!;
    expect(delDia.ausencias).toBe(1);
    expect(delDia.rutas).toBeGreaterThan(0);

    const detalle = await firstValueFrom(repo.dia(fecha));
    const conAviso = detalle.rutas.find((r) => r.rutaId === ruta.id)!;
    expect(conAviso.ausencias).toBe(1);
    expect(conAviso.trayectos.map((t) => t.estado)).toEqual(['PROGRAMADO', 'PROGRAMADO']);
    expect(detalle.ausencias[0]).toMatchObject({ trayecto: 'ENTREGA', motivo: 'POR_SU_CUENTA', nota: 'Lo recoge la abuela' });
    expect(detalle.ausencias[0].ruta).toContain(ruta.codigo);

    await expect(firstValueFrom(repo.obtener('2026-01-01', '2027-06-01'))).rejects.toThrow(/máximo un año/);
  });

  it('la pantalla muestra la semana y el detalle del día con la ausencia', async () => {
    const fecha = await diaHabil();
    const ruta = (await firstValueFrom(TestBed.inject(RutasRepositorio).listar({ ...FILTROS_RUTA_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR))).items[0];
    localStorage.setItem(
      CLAVE_AVISOS_AUSENCIA,
      JSON.stringify([{ id: 'a1', estudianteId: ruta.estudianteIds[0], estudiante: 'Sofía Prueba', fecha, trayecto: '', motivo: 'NO_ASISTE', nota: '', acudiente: 'Ana', confirmado: false, confirmadoPor: '' }]),
    );
    const fixture = TestBed.createComponent(CronogramaPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cronograma');
    expect(el.querySelectorAll('[aria-pressed]').length).toBe(7);

    const boton = [...el.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find((b) => b.textContent?.includes('no viaja'));
    // El día con el aviso puede caer la semana siguiente (si hoy es viernes): se navega a ella.
    if (!boton) {
      (el.querySelector('[aria-label="Siguiente"]') as HTMLButtonElement).click();
      await estabilizar(fixture, 4);
    }
    [...el.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find((b) => b.textContent?.includes('no viaja'))!.click();
    await estabilizar(fixture, 4);
    expect(el.querySelector('#detalle-dia')?.textContent).toContain('Sofía Prueba');
    expect(el.querySelector('#detalle-dia')?.textContent).toContain('No asiste al colegio');
    expect(el.querySelector('[role="alert"].alert-error')).toBeNull();
  });
});
