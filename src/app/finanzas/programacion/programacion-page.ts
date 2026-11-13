import { AvisoFuncion } from 'src/app/sistema/membresias/aviso-funcion/aviso-funcion';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { FacturasRepositorio } from '../facturas/facturas-repositorio';
import { EnvioProgramado, FiltrosProgramacion, Programacion } from './programacion';
import { ProgramacionFormulario } from './programacion-formulario/programacion-formulario';
import { ProgramacionesFiltros } from './programaciones-filtros/programaciones-filtros';
import { ProgramacionesRepositorio } from './programaciones-repositorio';
import { ProgramacionesStore } from './programaciones-store';
import { ProgramacionesTabla } from './programaciones-tabla/programaciones-tabla';

interface EstadoHistorial {
  cargando: boolean;
  envios: EnvioProgramado[];
  error: boolean;
}

@Component({
  selector: 'app-programacion-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvisoFuncion, 
    ProgramacionesFiltros,
    ProgramacionesTabla,
    ProgramacionFormulario,
    EncabezadoListado,
    AccionesFormulario,
    Modal,
    DialogoConfirmacion,
    Paginacion,
    DatePipe,
  ],
  providers: [ProgramacionesStore],
  templateUrl: './programacion-page.html',
})
export default class ProgramacionPage extends PaginaCrud<Programacion, FiltrosProgramacion> {
  protected readonly store = inject(ProgramacionesStore);
  protected readonly titulos = {
    crear: 'Nueva programación de facturación',
    editar: 'Editar programación',
    consultar: 'Detalle de la programación',
  };

  private readonly repositorio = inject(ProgramacionesRepositorio);
  protected readonly nombrePeriodo = nombrePeriodo;

  protected readonly facturas = toSignal(inject(FacturasRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });

  /** Envíos por programación de la página visible. */
  protected readonly conteo = toSignal(
    toObservable(this.store.items).pipe(
      switchMap((items) =>
        items.length ? this.repositorio.conteoEnvios(items.map((p) => p.id)).pipe(catchError(() => of({}))) : of({}),
      ),
    ),
    { initialValue: {} as Partial<Record<string, number>> },
  );

  protected readonly historialAbierto = signal(false);
  protected readonly programacionHistorial = signal<Programacion | null>(null);
  protected readonly historial = toSignal(
    toObservable(this.programacionHistorial).pipe(
      switchMap((p) =>
        p
          ? this.repositorio.historial(p.id).pipe(
              map((envios): EstadoHistorial => ({ cargando: false, envios, error: false })),
              startWith<EstadoHistorial>({ cargando: true, envios: [], error: false }),
              catchError(() => of<EstadoHistorial>({ cargando: false, envios: [], error: true })),
            )
          : of<EstadoHistorial>({ cargando: false, envios: [], error: false }),
      ),
    ),
    { initialValue: { cargando: false, envios: [], error: false } },
  );
  protected readonly resumenHistorial = computed(() => {
    const envios = this.historial().envios;
    return { enviados: envios.filter((e) => e.estado === 'ENVIADO').length, fallidos: envios.filter((e) => e.estado === 'FALLIDO').length };
  });

  protected verHistorial(p: Programacion): void {
    this.programacionHistorial.set(p);
    this.historialAbierto.set(true);
  }

  protected describir(p: Programacion): string {
    return `la programación "${p.nombre}" (${p.numeroFactura})`;
  }
}
