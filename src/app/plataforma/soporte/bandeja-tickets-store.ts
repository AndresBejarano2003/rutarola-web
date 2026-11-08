import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ListadoStore } from 'src/app/shared/crud/listado-store';
import { Pagina, Paginacion } from 'src/app/shared/crud/crud';
import { RepositorioLectura } from 'src/app/shared/crud/repositorio-crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { FILTROS_TICKET_VACIOS, FiltrosTicket, TicketResumen } from 'src/app/sistema/soporte/tickets/tickets';
import { TicketsRepositorio } from 'src/app/sistema/soporte/tickets/tickets-repositorio';

/** Bandeja de la plataforma: por defecto, los tickets abiertos de todas las empresas. */
export const FILTROS_BANDEJA_INICIALES: FiltrosTicket = { ...FILTROS_TICKET_VACIOS, estado: 'ABIERTOS' };

@Injectable()
export class BandejaTicketsStore extends ListadoStore<TicketResumen, FiltrosTicket> {
  private readonly tickets = inject(TicketsRepositorio);
  protected readonly repositorio: RepositorioLectura<TicketResumen, FiltrosTicket> = {
    listar: (f: FiltrosTicket, p: Paginacion): Observable<Pagina<TicketResumen>> => this.tickets.bandeja(f, p),
  };

  constructor() {
    super(FILTROS_BANDEJA_INICIALES);
  }

  override get modoLocal(): boolean {
    return esFuenteLocal(this.tickets);
  }
}
