import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { FILTROS_TICKET_VACIOS, SolicitudTicket, requiereComentario, siguientesEstados } from './tickets';
import { TicketsRepositorio } from './tickets-repositorio';

const SOLICITUD: SolicitudTicket = {
  tipo: 'ERROR',
  modulo: 'Finanzas',
  prioridad: 'MEDIA',
  asunto: 'No carga la factura',
  descripcion: 'Al abrir la factura la pantalla queda en blanco.',
  adjuntos: [{ nombre: 'captura.pdf', tipo: 'application/pdf', tamano: 10, url: 'data:application/pdf;base64,JVBERi0=' }],
};

describe('Tickets de soporte', () => {
  let repo: TicketsRepositorio;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...repositoriosDePrueba()] });
    repo = TestBed.inject(TicketsRepositorio);
  });

  it('un error no se resuelve sin QA, pruebas y validación; las devoluciones piden comentario', () => {
    expect(siguientesEstados('EN_REVISION', 'ERROR')).not.toContain('RESUELTO');
    expect(siguientesEstados('EN_REVISION', 'CONSULTA')).toContain('RESUELTO');
    expect(siguientesEstados('VALIDACION_CLIENTE', 'ERROR')).toContain('RESUELTO');
    expect(requiereComentario('EN_QA', 'EN_PROCESO')).toBe(true);
    expect(requiereComentario('EN_PROCESO', 'EN_QA')).toBe(false);
    expect(requiereComentario('EN_REVISION', 'RECHAZADO')).toBe(true);
  });

  it('recorre todo el flujo hasta cerrarse con calificación', async () => {
    const t = await firstValueFrom(repo.crear(SOLICITUD));
    expect(t.numero).toBe('SOP-0001');
    expect(t.acciones.cancelar).toBe(true);
    await expect(firstValueFrom(repo.cambiarEstado(t.id, 'EN_QA', 'x'))).rejects.toThrow(/No se puede pasar/);
    await firstValueFrom(repo.cambiarEstado(t.id, 'EN_REVISION', ''));
    await expect(firstValueFrom(repo.cambiarEstado(t.id, 'RESUELTO', 'Listo'))).rejects.toThrow(/QA/);
    for (const e of ['EN_PROCESO', 'EN_QA', 'EN_PRUEBAS', 'VALIDACION_CLIENTE'] as const) await firstValueFrom(repo.cambiarEstado(t.id, e, ''));

    const validar = await firstValueFrom(repo.obtener(t.id));
    expect(validar.acciones.validar).toBe(true);
    expect(validar.fechaPrimeraRespuesta).not.toBeNull();
    const resuelto = await firstValueFrom(repo.validar(t.id, true, ''));
    expect(resuelto.estado).toBe('RESUELTO');
    const cerrado = await firstValueFrom(repo.confirmar(t.id, 4, 'Bien'));
    expect([cerrado.estado, cerrado.calificacion]).toEqual(['CERRADO', 4]);
    await expect(firstValueFrom(repo.comentar(t.id, 'otra', []))).rejects.toThrow(/ya terminó/);
  });

  it('las notas internas y sus adjuntos no llegan a la empresa; responder devuelve a revisión', async () => {
    const t = await firstValueFrom(repo.crear({ ...SOLICITUD, tipo: 'CONSULTA', adjuntos: [] }));
    const conNota = await firstValueFrom(repo.responder(t.id, 'Revisar logs', true, SOLICITUD.adjuntos));
    const adjunto = conNota.eventos.find((e) => e.interno)!.adjuntos[0];
    await firstValueFrom(repo.cambiarEstado(t.id, 'EN_REVISION', ''));
    await firstValueFrom(repo.cambiarEstado(t.id, 'ESPERANDO_CLIENTE', '¿Qué navegador usas?'));

    const vista = await firstValueFrom(repo.obtener(t.id));
    expect(vista.eventos.some((e) => e.interno)).toBe(false);
    await expect(firstValueFrom(repo.descargarAdjunto(t.id, adjunto.id, false))).rejects.toThrow(/no existe/);
    expect((await firstValueFrom(repo.descargarAdjunto(t.id, adjunto.id, true))).type).toBe('application/pdf');

    expect((await firstValueFrom(repo.comentar(t.id, 'Chrome', []))).estado).toBe('EN_REVISION');
    expect((await firstValueFrom(repo.bandeja({ ...FILTROS_TICKET_VACIOS, estado: 'ABIERTOS' }, { pagina: 1, tamano: 10 }))).total).toBe(1);
  });

  it('asigna, cambia la prioridad (recalcula el objetivo) y registra reuniones', async () => {
    const t = await firstValueFrom(repo.crear({ ...SOLICITUD, prioridad: 'BAJA' }));
    const [responsable] = await firstValueFrom(repo.responsables());
    const asignado = await firstValueFrom(repo.asignar(t.id, responsable.id, 'ALTA'));
    expect(new Date(asignado.fechaObjetivo).getTime() - new Date(asignado.fechaCreacion).getTime()).toBe(24 * 3_600_000);
    expect((await firstValueFrom(repo.bandeja({ ...FILTROS_TICKET_VACIOS, responsableId: 'SIN_ASIGNAR' }, { pagina: 1, tamano: 10 }))).total).toBe(0);

    const fecha = new Date(Date.now() + 86_400_000).toISOString();
    await expect(
      firstValueFrom(repo.programarReunion(t.id, { fecha, duracionMinutos: 30, modalidad: 'VIRTUAL', enlace: '', motivo: 'Revisión' })),
    ).rejects.toThrow(/enlace/);
    const conReunion = await firstValueFrom(
      repo.programarReunion(t.id, { fecha, duracionMinutos: 30, modalidad: 'VIRTUAL', enlace: 'https://meet.example.com/x', motivo: 'Revisión' }),
    );
    expect(conReunion.proximaReunion).toBe(fecha);
    const registrada = await firstValueFrom(repo.actualizarReunion(t.id, conReunion.reuniones[0].id, 'REALIZADA', 'Acordamos la corrección.'));
    expect(registrada.reuniones[0].estado).toBe('REALIZADA');
    expect((await firstValueFrom(repo.resumen())).sinAsignar).toBe(0);
  });
});
