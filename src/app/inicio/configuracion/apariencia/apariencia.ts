import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TemaApariencia, TemaApp } from 'src/app/core/tema';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { ConfiguracionRepositorio } from '../configuracion-repositorio';

/**
 * Configuración › Apariencia: tema oscuro (por defecto) o claro para todos los usuarios de la empresa (administradores,
 * conductores, monitoras y acudientes lo reciben al iniciar sesión). Se guarda al elegirlo.
 */
@Component({
  selector: 'app-apariencia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 max-w-3xl">
      <p class="text-sm text-base-content/70">Elige cómo se ve RutaRola para todos los usuarios de tu empresa. Se aplica al instante.</p>
      <div role="radiogroup" aria-label="Tema de la aplicación" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        @for (t of temas; track t.id) {
          <label class="card border-2 border-base-300 bg-base-100 p-4 gap-3 cursor-pointer has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2"
            [class.opacity-70]="guardando() && guardando() !== t.id">
            <input type="radio" name="tema" class="sr-only" [checked]="tema.tema() === t.id" [disabled]="!!guardando()" (change)="elegir(t.id)" />
            <!-- Muestra fija de cada tema (no depende del tema actual). -->
            <span class="rounded-box overflow-hidden border border-neutral h-24 flex" aria-hidden="true" [style.background]="t.fondo">
              <span class="w-1/4 h-full" [style.background]="t.barra"></span>
              <span class="flex-1 p-2 flex flex-col gap-1.5">
                <span class="h-3 w-1/2 rounded" [style.background]="t.texto"></span>
                <span class="h-10 rounded-md" [style.background]="t.tarjeta"></span>
                <span class="h-3 w-12 rounded bg-[#facc15]"></span>
              </span>
            </span>
            <span class="flex items-center justify-between gap-2">
              <span class="font-semibold flex items-center gap-2"><i [class]="t.icono" aria-hidden="true"></i> {{ t.nombre }}</span>
              @if (guardando() === t.id) {
                <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
              } @else if (tema.tema() === t.id) {
                <span class="badge badge-sm badge-soft badge-success"><i class="fa-solid fa-check" aria-hidden="true"></i> En uso</span>
              }
            </span>
            <span class="text-xs text-base-content/70">{{ t.descripcion }}</span>
          </label>
        }
      </div>
    </div>
  `,
})
export class Apariencia {
  private readonly repositorio = inject(ConfiguracionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  protected readonly tema = inject(TemaApp);
  protected readonly guardando = signal<TemaApariencia | null>(null);

  protected readonly temas: { id: TemaApariencia; nombre: string; descripcion: string; icono: string; fondo: string; barra: string; tarjeta: string; texto: string }[] = [
    { id: 'OSCURO', nombre: 'Oscuro', descripcion: 'El tema por defecto: descansa la vista y ahorra batería en los teléfonos.', icono: 'fa-solid fa-moon',
      fondo: '#111827', barra: '#1f2937', tarjeta: '#1f2937', texto: '#f3f4f6' },
    { id: 'CLARO', nombre: 'Claro', descripcion: 'Fondo blanco, ideal para oficinas iluminadas o para imprimir pantallas.', icono: 'fa-solid fa-sun',
      fondo: '#f3f4f6', barra: '#ffffff', tarjeta: '#ffffff', texto: '#111827' },
  ];

  protected async elegir(tema: TemaApariencia): Promise<void> {
    if (tema === this.tema.tema()) return;
    const anterior = this.tema.tema();
    this.guardando.set(tema);
    this.tema.establecer(tema);
    try {
      await firstValueFrom(this.repositorio.guardarTema(tema));
      this.avisos.exito(`Tema ${tema === 'CLARO' ? 'claro' : 'oscuro'} aplicado para toda tu empresa.`);
    } catch (e) {
      this.tema.establecer(anterior);
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(null);
    }
  }
}
