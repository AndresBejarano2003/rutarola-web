import { Injectable, inject } from '@angular/core';
import { CrudStore } from 'src/app/shared/crud/crud-store';
import { CodigoPromocional, FILTROS_CODIGO_VACIOS, FiltrosCodigoPromocional } from './codigo-promocional';
import { CodigosPromocionalesRepositorio } from './codigos-promocionales-repositorio';

@Injectable()
export class CodigosPromocionalesStore extends CrudStore<CodigoPromocional, FiltrosCodigoPromocional> {
  protected readonly repositorio = inject(CodigosPromocionalesRepositorio);
  protected readonly textos = {
    creado: 'Código promocional creado.',
    actualizado: 'Código promocional actualizado.',
    eliminado: 'Código promocional eliminado.',
  };

  constructor() {
    super(FILTROS_CODIGO_VACIOS);
  }
}
