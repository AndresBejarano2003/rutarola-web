import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { AvisosAusenciaRepositorio } from 'src/app/operacion/avisos-ausencia/avisos-ausencia-repositorio';
import { PortalRepositorio } from 'src/app/portal/portal-repositorio';
import { fechaIso, sumarDias } from 'src/app/shared/fechas/fechas';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { avisoAplica, motivoAlConfirmar, textoAviso } from './avisos-ausencia';
import { RecorridosRepositorio } from './recorridos-repositorio';

describe('Avisos de ausencia', () => {
  const entrar = (rol: 'ACUDIENTE' | 'CONDUCTOR', id: string) =>
    TestBed.inject(AuthService).abrirSesion({
      usuario: 'x', nombre: rol === 'CONDUCTOR' ? 'José Cárdenas' : 'María Pérez', correo: '', rol, imagen: '', inicio: '',
      empleadoId: rol === 'CONDUCTOR' ? id : null, acudienteId: rol === 'ACUDIENTE' ? id : null,
    });
  const portal = () => TestBed.inject(PortalRepositorio);
  const recorridos = () => TestBed.inject(RecorridosRepositorio);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers({ now: new Date('2026-11-05T06:30:00'), toFake: ['Date'] });
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...repositoriosDePrueba()] });
  });

  afterEach(() => vi.useRealTimers());

  it('aplica por fecha y trayecto y se confirma con el motivo correcto', () => {
    const a = { estudianteId: 'e', fecha: '2026-11-05', trayecto: '' as const };
    expect(avisoAplica(a, 'e', '2026-11-05', 'ENTREGA')).toBe(true);
    expect(avisoAplica({ ...a, trayecto: 'RECOGIDA' }, 'e', '2026-11-05', 'ENTREGA')).toBe(false);
    expect(motivoAlConfirmar({ motivo: 'NO_ASISTE' }, 'RECOGIDA')).toBe('NO_ASISTE');
    expect(motivoAlConfirmar({ motivo: 'NO_ASISTE' }, 'ENTREGA')).toBe('POR_SU_CUENTA');
    expect(textoAviso({ motivo: 'POR_SU_CUENTA', trayecto: 'ENTREGA' })).toContain('entrega');
  });

  it('el acudiente avisa solo por sus estudiantes, de hoy a 30 días y sin repetir el día', async () => {
    entrar('ACUDIENTE', 'acu-1');
    const hoy = fechaIso();
    await firstValueFrom(portal().crearAviso({ estudianteId: 'est-2', fecha: hoy, trayecto: null, motivo: 'NO_ASISTE', nota: 'Cita médica' }));
    const datos = await firstValueFrom(portal().obtener());
    expect(datos.estudiantes.find((e) => e.id === 'est-2')?.avisos).toMatchObject([{ motivo: 'NO_ASISTE', nota: 'Cita médica', confirmado: false }]);

    await expect(
      firstValueFrom(portal().crearAviso({ estudianteId: 'est-2', fecha: hoy, trayecto: 'ENTREGA', motivo: 'POR_SU_CUENTA', nota: '' })),
    ).rejects.toThrow('Ya hay un aviso');
    await expect(
      firstValueFrom(portal().crearAviso({ estudianteId: 'est-2', fecha: sumarDias(hoy, 31), trayecto: null, motivo: 'NO_ASISTE', nota: '' })),
    ).rejects.toThrow('30 días');
    await expect(
      firstValueFrom(portal().crearAviso({ estudianteId: 'est-ajeno', fecha: hoy, trayecto: null, motivo: 'NO_ASISTE', nota: '' })),
    ).rejects.toThrow('no existe');
  });

  it('el conductor lo ve en la parada, lo confirma al marcarlo ausente y el administrador lo ve confirmado', async () => {
    entrar('ACUDIENTE', 'acu-1');
    await firstValueFrom(portal().crearAviso({ estudianteId: 'est-2', fecha: fechaIso(), trayecto: null, motivo: 'NO_ASISTE', nota: '' }));

    entrar('CONDUCTOR', 'emp-1');
    const [ruta] = await firstValueFrom(recorridos().rutasDelDia(fechaIso()));
    expect(ruta.avisosAusencia).toBe(1);
    const r = await firstValueFrom(recorridos().iniciar(ruta.asignacionId, 'RECOGIDA'));
    expect(r.paradas.find((p) => p.estudianteId === 'est-2')?.aviso).toMatchObject({ motivo: 'NO_ASISTE', confirmado: false });
    expect(r.paradas.find((p) => p.estudianteId === 'est-1')?.aviso).toBeNull();

    const marcado = await firstValueFrom(recorridos().marcar(r.id, ['est-2'], 'AUSENTE', 'NO_ASISTE'));
    expect(marcado.paradas.find((p) => p.estudianteId === 'est-2')?.aviso).toMatchObject({ confirmado: true, confirmadoPor: 'José Luis Cárdenas Rojas' });

    const [aviso] = await firstValueFrom(TestBed.inject(AvisosAusenciaRepositorio).listar({ fecha: '', rutaId: '' }));
    expect(aviso).toMatchObject({ estudianteId: 'est-2', confirmado: true });

    // Ya confirmado: el acudiente no lo puede retirar.
    entrar('ACUDIENTE', 'acu-1');
    await expect(firstValueFrom(portal().cancelarAviso(aviso.id))).rejects.toThrow('ya confirmó');

    // "Deshacer" lo deja otra vez sin confirmar y entonces sí se puede retirar.
    entrar('CONDUCTOR', 'emp-1');
    await firstValueFrom(recorridos().marcar(r.id, ['est-2'], 'PENDIENTE'));
    entrar('ACUDIENTE', 'acu-1');
    await firstValueFrom(portal().cancelarAviso(aviso.id));
    expect(await firstValueFrom(TestBed.inject(AvisosAusenciaRepositorio).listar({ fecha: '', rutaId: '' }))).toEqual([]);
  });
});
