import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { ResumenRecorrido, RutaAsignada, TRAYECTOS, Trayecto, avance } from './recorrido';
import { RecorridosRepositorio } from './recorridos-repositorio';
import { Avatar } from 'src/app/shared/foto/avatar';
import { inicialesDe } from 'src/app/shared/foto/foto';

/** Entrada del conductor/monitora: sus rutas de hoy y el estado de la recogida y la entrega de cada una. */
@Component({
  selector: 'app-ruta-del-dia-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar],
  templateUrl: './ruta-del-dia-page.html',
})
export default class RutaDelDiaPage implements OnInit {
  protected readonly inicialesDe = inicialesDe;
  private readonly repositorio = inject(RecorridosRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly sesion = inject(AuthService).sesion;
  protected readonly trayectos = TRAYECTOS;
  protected readonly avance = avance;

  protected readonly rutas = signal<RutaAsignada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** `asignacionId:trayecto` que se está iniciando. */
  protected readonly iniciando = signal<string | null>(null);

  private readonly ahora = new Date();
  protected readonly saludo = `${this.ahora.getHours() < 12 ? 'Buenos días' : this.ahora.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${this.sesion()?.nombre.split(' ')[0] ?? ''}`;
  protected readonly fechaHoy = this.ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  /** Recorrido que quedó abierto (se retoma desde aquí aunque se cierre la app). */
  protected readonly enCurso = computed(() => {
    for (const ruta of this.rutas()) {
      const r = ruta.recorridos.find((x) => x.estado === 'EN_CURSO');
      if (r) return { ruta, recorrido: r };
    }
    return null;
  });

  /** La UNA acción principal de la vista: continuar el recorrido abierto o iniciar el siguiente trayecto pendiente. */
  protected readonly sugerido = computed(() => {
    if (this.enCurso()) return null;
    for (const ruta of this.rutas()) {
      const t = TRAYECTOS.find(({ id }) => !ruta.recorridos.some((r) => r.trayecto === id));
      if (t) return `${ruta.asignacionId}:${t.id}`;
    }
    return null;
  });

  protected readonly completados = computed(
    () => this.rutas().reduce((s, r) => s + r.recorridos.filter((x) => x.estado === 'FINALIZADO').length, 0),
  );

  ngOnInit(): void {
    void this.cargar();
    // Si el compañero inicia o avanza un recorrido, la lista se actualiza sola ("Continuar").
    this.repositorio
      .observarRutasDelDia(fechaIso())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rutas) => {
        if (!this.iniciando()) this.rutas.set(rutas);
      });
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.rutas.set(await firstValueFrom(this.repositorio.rutasDelDia(fechaIso())));
      this.error.set(null);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected recorridoDe(ruta: RutaAsignada, trayecto: Trayecto): ResumenRecorrido | undefined {
    return ruta.recorridos.find((r) => r.trayecto === trayecto);
  }

  protected async iniciar(ruta: RutaAsignada, trayecto: Trayecto): Promise<void> {
    this.iniciando.set(`${ruta.asignacionId}:${trayecto}`);
    try {
      const recorrido = await firstValueFrom(this.repositorio.iniciar(ruta.asignacionId, trayecto));
      // Ya lo había iniciado el compañero: se une al mismo recorrido, donde va.
      if (recorrido.iniciadoPor !== this.sesion()?.empleadoId) {
        const quien = ruta.companero?.nombre.split(' ')[0] ?? 'Tu compañero';
        const nombre = TRAYECTOS.find((t) => t.id === trayecto)?.nombre.toLowerCase() ?? '';
        this.avisos.info(
          recorrido.estado === 'EN_CURSO'
            ? `${quien} ya había iniciado la ${nombre}. Continúas donde va el recorrido.`
            : `La ${nombre} de hoy ya fue finalizada.`,
        );
      }
      await this.router.navigate(['/ruta-del-dia/recorrido', recorrido.id]);
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
      void this.cargar();
    } finally {
      this.iniciando.set(null);
    }
  }

  protected hora(iso: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  protected telefono(numero: string): string {
    return `tel:${numero.replace(/\D/g, '')}`;
  }
}
