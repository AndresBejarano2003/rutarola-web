import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { ESTADOS_REGISTRO, EstadoRegistro } from 'src/app/shared/crud/crud';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { emitirEnVivo } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { nombrePlan } from 'src/app/sistema/membresias/suscripcion';
import { FILTROS_EMPRESA_VACIOS } from '../empresas/empresa';
import { EmpresasRepositorio } from '../empresas/empresas-repositorio';
import {
  ALCANCES_CODIGO,
  CodigoPromocional,
  FILTROS_CODIGO_VACIOS,
  FiltrosCodigoPromocional,
  UsoCodigo,
  VIGENCIAS_CODIGO,
  VigenciaCodigo,
  textoDescuento,
  vigenciaDe,
} from './codigo-promocional';
import { CodigoFormulario } from './codigo-formulario/codigo-formulario';
import { CodigosPromocionalesRepositorio } from './codigos-promocionales-repositorio';
import { CodigosPromocionalesStore } from './codigos-promocionales-store';

/**
 * Plataforma › Códigos promocionales (SUPER_ADMIN): crear códigos con vigencia, descuento (porcentaje o valor fijo,
 * SOLO sobre el primer mes facturado), alcance (todas, empresas elegidas o primera compra), planes, periodo y límites
 * de uso. El detalle muestra qué empresas lo usaron. Un código usado no se elimina: se inactiva.
 */
@Component({
  selector: 'app-codigos-promocionales-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    PanelFiltros,
    SelectorBusqueda,
    EncabezadoListado,
    EstadoVacio,
    BadgeEstado,
    AccionesFila,
    Paginacion,
    Modal,
    AccionesFormulario,
    DialogoConfirmacion,
    CodigoFormulario,
  ],
  providers: [CodigosPromocionalesStore],
  templateUrl: './codigos-promocionales-page.html',
})
export default class CodigosPromocionalesPage extends PaginaCrud<CodigoPromocional, FiltrosCodigoPromocional> {
  protected readonly store = inject(CodigosPromocionalesStore);
  private readonly repositorio = inject(CodigosPromocionalesRepositorio);
  protected readonly titulos = { crear: 'Nuevo código promocional', editar: 'Editar código promocional', consultar: 'Detalle del código' };

  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly vigencias = VIGENCIAS_CODIGO;
  protected readonly textoDescuento = textoDescuento;
  protected readonly nombrePlan = nombrePlan;

  protected readonly filtros = inject(NonNullableFormBuilder).group({
    texto: FILTROS_CODIGO_VACIOS.texto,
    estado: FILTROS_CODIGO_VACIOS.estado as EstadoRegistro | '',
    vigencia: FILTROS_CODIGO_VACIOS.vigencia as VigenciaCodigo | '',
  });

  /** Empresas para el alcance EMPRESAS. */
  protected readonly empresas = toSignal(
    inject(EmpresasRepositorio)
      .listar(FILTROS_EMPRESA_VACIOS, SIN_PAGINAR)
      .pipe(
        map((p) => p.items.map((e): OpcionCatalogo => ({ id: e.id, nombre: e.estado === 'ACTIVO' ? e.nombre : `${e.nombre} (inactiva)` }))),
        catchError(() => of([] as OpcionCatalogo[])),
      ),
    { initialValue: [] },
  );

  /** Usos del código abierto en consulta. */
  protected readonly usos = signal<UsoCodigo[] | null>(null);

  constructor() {
    super();
    emitirEnVivo<FiltrosCodigoPromocional>(this.filtros, { emit: (f) => this.store.buscar(f) });
    effect(() => {
      const c = this.seleccionado();
      const consulta = this.modalAbierto() && this.modo() === 'consultar';
      untracked(() => void this.cargarUsos(consulta ? (c?.id ?? null) : null));
    });
  }

  protected describir(c: CodigoPromocional): string {
    return c.codigo;
  }

  protected vigencia(c: CodigoPromocional): (typeof VIGENCIAS_CODIGO)[number] {
    const v = vigenciaDe(c.fechaInicio, c.fechaFin);
    return VIGENCIAS_CODIGO.find((x) => x.id === v) ?? VIGENCIAS_CODIGO[0];
  }

  protected alcance(c: CodigoPromocional): string {
    if (c.alcance === 'EMPRESAS') return `${c.empresaIds.length} empresa(s)`;
    return ALCANCES_CODIGO.find((a) => a.id === c.alcance)?.nombre ?? c.alcance;
  }

  protected planes(c: CodigoPromocional): string {
    const planes = c.planes.length ? c.planes.map(nombrePlan).join(', ') : 'Todos los planes';
    return c.periodo ? `${planes} · ${c.periodo === 'ANUAL' ? 'solo anual' : 'solo mensual'}` : planes;
  }

  private ultimaConsulta: string | null = null;

  private async cargarUsos(id: string | null): Promise<void> {
    this.ultimaConsulta = id;
    this.usos.set(null);
    if (!id) return;
    try {
      const usos = await firstValueFrom(this.repositorio.usos(id));
      if (this.ultimaConsulta === id) this.usos.set(usos);
    } catch {
      if (this.ultimaConsulta === id) this.usos.set([]);
    }
  }
}
