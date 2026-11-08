import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
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
import { TicketsRepositorio } from './tickets-repositorio';

/**
 * Empresa (`soporte.solicitar`, administrador; solo los tickets de SU empresa, sin notas internas):
 * - `GET /soporte/tickets?texto=&estado=&prioridad=&tipo=&vencidos=&pagina=&tamano=` → `Pagina<TicketResumen>`
 *   (abiertos primero, por prioridad y última actividad); `GET /soporte/tickets/{id}` → `Ticket`;
 * - `POST /soporte/tickets` → 201 (`SOP-0001`, correo al equipo y confirmación al solicitante). 400: asunto 5–120,
 *   descripción 20–2000, prioridad CRITICA no la elige la empresa, ≤ 3 adjuntos PDF/imagen (data URL); 422 > 1 MB;
 * - `POST …/{id}/comentarios {texto, adjuntos}` (en ESPERANDO_CLIENTE lo devuelve a EN_REVISION; 422 terminado),
 *   `…/validacion {aprobada, comentario}` (solo VALIDACION_CLIENTE: RESUELTO o vuelve a EN_PROCESO),
 *   `…/confirmacion {calificacion 1–5, comentario}` (RESUELTO → CERRADO), `…/reapertura {comentario}`
 *   (RESUELTO → EN_REVISION), `…/cancelacion {comentario}` (mientras no esté resuelto); 422 fuera de su estado;
 * - `GET …/{id}/adjuntos/{idAdjunto}` → el archivo (404 si es de una nota interna).
 *
 * Plataforma (`soporte.gestionar`, SUPER_ADMIN; todas las empresas):
 * - `GET /plataforma/tickets?…&empresaId=&responsableId=(id|SIN_ASIGNAR)` → `Pagina<TicketResumen>`,
 *   `GET /plataforma/tickets/resumen` → `ResumenTickets`, `GET …/responsables` → `Responsable[]`, `GET …/{id}`
 *   (con notas internas y `siguientesEstados`);
 * - `POST …/{id}/estado {estado, comentario}`: 422 si la transición no existe (errores y mejoras pasan por QA,
 *   pruebas y validación) o si falta el comentario (rechazar, pedir información, resolver, devolver);
 * - `POST …/{id}/comentarios {texto, interno, adjuntos}` (respuesta o nota interna);
 * - `PUT …/{id}/asignacion {responsableId, prioridad}` (cambiar la prioridad recalcula el objetivo; 404 responsable);
 * - `POST …/{id}/reuniones {fecha, duracionMinutos 15–480, modalidad, enlace (obligatorio si VIRTUAL), motivo}`,
 *   `PUT …/{id}/reuniones/{idReunion} {estado REALIZADA|CANCELADA, notas}` (422 si ya se registró);
 * - `GET …/{id}/adjuntos/{idAdjunto}`.
 */
@Injectable()
export class TicketsHttp extends TicketsRepositorio {
  private readonly http = inject(HttpClient);
  private readonly empresa = `${environment.apiUrl}/soporte/tickets`;
  private readonly plataforma = `${environment.apiUrl}/plataforma/tickets`;

  listar(filtros: FiltrosTicket, paginacion: Paginacion): Observable<Pagina<TicketResumen>> {
    const { empresaId: _, responsableId: __, ...propios } = filtros;
    return this.http.get<Pagina<TicketResumen>>(this.empresa, { params: parametros({ ...propios, ...paginacion }) });
  }

  obtener(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(this.de(this.empresa, id));
  }

  crear(s: SolicitudTicket): Observable<Ticket> {
    return this.http.post<Ticket>(this.empresa, { ...s, adjuntos: s.adjuntos.map(adjunto) });
  }

  comentar(id: string, texto: string, adjuntos: ArchivoAdjunto[]): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.empresa, id)}/comentarios`, { texto, adjuntos: adjuntos.map(adjunto) });
  }

  validar(id: string, aprobada: boolean, comentario: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.empresa, id)}/validacion`, { aprobada, comentario });
  }

  confirmar(id: string, calificacion: number, comentario: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.empresa, id)}/confirmacion`, { calificacion, comentario });
  }

  reabrir(id: string, comentario: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.empresa, id)}/reapertura`, { comentario });
  }

  cancelar(id: string, comentario: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.empresa, id)}/cancelacion`, { comentario });
  }

  bandeja(filtros: FiltrosTicket, paginacion: Paginacion): Observable<Pagina<TicketResumen>> {
    return this.http.get<Pagina<TicketResumen>>(this.plataforma, { params: parametros({ ...filtros, ...paginacion }) });
  }

  resumen(): Observable<ResumenTickets> {
    return this.http.get<ResumenTickets>(`${this.plataforma}/resumen`);
  }

  responsables(): Observable<Responsable[]> {
    return this.http.get<Responsable[]>(`${this.plataforma}/responsables`);
  }

  detallePlataforma(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(this.de(this.plataforma, id));
  }

  cambiarEstado(id: string, estado: EstadoTicket, comentario: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.plataforma, id)}/estado`, { estado, comentario });
  }

  responder(id: string, texto: string, interno: boolean, adjuntos: ArchivoAdjunto[]): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.plataforma, id)}/comentarios`, { texto, interno, adjuntos: adjuntos.map(adjunto) });
  }

  asignar(id: string, responsableId: string, prioridad: PrioridadTicket): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.de(this.plataforma, id)}/asignacion`, { responsableId, prioridad });
  }

  programarReunion(id: string, reunion: SolicitudReunion): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.de(this.plataforma, id)}/reuniones`, reunion);
  }

  actualizarReunion(id: string, idReunion: string, estado: Exclude<EstadoReunion, 'PROGRAMADA'>, notas: string): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.de(this.plataforma, id)}/reuniones/${encodeURIComponent(idReunion)}`, { estado, notas });
  }

  descargarAdjunto(id: string, idAdjunto: string, plataforma: boolean): Observable<Blob> {
    return this.http.get(`${this.de(plataforma ? this.plataforma : this.empresa, id)}/adjuntos/${encodeURIComponent(idAdjunto)}`, {
      responseType: 'blob',
    });
  }

  private de(base: string, id: string): string {
    return `${base}/${encodeURIComponent(id)}`;
  }
}

function adjunto(a: ArchivoAdjunto): { nombre: string; tipo: string; url: string } {
  return { nombre: a.nombre, tipo: a.tipo, url: a.url };
}

function parametros(valores: Record<string, string | number | boolean>): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== '' && valor !== false) params = params.set(clave, String(valor));
  }
  return params;
}
