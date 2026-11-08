import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { Parada, cambiarEstado, motivoNoFinalizar, moverEnLista, nombreAusencia, puedeReordenar, reordenarParadas, reportaUbicacion, siguientePaso } from './recorrido';
import { RecorridosRepositorio } from './recorridos-repositorio';

const parada = (id: string, estado: Parada['estado'] = 'PENDIENTE'): Parada => ({
  estudianteId: id, estudiante: id, grado: '', direccion: '', acudiente: '', telefonoAcudiente: '', estado, horaAbordo: null, horaEntrega: null, motivoAusencia: '',
});

describe('Reglas del recorrido', () => {
  it('recogida: recoger en orden y luego entregar a todos en el colegio', () => {
    expect(siguientePaso({ trayecto: 'RECOGIDA', paradas: [parada('a', 'A_BORDO'), parada('b')] })).toMatchObject({ tipo: 'RECOGER', parada: { estudianteId: 'b' } });
    expect(siguientePaso({ trayecto: 'RECOGIDA', paradas: [parada('a', 'A_BORDO'), parada('b', 'AUSENTE')] })).toEqual({ tipo: 'LLEGADA_COLEGIO', aBordo: 1 });
    expect(siguientePaso({ trayecto: 'RECOGIDA', paradas: [parada('a', 'ENTREGADO')] })).toEqual({ tipo: 'FINALIZAR' });
  });

  it('entrega: primero el abordaje en el colegio y luego cada casa', () => {
    expect(siguientePaso({ trayecto: 'ENTREGA', paradas: [parada('a'), parada('b', 'A_BORDO')] }).tipo).toBe('ABORDAJE');
    expect(siguientePaso({ trayecto: 'ENTREGA', paradas: [parada('a', 'ENTREGADO'), parada('b', 'A_BORDO')] })).toMatchObject({ tipo: 'ENTREGAR', parada: { estudianteId: 'b' } });
  });

  it('nadie puede quedar a bordo ni sin marcar al finalizar', () => {
    expect(motivoNoFinalizar([parada('a', 'A_BORDO')])).toContain('a bordo');
    expect(motivoNoFinalizar([parada('a')])).toContain('Falta 1');
    expect(motivoNoFinalizar([parada('a', 'ENTREGADO'), parada('b', 'AUSENTE')])).toBeNull();
  });

  it('solo permite las transiciones válidas y guarda la hora', () => {
    const abordo = cambiarEstado(parada('a'), 'A_BORDO', 'T1');
    expect(abordo).toMatchObject({ estado: 'A_BORDO', horaAbordo: 'T1' });
    expect(cambiarEstado(abordo, 'ENTREGADO', 'T2')).toMatchObject({ horaAbordo: 'T1', horaEntrega: 'T2' });
    expect(() => cambiarEstado(parada('a'), 'ENTREGADO', 'T')).toThrow('no se puede pasar');
    expect(() => cambiarEstado(parada('a', 'AUSENTE'), 'A_BORDO', 'T')).toThrow();
  });
});

