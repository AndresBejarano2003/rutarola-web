import { Injectable, inject } from '@angular/core';
import { Observable, defer, map } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { ArchivoAdjunto } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { ErrorCrud, Pagina, Paginacion, siguienteConsecutivo } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import {
  AdjuntoTicket,
  ESTADOS_TICKET,
  EstadoReunion,
  EstadoTicket,
  EventoTicket,
  FINALIZADOS,
  FiltrosTicket,
  MAXIMO_ADJUNTOS_TICKET,
  OBJETIVO_MS,
  PrioridadTicket,
  Responsable,
  ResumenTickets,
  SolicitudReunion,
  SolicitudTicket,
  TAMANO_MAXIMO_ADJUNTO_MB,
  Ticket,
  TicketResumen,
  TipoEventoTicket,
  accionesCliente,
  nombreEstado,
  nombreModalidad,
  nombrePrioridad,
  requiereCalidad,
  requiereComentario,
  siguientesEstados,
  vencido,
} from './tickets';
import { TicketsRepositorio } from './tickets-repositorio';

const CLAVE = 'rutarola.soporte.tickets';
/** `{idAdjunto: dataUrl}` aparte, para no cargar los archivos en cada listado. */
const CLAVE_ADJUNTOS = 'rutarola.soporte.adjuntos';
const EMPRESA_LOCAL = { id: 'empresa-local', nombre: 'RutaRola Demo' };
const RESPONSABLE_LOCAL: Responsable = { id: 'soporte-local', nombre: 'Equipo RutaRola' };

/** Lo guardado: el ticket con TODOS sus eventos (también los internos). */
type TicketGuardado = Omit<Ticket, 'vencido' | 'siguientesEstados' | 'acciones' | 'proximaReunion'>;

/**
 * TEMPORAL (modo local y pruebas): mismas reglas que el API (`tickets.ts` ↔ `ReglasTicket.cs`), sin correos.
 * En modo local la "plataforma" atiende los tickets de la única empresa del navegador.
 */
