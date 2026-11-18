import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { MESES_PAGADOS_POR_ANIO, ParametroPlataforma } from 'src/app/sistema/membresias/suscripcion';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';

/**
 * Plataforma › Ajustes (SUPER_ADMIN): parámetros globales (`GET/PUT /plataforma/parametros`) en dos grupos:
 * Membresías (días de la prueba gratuita 1–90 y días de aviso antes del vencimiento 1–60) y Precios (valor mensual con
 * IVA de cada plan pagado; el anual = 10 mensualidades). Cambiar los días de prueba solo afecta a las empresas nuevas;
 * un precio nuevo aplica a los pagos que se hagan desde ahora.
 */
@Component({
  selector: 'app-ajustes-plataforma-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CurrencyPipe],
  template: `
    <div class="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 class="text-2xl font-bold">Ajustes de la plataforma</h1>
        <p class="text-sm text-base-content/70">Valores que aplican a todas las empresas.</p>
      </div>

      @if (cargando()) {
        <div class="skeleton bg-base-300 h-40 w-full"></div>
      } @else if (error()) {
        <div role="alert" class="alert alert-soft alert-error text-sm">
          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{{ error() }}</span>
          <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="cargar()">Reintentar</button>
        </div>
      } @else {
        @for (g of grupos; track g.id) {
          @if (deGrupo(g.id).length) {
            <section class="card bg-base-200 border border-base-300 shadow-xl">
              <div class="card-body gap-4">
                <div>
                  <h2 class="card-title text-lg"><i class="{{ g.icono }} text-info" aria-hidden="true"></i> {{ g.nombre }}</h2>
                  <p class="text-sm text-base-content/70">{{ g.descripcion }}</p>
                </div>
                <div class="grid gap-3" [class.md:grid-cols-3]="g.id === 'PRECIOS'" [class.md:grid-cols-2]="g.id !== 'PRECIOS'">
                  @for (p of deGrupo(g.id); track p.clave) {
                    <form class="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4" (ngSubmit)="guardar(p)">
                      <h3 class="text-info uppercase text-xs font-semibold tracking-wide">{{ p.nombre }}</h3>
                      <p class="text-sm text-base-content/70 grow">{{ p.descripcion }}</p>
                      <label class="flex flex-col gap-1">
                        <span class="label-text text-base-content/90">
                          @if (p.tipo === 'PESOS') { Pesos al mes } @else { Días ({{ p.minimo }}–{{ p.maximo }}) }
                          <span class="text-error">*</span>
                        </span>
                        <input type="number" class="input input-bordered bg-base-100 border-neutral w-full" [name]="p.clave" [min]="p.minimo" [max]="p.maximo"
                          [step]="p.tipo === 'PESOS' ? 100 : 1" inputmode="numeric"
                          [ngModel]="valores()[p.clave]" (ngModelChange)="cambiar(p.clave, $event)" [class.input-error]="!!invalido(p)" />
                      </label>
                      @if (invalido(p); as e) {
                        <span class="text-xs text-error">{{ e }}</span>
                      } @else if (p.tipo === 'PESOS') {
                        <span class="text-xs text-base-content/70">
                          {{ numero(p) | currency: 'COP' : 'symbol-narrow' : '1.0-0' }} al mes ·
                          {{ numero(p) * mesesAnual | currency: 'COP' : 'symbol-narrow' : '1.0-0' }} al año
                        </span>
                      }
                      <button type="submit" class="btn btn-primary btn-sm self-start" [disabled]="guardando() === p.clave || !cambio(p) || !!invalido(p)">
                        @if (guardando() === p.clave) { <span class="loading loading-spinner loading-xs" aria-hidden="true"></span> }
                        Guardar
                      </button>
                    </form>
                  }
                </div>
              </div>
            </section>
          }
        }
      }
    </div>
  `,
})
export default class AjustesPlataformaPage implements OnInit {
  private readonly repositorio = inject(SuscripcionRepositorio);
  private readonly avisos = inject(NotificacionesService);

  protected readonly mesesAnual = MESES_PAGADOS_POR_ANIO;
  protected readonly grupos = [
    {
      id: 'MEMBRESIAS',
      nombre: 'Membresías',
      icono: 'fa-solid fa-id-card',
      descripcion:
        'Prueba gratuita y avisos de vencimiento. Desde los días de aviso se avisa a todos los administradores (campana y correo); si no pagan, al día siguiente del vencimiento la empresa queda en el plan Gratis.',
    },
    {
      id: 'PRECIOS',
      nombre: 'Precios de los planes',
      icono: 'fa-solid fa-tags',
      descripcion: `Valor mensual con IVA de cada plan pagado; el anual equivale a ${MESES_PAGADOS_POR_ANIO} mensualidades. Aplica a los pagos que se hagan desde ahora: los planes ya pagados no cambian.`,
    },
  ] as const;
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

  protected deGrupo(grupo: ParametroPlataforma['grupo']): ParametroPlataforma[] {
    return this.parametros().filter((p) => (p.grupo ?? 'MEMBRESIAS') === grupo);
  }

  protected numero(p: ParametroPlataforma): number {
    return Number(this.valores()[p.clave] ?? p.valor) || 0;
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
    if (texto === '' || !Number.isInteger(n) || n < p.minimo || n > p.maximo) {
      const f = (x: number) => x.toLocaleString('es-CO');
      return `Escribe un número entero entre ${f(p.minimo)} y ${f(p.maximo)}.`;
    }
    return null;
  }

  protected async guardar(p: ParametroPlataforma): Promise<void> {
    if (this.invalido(p) || !this.cambio(p)) return;
    this.guardando.set(p.clave);
    try {
      const nuevo = await firstValueFrom(this.repositorio.actualizarParametroPlataforma(p.clave, this.valores()[p.clave]));
      this.parametros.update((lista) => lista.map((x) => (x.clave === nuevo.clave ? nuevo : x)));
      this.cambiar(nuevo.clave, nuevo.valor);
      this.avisos.exito(`${nuevo.nombre}: ${nuevo.tipo === 'PESOS' ? `$${Number(nuevo.valor).toLocaleString('es-CO')}` : `${nuevo.valor} días`}.`);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(null);
    }
  }
}
