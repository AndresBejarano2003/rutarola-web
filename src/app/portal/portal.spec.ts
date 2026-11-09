import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { RecorridosRepositorio } from 'src/app/ruta-del-dia/recorridos-repositorio';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { estabilizar, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import PortalCotizacionesPage from './cotizaciones/portal-cotizaciones-page';
import PortalEstudiantesPage from './estudiantes/portal-estudiantes-page';
import PortalInicioPage from './inicio/portal-inicio-page';
import PortalPagosPage from './pagos/portal-pagos-page';
import { PortalEstado } from './portal-estado';
import { PortalRepositorio } from './portal-repositorio';
import { ACUDIENTES_VEN_UBICACION } from 'src/app/inicio/configuracion/configuracion';
import { ConfiguracionRepositorio } from 'src/app/inicio/configuracion/configuracion-repositorio';

describe('Portal del acudiente', () => {
  const entrar = (rol: 'ACUDIENTE' | 'CONDUCTOR', id: string) =>
    TestBed.inject(AuthService).abrirSesion({
      usuario: 'x', nombre: 'María Pérez López', correo: '', rol, imagen: '', inicio: '',
      empleadoId: rol === 'CONDUCTOR' ? id : null, acudienteId: rol === 'ACUDIENTE' ? id : null,
    });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    simularDialogos();
    vi.useFakeTimers({ now: new Date('2026-11-05T07:00:00'), toFake: ['Date'] });
    TestBed.configureTestingModule({ providers: [provideRouter([]), PortalEstado, ...repositoriosDePrueba()] });
  });

  afterEach(() => vi.useRealTimers());

  it('solo muestra los datos del acudiente de la sesión', async () => {
    entrar('ACUDIENTE', 'acu-1');
    const portal = await firstValueFrom(TestBed.inject(PortalRepositorio).obtener());
    expect(portal.acudiente.nombre).toBe('María Pérez López');
    expect(portal.estudiantes.map((e) => e.id).sort()).toEqual(['est-1', 'est-2']);
    expect(portal.facturas.every((f) => ['est-1', 'est-2'].includes(f.estudianteId))).toBe(true);
    expect(portal.recibos.every((r) => portal.facturas.some((f) => f.numero === r.numeroFactura))).toBe(true);
    expect(portal.cotizaciones.map((c) => c.numero)).toContain('COT-0001');
    expect(portal.estudiantes[0].transporte).toMatchObject({ ruta: 'R-01 · Norte', conductor: 'José Luis Cárdenas Rojas' });

    entrar('CONDUCTOR', 'emp-1');
    await expect(firstValueFrom(TestBed.inject(PortalRepositorio).obtener())).rejects.toThrow('Inicia sesión como acudiente');
  });

  it('muestra cómo va hoy el estudiante en la ruta del conductor', async () => {
    entrar('CONDUCTOR', 'emp-1');
    const recorridos = TestBed.inject(RecorridosRepositorio);
    const [ruta] = await firstValueFrom(recorridos.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(recorridos.iniciar(ruta.asignacionId, 'RECOGIDA'));
    await firstValueFrom(recorridos.marcar(r.id, ['est-1'], 'A_BORDO'));
    await firstValueFrom(recorridos.marcar(r.id, ['est-2'], 'AUSENTE'));

    entrar('ACUDIENTE', 'acu-1');
    await TestBed.inject(PortalEstado).cargar();
    const fixture = TestBed.createComponent(PortalInicioPage);
    await estabilizar(fixture);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Buenos días, María');
    expect(texto).toContain('A bordo desde');
    expect(texto).toContain('Recogida: no asistió');
    expect(texto).toContain('Entrega: aún no inicia');
  });

  it('si la empresa no comparte la ubicación, no hay mapa pero sí la hora en que inició la ruta', async () => {
    entrar('CONDUCTOR', 'emp-1');
    const recorridos = TestBed.inject(RecorridosRepositorio);
    const [ruta] = await firstValueFrom(recorridos.rutasDelDia(fechaIso()));
    await firstValueFrom(recorridos.iniciar(ruta.asignacionId, 'RECOGIDA'));

    entrar('ACUDIENTE', 'acu-1');
    const estado = TestBed.inject(PortalEstado);
    await estado.cargar();
    expect(estado.datos()?.ubicacionEnVivo).toBe(true);
    let fixture = TestBed.createComponent(PortalInicioPage);
    await estabilizar(fixture);
    let el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ver en el mapa');
    expect(el.textContent).toContain('la ruta va en camino (inició a las');
    fixture.destroy();

    await firstValueFrom(TestBed.inject(ConfiguracionRepositorio).guardarParametro(ACUDIENTES_VEN_UBICACION, '0'));
    await estado.cargar();
    expect(estado.datos()?.ubicacionEnVivo).toBe(false);
    fixture = TestBed.createComponent(PortalInicioPage);
    await estabilizar(fixture);
    el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Ver en el mapa');
    expect(el.textContent).toContain('la ruta va en camino (inició a las');
  });

  it('las pantallas muestran estudiantes, estado de cuenta y cotizaciones', async () => {
    entrar('ACUDIENTE', 'acu-1');
    await TestBed.inject(PortalEstado).cargar();
    const render = async (pagina: unknown) => {
      const fixture = TestBed.createComponent(pagina as typeof PortalPagosPage);
      await estabilizar(fixture);
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    };
    expect(await render(PortalEstudiantesPage)).toContain('Juan Sebastián Pérez López');
    const pagos = await render(PortalPagosPage);
    expect(pagos).toContain('FAC-0001');
    expect(pagos).toContain('Recibos de pago');
    expect(await render(PortalCotizacionesPage)).toContain('COT-0001');
  });
});
