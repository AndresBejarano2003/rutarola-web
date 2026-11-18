import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService, RolUsuario } from 'src/app/core/auth';
import { generarNotificaciones } from 'src/app/inicio/notificaciones/generar-notificaciones';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { SolicitudNovedad } from './novedad-vehiculo';
import { NovedadesVehiculoRepositorio } from './novedades-vehiculo-repositorio';

describe('Novedades del vehículo', () => {
  let repo: NovedadesVehiculoRepositorio;
  let auth: AuthService;
  const entrar = (rol: RolUsuario, empleadoId: string | null, nombre = 'Usuario') =>
    auth.abrirSesion({ usuario: 'u', nombre, correo: '', rol, empleadoId, imagen: '', inicio: '' });
  const solicitud = (vehiculoId: string, cambios: Partial<SolicitudNovedad> = {}): SolicitudNovedad => ({
    vehiculoId, tipo: 'AVERIA', gravedad: 'ALTA', descripcion: 'Los frenos traseros suenan al frenar', kilometraje: 85000, archivo: null, ...cambios,
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
    repo = TestBed.inject(NovedadesVehiculoRepositorio);
    auth = TestBed.inject(AuthService);
  });

  it('el conductor reporta solo sobre los vehículos de sus asignaciones y la monitora la ve', async () => {
    entrar('CONDUCTOR', 'emp-1', 'José Luis Cárdenas Rojas');
    const mios = await firstValueFrom(repo.misVehiculos());
    expect(mios.map((v) => v.id)).toEqual(['veh-1']);
    await expect(firstValueFrom(repo.reportar(solicitud('veh-2')))).rejects.toThrow('Solo puedes reportar');
    await expect(firstValueFrom(repo.reportar(solicitud('veh-1', { descripcion: 'corta' })))).rejects.toThrow('al menos 10');

    const creada = await firstValueFrom(repo.reportar(solicitud('veh-1')));
    expect(creada).toMatchObject({ estado: 'PENDIENTE', reportadaPorMi: true, delPersonal: true });
    expect(creada.reporta).toContain('José');

    entrar('MONITORA', 'emp-6');
    const deLaMonitora = await firstValueFrom(repo.mias());
    expect(deLaMonitora.map((n) => [n.id, n.reportadaPorMi])).toEqual([[creada.id, false]]);
  });

  it('el administrador la atiende (resolver exige respuesta) y la campana la avisa mientras está abierta', async () => {
    entrar('CONDUCTOR', 'emp-1', 'José Luis Cárdenas Rojas');
    const creada = await firstValueFrom(repo.reportar(solicitud('veh-1')));
    entrar('ADMINISTRADOR', null, 'Admin');

    const abiertas = await firstValueFrom(repo.listar({ abiertas: true }));
    expect(abiertas.map((n) => n.id)).toEqual([creada.id]);
    const avisos = generarNotificaciones({ vehiculos: [], empleados: [], facturas: [], recibos: [], cotizaciones: [], envios: [], morosos: [], novedades: abiertas });
    expect(avisos.find((n) => n.clave === `novedad-vehiculo:${creada.id}`)).toMatchObject({ nivel: 'CRITICA', enlace: `/operacion/vehiculos?novedad=${creada.id}` });

    await expect(firstValueFrom(repo.cambiarEstado(creada.id, { estado: 'RESUELTA', respuesta: ' ' }))).rejects.toThrow('Cuenta qué se hizo');
    const resuelta = await firstValueFrom(repo.cambiarEstado(creada.id, { estado: 'RESUELTA', respuesta: 'Se cambiaron las pastillas.' }));
    expect(resuelta).toMatchObject({ estado: 'RESUELTA', respuesta: 'Se cambiaron las pastillas.', atiende: 'Admin' });
    expect(await firstValueFrom(repo.listar({ abiertas: true }))).toEqual([]);
    // La que registra el administrador no le llega a su propia campana.
    const propia = await firstValueFrom(repo.registrar(solicitud('veh-2', { gravedad: 'BAJA' })));
    expect(propia.delPersonal).toBe(false);
  });
});
