import { Injectable } from '@angular/core';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { FiltrosRecibo, Recibo } from './recibo';
import { RecibosRepositorio } from './recibos-repositorio';

/**
 * Conexión al API: `{apiUrl}/recibos` (filtros `texto`, `facturaId`,
 * `medioPago`, `estado`, `desde`, `hasta`). El API genera `numero`, reparte el
 * valor en `meses` (`aplicacion` MESES con `periodos`, o SALDO) y valida: la
 * factura está vigente, cada mes elegido se cobra (422) y no está ya pagado
 * (409), y el valor no supera el saldo de lo elegido (422).
 */
@Injectable()
export class RecibosHttp extends RepositorioHttp<Recibo, FiltrosRecibo> implements RecibosRepositorio {
  protected readonly recurso = 'recibos';
}