describe('Orden de visita', () => {
  it('mover: el estudiante 2 pasa al puesto 6 y los del 3 al 6 suben una posición', () => {
    expect(moverEnLista([1, 2, 3, 4, 5, 6], 1, 5)).toEqual([1, 3, 4, 5, 6, 2]);
    expect(moverEnLista([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });

  it('solo se reordenan los que faltan; los visitados quedan primero', () => {
    const r = { trayecto: 'RECOGIDA' as const, paradas: [parada('a'), parada('b', 'A_BORDO'), parada('c'), parada('d')] };
    expect(reordenarParadas(r, ['d', 'a', 'c']).map((p) => p.estudianteId)).toEqual(['b', 'd', 'a', 'c']);
    expect(siguientePaso({ ...r, paradas: reordenarParadas(r, ['d', 'a', 'c']) })).toMatchObject({ parada: { estudianteId: 'd' } });
    // Lista desactualizada (alguien marcó a "a" mientras tanto) o con extraños → rechazo.
    expect(() => reordenarParadas(r, ['d', 'c'])).toThrow('cambió');
    expect(() => reordenarParadas(r, ['d', 'a', 'b'])).toThrow('cambió');
    // En la entrega también se reordenan los que van a bordo (aún no llegan a su casa).
    const entrega = { trayecto: 'ENTREGA' as const, paradas: [parada('a', 'ENTREGADO'), parada('b', 'A_BORDO'), parada('c', 'A_BORDO')] };
    expect(reordenarParadas(entrega, ['c', 'b']).map((p) => p.estudianteId)).toEqual(['a', 'c', 'b']);
  });

  it('ordena la monitora; el conductor solo si la ruta no tiene monitora', () => {
    const r = { estado: 'EN_CURSO' as const, conductorId: 'c', monitoraId: 'm' };
    expect(puedeReordenar(r, 'm')).toBe(true);
    expect(puedeReordenar(r, 'c')).toBe(false);
    expect(puedeReordenar({ ...r, monitoraId: '' }, 'c')).toBe(true);
    expect(puedeReordenar({ ...r, estado: 'FINALIZADO' }, 'm')).toBe(false);
  });

  it('el conductor y la monitora comparten la ubicación mientras está en curso', () => {
    const r = { estado: 'EN_CURSO' as const, conductorId: 'c', monitoraId: 'm' };
    expect([reportaUbicacion(r, 'c'), reportaUbicacion(r, 'm'), reportaUbicacion(r, 'x'), reportaUbicacion(r, null)]).toEqual([true, true, false, false]);
    expect(reportaUbicacion({ ...r, estado: 'FINALIZADO' }, 'c')).toBe(false);
  });

  it('el motivo de ausencia se guarda solo con AUSENTE y se nombra según el trayecto', () => {
    const ausente = cambiarEstado(parada('a'), 'AUSENTE', 'h', 'NO_ASISTE');
    expect(ausente.motivoAusencia).toBe('NO_ASISTE');
    expect(cambiarEstado(ausente, 'AUSENTE', 'h', 'POR_SU_CUENTA').motivoAusencia).toBe('POR_SU_CUENTA');
    expect(cambiarEstado(ausente, 'PENDIENTE', 'h').motivoAusencia).toBe('');
    expect(cambiarEstado(parada('a'), 'A_BORDO', 'h', 'NO_ASISTE').motivoAusencia).toBe('');
    expect(nombreAusencia('NO_ASISTE', 'ENTREGA')).toBe('No asiste hoy al colegio');
    expect(nombreAusencia('POR_SU_CUENTA', 'RECOGIDA')).toBe('Va al colegio por su cuenta');
    expect(nombreAusencia('POR_SU_CUENTA', 'ENTREGA')).toBe('No viaja en la ruta');
  });
});

describe('RecorridosLocal', () => {
  let repo: RecorridosRepositorio;
  const entrar = (empleadoId: string, rol: 'CONDUCTOR' | 'MONITORA' = 'CONDUCTOR') =>
    TestBed.inject(AuthService).abrirSesion({ usuario: 'x', nombre: 'X', correo: '', rol, empleadoId, imagen: '', inicio: '' });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
    repo = TestBed.inject(RecorridosRepositorio);
    // Las asignaciones de ejemplo terminan el 2026-11-30: se fija la fecha para que la prueba no caduque.
    vi.useFakeTimers({ now: new Date('2026-11-05T06:30:00'), toFake: ['Date'] });
  });

  afterEach(() => vi.useRealTimers());

  it('cada empleado ve solo sus rutas; conductor y monitora comparten el recorrido', async () => {
    entrar('emp-1');
    const rutas = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    expect(rutas.map((r) => r.ruta)).toEqual(['R-01 · Norte']);
    expect(rutas[0]).toMatchObject({ rol: 'CONDUCTOR', companero: { rol: 'MONITORA' }, estudiantes: 2 });

    const r = await firstValueFrom(repo.iniciar(rutas[0].asignacionId, 'RECOGIDA'));
    entrar('emp-6', 'MONITORA');
    expect((await firstValueFrom(repo.obtener(r.id))).id).toBe(r.id);
    entrar('emp-2');
    await expect(firstValueFrom(repo.obtener(r.id))).rejects.toThrow('no pertenece');
    await expect(firstValueFrom(repo.iniciar(rutas[0].asignacionId, 'ENTREGA'))).rejects.toThrow('no está asignada');
  });

  it('recogida completa: un recorrido por trayecto al día y no se finaliza con estudiantes a bordo', async () => {
    entrar('emp-1');
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    let r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    expect(r.paradas.map((p) => p.estudianteId)).toEqual(['est-1', 'est-2']);
    expect(r.paradas[0].acudiente).not.toBe('');
    await expect(firstValueFrom(repo.iniciar(ruta.asignacionId, 'ENTREGA'))).rejects.toThrow('en curso');

    r = await firstValueFrom(repo.marcar(r.id, ['est-1'], 'A_BORDO'));
    r = await firstValueFrom(repo.marcar(r.id, ['est-2'], 'AUSENTE'));
    await expect(firstValueFrom(repo.finalizar(r.id, ''))).rejects.toThrow('a bordo');
    r = await firstValueFrom(repo.marcar(r.id, ['est-1'], 'ENTREGADO'));
    r = await firstValueFrom(repo.finalizar(r.id, ' Sin novedad '));
    expect(r).toMatchObject({ estado: 'FINALIZADO', observaciones: 'Sin novedad' });
    await expect(firstValueFrom(repo.marcar(r.id, ['est-1'], 'A_BORDO'))).rejects.toThrow('finalizado');
    // Iniciar un trayecto que ya existe devuelve el mismo recorrido (no crea otro).
    expect((await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'))).id).toBe(r.id);

    // La entrega recorre la ruta al revés.
    const entrega = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'ENTREGA'));
    expect(entrega.paradas.map((p) => p.estudianteId)).toEqual(['est-2', 'est-1']);
    const [hoy] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    expect(hoy.recorridos.map((x) => [x.trayecto, x.estado])).toEqual([['RECOGIDA', 'FINALIZADO'], ['ENTREGA', 'EN_CURSO']]);
  });

  it('quien no asiste hoy en la recogida llega ausente a la entrega; quien va por su cuenta, no', async () => {
    entrar('emp-1');
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    let r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    r = await firstValueFrom(repo.marcar(r.id, ['est-1'], 'AUSENTE', 'NO_ASISTE'));
    r = await firstValueFrom(repo.marcar(r.id, ['est-2'], 'AUSENTE', 'POR_SU_CUENTA'));
    await firstValueFrom(repo.finalizar(r.id, ''));

    const entrega = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'ENTREGA'));
    expect(entrega.paradas.map((p) => [p.estudianteId, p.estado, p.motivoAusencia])).toEqual([
      ['est-2', 'PENDIENTE', ''],
      ['est-1', 'AUSENTE', 'NO_ASISTE'],
    ]);
    await expect(firstValueFrom(repo.marcar(entrega.id, ['est-2'], 'AUSENTE', 'NO_ASISTE'))).rejects.toThrow('se marca en la recogida');
    // Si sí llegó al colegio, se deshace.
    expect((await firstValueFrom(repo.marcar(entrega.id, ['est-1'], 'PENDIENTE'))).paradas[1]).toMatchObject({ estado: 'PENDIENTE', motivoAusencia: '' });
  });

  it('un recorrido que quedó abierto otro día no bloquea el de hoy', async () => {
    entrar('emp-1');
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const ayer = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));

    vi.setSystemTime(new Date('2026-11-06T06:30:00'));
    const hoy = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    expect(hoy.id).not.toBe(ayer.id);
    expect(hoy.fecha).toBe('2026-11-06');
  });

  it('si el conductor ya inició, la monitora se une al mismo recorrido', async () => {
    entrar('emp-1');
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.marcar((await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'))).id, ['est-1'], 'A_BORDO'));
    entrar('emp-6', 'MONITORA');
    const unida = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    expect(unida.id).toBe(r.id);
    expect(unida.paradas[0].estado).toBe('A_BORDO');
    // El otro trayecto sigue bloqueado mientras este está en curso.
    await expect(firstValueFrom(repo.iniciar(ruta.asignacionId, 'ENTREGA'))).rejects.toThrow('en curso');
  });

  it('la monitora reordena y el conductor recibe el nuevo orden', async () => {
    entrar('emp-1');
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    await expect(firstValueFrom(repo.reordenar(r.id, ['est-2', 'est-1']))).rejects.toThrow('Solo la monitora');

    entrar('emp-6', 'MONITORA');
    await expect(firstValueFrom(repo.reordenar(r.id, ['est-2']))).rejects.toThrow('cambió');
    const nuevo = await firstValueFrom(repo.reordenar(r.id, ['est-2', 'est-1']));
    expect(nuevo.ordenActualizado).toMatchObject({ empleadoId: 'emp-6' });

    entrar('emp-1');
    const visto = await firstValueFrom(repo.obtener(r.id));
    expect(visto.paradas.map((p) => p.estudianteId)).toEqual(['est-2', 'est-1']);
  });

  it('sin asignación vigente no hay rutas', async () => {
    entrar('emp-3');
    expect(await firstValueFrom(repo.rutasDelDia(fechaIso()))).toEqual([]);
    entrar('emp-1');
    expect(await firstValueFrom(repo.rutasDelDia('2026-12-15'))).toEqual([]);
  });
});
