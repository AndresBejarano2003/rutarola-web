import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, interval, map, of, startWith, switchMap } from 'rxjs';
import { AvisoAusencia, textoAviso } from 'src/app/ruta-del-dia/avisos-ausencia';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { AvisosAusenciaRepositorio } from './avisos-ausencia-repositorio';

type Estado = { cargando: true } | { cargando: false; avisos: AvisoAusencia[]; error: string | null };

/**
 * Operación › Asignaciones: estudiantes que, según su acudiente, no viajan en la fecha (hoy por defecto), con su ruta,
 * lo que avisó y si el conductor o la monitora ya lo confirmó. Se refresca cada minuto.
 */
@Component({
  selector: 'app-avisos-del-dia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card bg-base-200 border border-base-300 shadow-xl" aria-labelledby="titulo-avisos-dia">
      <div class="card-body gap-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="min-w-0">
            <h2 id="titulo-avisos-dia" class="card-title text-lg">
              <i class="fa-solid fa-user-slash text-warning" aria-hidden="true"></i> Avisos de ausencia
              @if (lista().length) {
                <span class="badge badge-soft badge-warning">{{ lista().length }}</span>
              }
            </h2>
            <p class="text-sm text-base-content/70">Estudiantes que su acudiente avisó desde el portal que no viajan. La ruta lo confirma al pasar.</p>
          </div>
          <label class="flex flex-col gap-1">
            <span class="label-text text-base-content/90 text-sm">Fecha</span>
            <input type="date" class="input input-bordered input-sm bg-base-100 border-neutral" [value]="fecha()"
              (change)="cambiarFecha($any($event.target).value)" aria-label="Fecha de los avisos" />
          </label>
        </div>

        @if (estado(); as e) {
          @if (e.cargando) {
            <div class="skeleton bg-base-300 h-12 w-full"></div>
          } @else if (e.error) {
            <p role="alert" class="text-sm text-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {{ e.error }}</p>
          } @else if (e.avisos.length === 0) {
            <p class="text-sm text-base-content/70"><i class="fa-solid fa-circle-check text-success" aria-hidden="true"></i> Ningún acudiente avisó ausencias para {{ fecha() === hoy ? 'hoy' : 'esta fecha' }}.</p>
          } @else {
            <div class="@container overflow-x-auto rounded-box border border-base-300">
              <table class="table table-sm">
                <thead>
                  <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
                    <th>Estudiante</th>
                    <th class="hidden @3xl:table-cell">Ruta</th>
                    <th>Aviso</th>
                    <th class="hidden @5xl:table-cell">Acudiente</th>
                    <th class="text-right">Ruta confirmó</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of e.avisos; track a.id) {
                    <tr class="border-base-300 hover:bg-base-300/50">
                      <td>
                        <div class="font-medium">{{ a.estudiante }}</div>
                        <div class="text-xs text-base-content/70 @3xl:hidden">{{ a.ruta || 'Sin ruta' }}</div>
                      </td>
                      <td class="hidden @3xl:table-cell text-sm">{{ a.ruta || '—' }}</td>
                      <td class="text-sm whitespace-normal min-w-44">
                        {{ textoAviso(a) }}
                        @if (a.nota) { <span class="block text-xs text-base-content/70">“{{ a.nota }}”</span> }
                      </td>
                      <td class="hidden @5xl:table-cell text-sm">
                        {{ a.acudiente }}
                        @if (a.telefonoAcudiente) {
                          <a class="link link-secondary ml-1" [href]="telefono(a.telefonoAcudiente)" [attr.aria-label]="'Llamar a ' + a.acudiente">
                            <i class="fa-solid fa-phone" aria-hidden="true"></i>
                          </a>
                        }
                      </td>
                      <td class="text-right">
                        @if (a.confirmado) {
                          <span class="badge badge-sm badge-soft badge-success" [title]="'Confirmado por ' + a.confirmadoPor">
                            <i class="fa-solid fa-check" aria-hidden="true"></i> {{ a.confirmadoPor || 'Confirmado' }}
                          </span>
                        } @else {
                          <span class="badge badge-sm badge-soft badge-warning">Por confirmar</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class AvisosDelDia {
  private readonly repositorio = inject(AvisosAusenciaRepositorio);
  protected readonly textoAviso = textoAviso;
  protected readonly hoy = fechaIso();
  protected readonly fecha = signal(this.hoy);

  protected readonly estado = toSignal(
    combineLatest([toObservable(this.fecha), interval(60_000).pipe(startWith(0))]).pipe(
      switchMap(([fecha]) =>
        this.repositorio.listar({ fecha, rutaId: '' }).pipe(
          map((avisos): Estado => ({ cargando: false, avisos, error: null })),
          catchError((e: unknown) => of<Estado>({ cargando: false, avisos: [], error: mensajeDeError(e) })),
          startWith<Estado>({ cargando: true }),
        ),
      ),
    ),
    { initialValue: { cargando: true } as Estado },
  );

  protected readonly lista = () => {
    const e = this.estado();
    return e.cargando ? [] : e.avisos;
  };

  protected telefono(numero: string): string {
    return `tel:${numero.replace(/\D/g, '')}`;
  }

  protected cambiarFecha(valor: string): void {
    this.fecha.set(valor || this.hoy);
  }
}
