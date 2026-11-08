import { Observable } from 'rxjs';
import { ArchivoAdjunto } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Pagina, Paginacion } from 'src/app/shared/crud/crud';
import {
  EstadoReunion,
  EstadoTicket,
  FiltrosTicket,
  PrioridadTicket,
  Responsable,
  ResumenTickets,
  SolicitudReunion,
  SolicitudTicket,
  Ticket,
  TicketResumen,
} from './tickets';

/**
 * Tickets de soporte. La EMPRESA (administrador) abre y sigue los suyos; la PLATAFORMA (SUPER_ADMIN) los
 * atiende todos. Un solo contrato con las dos caras para compartir el almacenamiento local.
 */
export abstract class TicketsRepositorio {
  // --- Empresa ---
  abstract listar(filtros: FiltrosTicket, paginacion: Paginacion): Observable<Pagina<TicketResumen>>;
  abstract obtener(id: string): Observable<Ticket>;
  abstract crear(solicitud: SolicitudTicket): Observable<Ticket>;
  abstract comentar(id: string, texto: string, adjuntos: ArchivoAdjunto[]): Observable<Ticket>;
  abstract validar(id: string, aprobada: boolean, comentario: string): Observable<Ticket>;
  abstract confirmar(id: string, calificacion: number, comentario: string): Observable<Ticket>;
  abstract reabrir(id: string, comentario: string): Observable<Ticket>;
  abstract cancelar(id: string, comentario: string): Observable<Ticket>;

  // --- Plataforma ---
  abstract bandeja(filtros: FiltrosTicket, paginacion: Paginacion): Observable<Pagina<TicketResumen>>;
  abstract resumen(): Observable<ResumenTickets>;
  abstract responsables(): Observable<Responsable[]>;
  abstract detallePlataforma(id: string): Observable<Ticket>;
  abstract cambiarEstado(id: string, estado: EstadoTicket, comentario: string): Observable<Ticket>;
  abstract responder(id: string, texto: string, interno: boolean, adjuntos: ArchivoAdjunto[]): Observable<Ticket>;
  /** `responsableId` `''` = sin asignar. */
  abstract asignar(id: string, responsableId: string, prioridad: PrioridadTicket): Observable<Ticket>;
  abstract programarReunion(id: string, reunion: SolicitudReunion): Observable<Ticket>;
  abstract actualizarReunion(id: string, idReunion: string, estado: Exclude<EstadoReunion, 'PROGRAMADA'>, notas: string): Observable<Ticket>;

  /** Contenido de un adjunto (con la sesión: no se abre por URL directa). */
  abstract descargarAdjunto(id: string, idAdjunto: string, plataforma: boolean): Observable<Blob>;
}
