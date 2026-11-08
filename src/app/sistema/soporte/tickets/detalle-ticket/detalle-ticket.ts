import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { formatearTamano } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import {
  AdjuntoTicket,
  ESTADOS_TICKET,
  ETAPAS_TICKET,
  EventoTicket,
  Ticket,
  badgePrioridad,
  indiceEtapa,
  nombreEstado,
  nombreModalidad,
  nombrePrioridad,
  nombreTipo,
} from '../tickets';
import { TicketsRepositorio } from '../tickets-repositorio';

/**
 * Cuerpo del detalle de un ticket (empresa y plataforma): datos, avance por etapas, descripción con
 * adjuntos, reuniones e historial. Las acciones las pone cada pantalla debajo.
 */
@Component({
  selector: 'app-detalle-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './detalle-ticket.html',
})
export class DetalleTicket {
  readonly ticket = input.required<Ticket>();
  /** Vista de la plataforma: muestra empresa, notas internas y nombres internos de los estados. */
  readonly plataforma = input(false);

  private readonly repositorio = inject(TicketsRepositorio);
  private readonly avisos = inject(NotificacionesService);

  protected readonly etapas = ETAPAS_TICKET;
  protected readonly etapaActual = computed(() => indiceEtapa(this.ticket().estado));
  protected readonly terminadoSinResolver = computed(() => ['RECHAZADO', 'CANCELADO'].includes(this.ticket().estado));
  /** Más recientes arriba. */
  protected readonly historial = computed(() => [...this.ticket().eventos].reverse());
  protected readonly nombrePrioridad = nombrePrioridad;
  protected readonly badgePrioridad = badgePrioridad;
  protected readonly nombreTipo = nombreTipo;
  protected readonly nombreModalidad = nombreModalidad;
  protected readonly tamano = formatearTamano;

  protected estado(e: Ticket['estado']): string {
    return nombreEstado(e, !this.plataforma());
  }

  protected badgeEstado(e: Ticket['estado']): string {
    return ESTADOS_TICKET[e].badge;
  }

  protected icono(e: EventoTicket): string {
    switch (e.tipo) {
      case 'CREADO':
        return 'fa-solid fa-flag';
      case 'CAMBIO_ESTADO':
        return e.estadoNuevo ? ESTADOS_TICKET[e.estadoNuevo].icono : 'fa-solid fa-arrow-right';
      case 'NOTA_INTERNA':
        return 'fa-solid fa-lock';
      case 'ASIGNACION':
        return 'fa-solid fa-user-tag';
      case 'CAMBIO_PRIORIDAD':
        return 'fa-solid fa-gauge-high';
      case 'REUNION':
        return 'fa-solid fa-calendar-check';
      case 'CALIFICACION':
        return 'fa-solid fa-star';
      default:
        return 'fa-solid fa-comment';
    }
  }

  protected titulo(e: EventoTicket): string {
    switch (e.tipo) {
      case 'CREADO':
        return 'Abrió la solicitud';
      case 'CAMBIO_ESTADO':
        return e.estadoNuevo ? `Pasó a «${this.estado(e.estadoNuevo)}»` : 'Cambió el estado';
      case 'NOTA_INTERNA':
        return 'Nota interna (la empresa no la ve)';
      case 'ASIGNACION':
        return 'Asignación';
      case 'CAMBIO_PRIORIDAD':
        return 'Cambio de prioridad';
      case 'REUNION':
        return 'Reunión';
      case 'CALIFICACION':
        return 'Calificó la atención';
      default:
        return e.deLaPlataforma ? 'Respuesta del equipo de soporte' : 'Comentario';
    }
  }

  protected async descargar(a: AdjuntoTicket): Promise<void> {
    try {
      const blob = await firstValueFrom(this.repositorio.descargarAdjunto(this.ticket().id, a.id, this.plataforma()));
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = a.nombre;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }
}