@Injectable()
export class TicketsLocal extends TicketsRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);
  private readonly auth = inject(AuthService);

  // --- Empresa -----------------------------------------------------------------------------------

  listar(f: FiltrosTicket, p: Paginacion): Observable<Pagina<TicketResumen>> {
    return this.listado({ ...f, empresaId: '', responsableId: '' }, p);
  }

  obtener(id: string): Observable<Ticket> {
    return this.responder$(() => this.vista(this.buscar(this.leer(), id), false));
  }

  crear(s: SolicitudTicket): Observable<Ticket> {
    return this.responder$(() => {
      const todos = this.leer();
      if (s.prioridad === 'CRITICA') throw new ErrorCrud('La prioridad crítica la asigna el equipo de soporte.', 'VALIDACION');
      const ahora = new Date();
      const nombre = this.usuario();
      const t: TicketGuardado = {
        id: crypto.randomUUID(),
        numero: siguienteConsecutivo('SOP', todos.map((x) => x.numero)),
        empresaId: EMPRESA_LOCAL.id,
        empresa: EMPRESA_LOCAL.nombre,
        tipo: s.tipo,
        modulo: s.modulo.trim(),
        prioridad: s.prioridad,
        asunto: s.asunto.trim(),
        descripcion: s.descripcion.trim(),
        estado: 'NUEVO',
        solicitante: nombre,
        correoSolicitante: this.auth.sesion()?.correo ?? '',
        responsableId: '',
        responsable: '',
        fechaCreacion: ahora.toISOString(),
        fechaUltimaActividad: ahora.toISOString(),
        fechaObjetivo: new Date(ahora.getTime() + OBJETIVO_MS[s.prioridad]).toISOString(),
        fechaPrimeraRespuesta: null,
        fechaResolucion: null,
        fechaCierre: null,
        calificacion: null,
        comentarioCalificacion: '',
        adjuntos: [],
        eventos: [],
        reuniones: [],
      };
      const creado = this.evento(t, 'CREADO', null, 'NUEVO', '', false, false);
      t.adjuntos = this.adjuntar(creado, s.adjuntos);
      this.guardar([t, ...todos]);
      return this.vista(t, false);
    });
  }

  comentar(id: string, texto: string, adjuntos: ArchivoAdjunto[]): Observable<Ticket> {
    return this.modificar(id, false, (t) => {
      if (FINALIZADOS.includes(t.estado)) {
        throw new ErrorCrud('El ticket ya terminó. Si necesitas algo más, abre una nueva solicitud.', 'VALIDACION');
      }
      this.adjuntar(this.evento(t, 'COMENTARIO', null, null, texto.trim(), false, false), adjuntos);
      if (t.estado === 'ESPERANDO_CLIENTE') this.cambiar(t, 'EN_REVISION', 'La empresa respondió.', false);
    });
  }

  validar(id: string, aprobada: boolean, comentario: string): Observable<Ticket> {
    return this.modificar(id, false, (t) => {
      if (t.estado !== 'VALIDACION_CLIENTE') throw new ErrorCrud('Este ticket no está pendiente de tu validación.', 'VALIDACION');
      if (!aprobada && !comentario.trim()) throw new ErrorCrud('Cuéntanos qué sigue fallando.', 'VALIDACION');
      this.cambiar(t, aprobada ? 'RESUELTO' : 'EN_PROCESO', comentario.trim() || 'La solución funciona correctamente.', false);
    });
  }

  confirmar(id: string, calificacion: number, comentario: string): Observable<Ticket> {
    return this.modificar(id, false, (t) => {
      if (t.estado !== 'RESUELTO') throw new ErrorCrud('Solo se confirma un ticket resuelto.', 'VALIDACION');
      t.calificacion = calificacion;
      t.comentarioCalificacion = comentario.trim();
      this.evento(t, 'CALIFICACION', null, null, `Calificación: ${calificacion}/5${comentario.trim() ? `. ${comentario.trim()}` : ''}`, false, false);
      this.cambiar(t, 'CERRADO', 'La empresa confirmó la solución.', false);
    });
  }

  reabrir(id: string, comentario: string): Observable<Ticket> {
    return this.modificar(id, false, (t) => {
      if (t.estado !== 'RESUELTO') throw new ErrorCrud('Solo se reabre un ticket resuelto.', 'VALIDACION');
      this.cambiar(t, 'EN_REVISION', comentario.trim(), false);
    });
  }

  cancelar(id: string, comentario: string): Observable<Ticket> {
    return this.modificar(id, false, (t) => {
      if (!accionesCliente(t.estado).cancelar) throw new ErrorCrud('Este ticket ya no se puede cancelar.', 'VALIDACION');
      this.cambiar(t, 'CANCELADO', comentario.trim(), false);
    });
  }

  // --- Plataforma --------------------------------------------------------------------------------

  bandeja(f: FiltrosTicket, p: Paginacion): Observable<Pagina<TicketResumen>> {
    return this.listado(f, p);
  }

  resumen(): Observable<ResumenTickets> {
    return this.responder$(() => {
      const todos = this.leer();
      const ahora = new Date();
      const porEstado = Object.fromEntries(
        (Object.keys(ESTADOS_TICKET) as EstadoTicket[]).map((e) => [e, todos.filter((t) => t.estado === e).length]),
      ) as Record<EstadoTicket, number>;
      const abiertos = todos.filter((t) => !FINALIZADOS.includes(t.estado));
      const semana = ahora.getTime() + 7 * 86_400_000;
      return {
        porEstado,
        abiertos: abiertos.length,
        vencidos: todos.filter((t) => vencido(t.estado, t.fechaObjetivo, ahora)).length,
        sinAsignar: abiertos.filter((t) => !t.responsableId).length,
        reunionesProximas: todos
          .flatMap((t) => t.reuniones)
          .filter((r) => r.estado === 'PROGRAMADA' && new Date(r.fecha).getTime() >= ahora.getTime() && new Date(r.fecha).getTime() < semana).length,
      };
    });
  }

  responsables(): Observable<Responsable[]> {
    return this.responder$(() => [RESPONSABLE_LOCAL]);
  }

  detallePlataforma(id: string): Observable<Ticket> {
    return this.responder$(() => this.vista(this.buscar(this.leer(), id), true));
  }

  cambiarEstado(id: string, hacia: EstadoTicket, comentario: string): Observable<Ticket> {
    return this.modificar(id, true, (t) => {
      if (!siguientesEstados(t.estado, t.tipo).includes(hacia)) {
        throw new ErrorCrud(
          requiereCalidad(t.tipo) && hacia === 'RESUELTO'
            ? 'Un ticket de este tipo debe pasar por QA, pruebas y la validación del cliente antes de resolverse.'
            : `No se puede pasar de "${nombreEstado(t.estado)}" a "${nombreEstado(hacia)}".`,
          'VALIDACION',
        );
      }
      if (!comentario.trim() && requiereComentario(t.estado, hacia)) {
        throw new ErrorCrud('Explica el motivo del cambio: la empresa lo verá en el historial.', 'VALIDACION');
      }
      this.cambiar(t, hacia, comentario.trim(), true);
      return true;
    });
  }

  responder(id: string, texto: string, interno: boolean, adjuntos: ArchivoAdjunto[]): Observable<Ticket> {
    return this.modificar(id, true, (t) => {
      this.adjuntar(this.evento(t, interno ? 'NOTA_INTERNA' : 'COMENTARIO', null, null, texto.trim(), interno, true), adjuntos);
      return !interno;
    });
  }

  asignar(id: string, responsableId: string, prioridad: PrioridadTicket): Observable<Ticket> {
    return this.modificar(id, true, (t) => {
      if (responsableId && responsableId !== RESPONSABLE_LOCAL.id) throw new ErrorCrud('El responsable no existe.', 'NO_ENCONTRADO');
      if (responsableId !== t.responsableId) {
        t.responsableId = responsableId;
        t.responsable = responsableId ? RESPONSABLE_LOCAL.nombre : '';
        this.evento(t, 'ASIGNACION', null, null, responsableId ? `Responsable: ${t.responsable}.` : 'Quedó sin responsable.', false, true);
      }
      if (prioridad !== t.prioridad) {
        this.evento(t, 'CAMBIO_PRIORIDAD', null, null, `Prioridad: ${nombrePrioridad(t.prioridad)} → ${nombrePrioridad(prioridad)}.`, false, true);
        t.prioridad = prioridad;
        t.fechaObjetivo = new Date(new Date(t.fechaCreacion).getTime() + OBJETIVO_MS[prioridad]).toISOString();
      }
      return false;
    });
  }

  programarReunion(id: string, r: SolicitudReunion): Observable<Ticket> {
    return this.modificar(id, true, (t) => {
      if (FINALIZADOS.includes(t.estado)) throw new ErrorCrud('El ticket ya terminó: no se agendan reuniones.', 'VALIDACION');
      if (new Date(r.fecha).getTime() < Date.now() - 5 * 60_000) throw new ErrorCrud('La reunión debe ser en una fecha futura.', 'VALIDACION');
      if (r.modalidad === 'VIRTUAL' && !r.enlace.trim()) throw new ErrorCrud('Ingresa el enlace de la videollamada.', 'VALIDACION');
      t.reuniones = [
        ...t.reuniones,
        {
          id: crypto.randomUUID(),
          fecha: new Date(r.fecha).toISOString(),
          duracionMinutos: r.duracionMinutos,
          modalidad: r.modalidad,
          enlace: r.enlace.trim(),
          motivo: r.motivo.trim(),
          estado: 'PROGRAMADA' as const,
          notas: '',
          organizador: RESPONSABLE_LOCAL.nombre,
        },
      ].sort((a, b) => a.fecha.localeCompare(b.fecha));
      this.evento(t, 'REUNION', null, null, `Reunión programada: ${nombreModalidad(r.modalidad)} (${r.duracionMinutos} min): ${r.motivo.trim()}`, false, true);
      return true;
    });
  }

  actualizarReunion(id: string, idReunion: string, estado: Exclude<EstadoReunion, 'PROGRAMADA'>, notas: string): Observable<Ticket> {
    return this.modificar(id, true, (t) => {
      const reunion = t.reuniones.find((r) => r.id === idReunion);
      if (!reunion) throw new ErrorCrud('La reunión no existe.', 'NO_ENCONTRADO');
      if (reunion.estado !== 'PROGRAMADA') throw new ErrorCrud('Esta reunión ya se registró.', 'VALIDACION');
      reunion.estado = estado;
      reunion.notas = notas.trim();
      this.evento(t, 'REUNION', null, null, `${estado === 'REALIZADA' ? 'Reunión realizada' : 'Reunión cancelada'}: ${reunion.notas}`, false, true);
      return true;
    });
  }

  descargarAdjunto(id: string, idAdjunto: string, plataforma: boolean): Observable<Blob> {
    return this.responder$(() => {
      const t = this.buscar(this.leer(), id);
      const visible = t.eventos.some((e) => (plataforma || !e.interno) && e.adjuntos.some((a) => a.id === idAdjunto));
      const url = visible ? this.leerAdjuntos()[idAdjunto] : undefined;
      if (!url) throw new ErrorCrud('El archivo no existe.', 'NO_ENCONTRADO');
      return url;
    }).pipe(map(blobDe));
  }

  // --- Apoyo -------------------------------------------------------------------------------------

  private listado(f: FiltrosTicket, { pagina, tamano }: Paginacion): Observable<Pagina<TicketResumen>> {
    return defer(() =>
      responderLocal(() => {
        const ahora = new Date();
        const texto = normalizar(f.texto);
        const nivel: Record<PrioridadTicket, number> = { CRITICA: 3, ALTA: 2, MEDIA: 1, BAJA: 0 };
        const filas = this.leer()
          .filter(
            (t) =>
              (!texto || normalizar(`${t.numero} ${t.asunto} ${t.solicitante}`).includes(texto)) &&
              (!f.estado ||
                (f.estado === 'ABIERTOS' ? !FINALIZADOS.includes(t.estado) : f.estado === 'FINALIZADOS' ? FINALIZADOS.includes(t.estado) : t.estado === f.estado)) &&
              (!f.prioridad || t.prioridad === f.prioridad) &&
              (!f.tipo || t.tipo === f.tipo) &&
              (!f.empresaId || t.empresaId === f.empresaId) &&
              (!f.responsableId || (f.responsableId === 'SIN_ASIGNAR' ? !t.responsableId : t.responsableId === f.responsableId)) &&
              (!f.vencidos || vencido(t.estado, t.fechaObjetivo, ahora)),
          )
          .sort(
            (a, b) =>
              Number(FINALIZADOS.includes(a.estado)) - Number(FINALIZADOS.includes(b.estado)) ||
              nivel[b.prioridad] - nivel[a.prioridad] ||
              b.fechaUltimaActividad.localeCompare(a.fechaUltimaActividad),
          )
          .map((t): TicketResumen => {
            const { descripcion: _, correoSolicitante: __, eventos: ___, adjuntos: ____, reuniones, ...resto } = t;
            return {
              ...resto,
              vencido: vencido(t.estado, t.fechaObjetivo, ahora),
              proximaReunion: reuniones.find((r) => r.estado === 'PROGRAMADA' && new Date(r.fecha) >= ahora)?.fecha ?? null,
            } as TicketResumen;
          });
        return { items: filas.slice((pagina - 1) * tamano, pagina * tamano), total: filas.length, pagina, tamano };
      }, this.latenciaMs),
    );
  }

  /** `cambio` devuelve `true` cuando la plataforma respondió (cuenta para la primera respuesta). */
  private modificar(id: string, plataforma: boolean, cambio: (t: TicketGuardado) => boolean | void): Observable<Ticket> {
    return this.responder$(() => {
      const todos = this.leer();
      const t = this.buscar(todos, id);
      if (cambio(t) && plataforma) t.fechaPrimeraRespuesta ??= new Date().toISOString();
      t.fechaUltimaActividad = new Date().toISOString();
      this.guardar(todos);
      return this.vista(t, plataforma);
    });
  }

  private vista(t: TicketGuardado, plataforma: boolean): Ticket {
    const ahora = new Date();
    return {
      ...t,
      eventos: t.eventos.filter((e) => plataforma || !e.interno),
      vencido: vencido(t.estado, t.fechaObjetivo, ahora),
      proximaReunion: t.reuniones.find((r) => r.estado === 'PROGRAMADA' && new Date(r.fecha) >= ahora)?.fecha ?? null,
      siguientesEstados: plataforma ? siguientesEstados(t.estado, t.tipo) : [],
      acciones: plataforma ? { comentar: false, cancelar: false, validar: false, confirmar: false, reabrir: false } : accionesCliente(t.estado),
    };
  }

  private cambiar(t: TicketGuardado, hacia: EstadoTicket, texto: string, plataforma: boolean): void {
    this.evento(t, 'CAMBIO_ESTADO', t.estado, hacia, texto, false, plataforma);
    const ahora = new Date().toISOString();
    t.estado = hacia;
    t.fechaResolucion = hacia === 'RESUELTO' ? ahora : hacia === 'CERRADO' ? (t.fechaResolucion ?? ahora) : FINALIZADOS.includes(hacia) ? t.fechaResolucion : null;
    t.fechaCierre = FINALIZADOS.includes(hacia) ? ahora : null;
  }

  private evento(
    t: TicketGuardado,
    tipo: TipoEventoTicket,
    desde: EstadoTicket | null,
    hacia: EstadoTicket | null,
    texto: string,
    interno: boolean,
    plataforma: boolean,
  ): EventoTicket {
    const evento: EventoTicket = {
      id: crypto.randomUUID(),
      tipo,
      estadoAnterior: desde,
      estadoNuevo: hacia,
      texto,
      interno,
      deLaPlataforma: plataforma,
      usuario: plataforma ? RESPONSABLE_LOCAL.nombre : this.usuario(),
      fecha: new Date().toISOString(),
      adjuntos: [],
    };
    t.eventos.push(evento);
    return evento;
  }

  private adjuntar(evento: EventoTicket, archivos: ArchivoAdjunto[]): AdjuntoTicket[] {
    if (archivos.length > MAXIMO_ADJUNTOS_TICKET) throw new ErrorCrud(`Adjunta máximo ${MAXIMO_ADJUNTOS_TICKET} archivos.`, 'VALIDACION');
    const contenidos = this.leerAdjuntos();
    for (const a of archivos) {
      if (a.tamano > TAMANO_MAXIMO_ADJUNTO_MB * 1024 * 1024) throw new ErrorCrud(`El archivo ${a.nombre} supera 1 MB.`, 'VALIDACION');
      const id = crypto.randomUUID();
      contenidos[id] = a.url;
      evento.adjuntos.push({ id, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano });
    }
    if (archivos.length) this.escribir(CLAVE_ADJUNTOS, contenidos);
    return evento.adjuntos;
  }

  private buscar(todos: TicketGuardado[], id: string): TicketGuardado {
    const t = todos.find((x) => x.id === id);
    if (!t) throw new ErrorCrud('El ticket no existe.', 'NO_ENCONTRADO');
    return t;
  }

  private usuario(): string {
    return this.auth.sesion()?.nombre ?? 'Administrador';
  }

  private responder$<R>(operacion: () => R): Observable<R> {
    return defer(() => responderLocal(operacion, this.latenciaMs));
  }

  private leer(): TicketGuardado[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as TicketGuardado[];
    } catch {
      return [];
    }
  }

  private leerAdjuntos(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_ADJUNTOS) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }

  private guardar(todos: TicketGuardado[]): void {
    this.escribir(CLAVE, todos);
  }

  private escribir(clave: string, valor: unknown): void {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      throw new ErrorCrud('No hay espacio en el navegador para guardar el archivo.', 'SIN_ESPACIO');
    }
  }
}

function blobDe(dataUrl: string): Blob {
  const [cabecera, datos = ''] = dataUrl.split(',');
  const tipo = /data:([^;]+)/.exec(cabecera)?.[1] ?? 'application/octet-stream';
  const binario = atob(datos);
  return new Blob([Uint8Array.from(binario, (c) => c.charCodeAt(0))], { type: tipo });
}
