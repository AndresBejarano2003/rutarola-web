import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { CLAVE_DIAS_PRUEBA, ParametroPlataforma } from 'src/app/sistema/membresias/suscripcion';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';

/**
 * Plataforma › Ajustes (SUPER_ADMIN): parámetros globales (`GET/PUT /plataforma/parametros`). Hoy, los días de la
 * prueba gratuita (`suscripcion.dias_prueba`, 1–90, por defecto 15). Cambiarlos solo afecta a las empresas que se
 * registren después: cada prueba conserva los días con que empezó.
 */
@Component({
  selector: 'app-ajustes-plataforma-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <section class="card bg-base-200 border border-base-300 shadow-xl max-w-3xl">
      <div class="card-body gap-4">
        <div>
          <h1 class="card-title text-xl">Ajustes de la plataforma</h1>
          <p class="text-sm text-base-content/70">Valores que aplican a todas las empresas.</p>
        </div>

        @if (cargando()) {
          <div class="skeleton bg-base-300 h-24 w-full"></div>
        } @else if (error()) {
          <div role="alert" class="alert alert-soft alert-error text-sm">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{{ error() }}</span>
            <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="cargar()">Reintentar</button>
          </div>
        } @else {
          @for (p of parametros(); track p.clave) {
            <form class="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4" (ngSubmit)="guardar(p)">
              <h2 class="text-info uppercase text-xs font-semibold tracking-wide">{{ p.nombre }}</h2>
              <p class="text-sm text-base-content/70">{{ p.descripcion }}</p>
              <div class="flex flex-wrap items-end gap-3">
                <label class="flex flex-col gap-1">
                  <span class="label-text text-base-content/90">Valor ({{ p.minimo }}–{{ p.maximo }}) <span class="text-error">*</span></span>
                  <input type="number" class="input input-bordered bg-base-100 border-neutral w-32" [name]="p.clave" [min]="p.minimo" [max]="p.maximo"
                    [ngModel]="valores()[p.clave]" (ngModelChange)="cambiar(p.clave, $event)" [class.input-error]="!!invalido(p)" />
                </label>
                <button type="submit" class="btn btn-primary" [disabled]="guardando() === p.clave || !cambio(p) || !!invalido(p)">
                  @if (guardando() === p.clave) { <span class="loading loading-spinner loading-sm" aria-hidden="true"></span> }
                  Guardar
                </button>
              </div>
              @if (invalido(p); as e) { <span class="text-xs text-error">{{ e }}</span> }
              @if (p.clave === claveDiasPrueba) {
                <p class="text-xs text-base-content/70">
                  <i class="fa-solid fa-circle-info text-info" aria-hidden="true"></i>
                  Solo aplica a las empresas que se registren desde ahora: las que ya empezaron su prueba conservan los días con que la tomaron.
                </p>
              }
            </form>
          }
        }
      </div>
    </section>
  `,
})
export default class AjustesPlataformaPage implements OnInit {
  private readonly repositorio = inject(SuscripcionRepositorio);
  private readonly avisos = inject(NotificacionesService);

  protected readonly claveDiasPrueba = CLAVE_DIAS_PRUEBA;
  protected readonly parametros = signal<ParametroPlataforma[]>([]);
  protected readonly valores = signal<Record<string, string>>({});
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal<string | null>(null);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const lista = await firstValueFrom(this.repositorio.parametrosPlataforma());
      this.parametros.set(lista);
      this.valores.set(Object.fromEntries(lista.map((p) => [p.clave, p.valor])));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected cambiar(clave: string, valor: unknown): void {
    this.valores.update((v) => ({ ...v, [clave]: valor === null || valor === undefined ? '' : String(valor) }));
  }

  protected cambio(p: ParametroPlataforma): boolean {
    return (this.valores()[p.clave] ?? '') !== p.valor;
  }

  protected invalido(p: ParametroPlataforma): string | null {
    const texto = this.valores()[p.clave] ?? '';
    const n = Number(texto);
    if (texto === '' || !Number.isInteger(n) || n < p.minimo || n > p.maximo) return `Escribe un número entero entre ${p.minimo} y ${p.maximo}.`;
    return null;
  }

  protected async guardar(p: ParametroPlataforma): Promise<void> {
    if (this.invalido(p) || !this.cambio(p)) return;
    this.guardando.set(p.clave);
    try {
      const nuevo = await firstValueFrom(this.repositorio.actualizarParametroPlataforma(p.clave, this.valores()[p.clave]));
      this.parametros.update((lista) => lista.map((x) => (x.clave === nuevo.clave ? nuevo : x)));
      this.cambiar(nuevo.clave, nuevo.valor);
      this.avisos.exito(`${nuevo.nombre}: ${nuevo.valor}.`);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(null);
    }
  }
}
