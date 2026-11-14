import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService, nombreRol } from 'src/app/core/auth';
import { InsigniaPlan } from 'src/app/sistema/membresias/insignia-plan/insignia-plan';
import { CampanaNotificaciones } from '../campana-notificaciones/campana-notificaciones';

interface OpcionUsuario {
  icono: string;
  etiqueta: string;
  ruta: string;
  cerrarSesion?: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-barra-superior',
  imports: [RouterLink, RouterLinkActive, CampanaNotificaciones, InsigniaPlan],
  templateUrl: './barra-superior.html',
})
export class BarraSuperior {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** Breadcrumb de la ruta activa más profunda (`data.breadcrumb`). */
  protected readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.leerBreadcrumb()),
    ),
    { initialValue: this.leerBreadcrumb() },
  );

  /** Usuario de la sesión (el guard garantiza que existe dentro del shell). */
  protected readonly usuario = computed(() => {
    const s = this.auth.sesion();
    return {
      nombre: s?.nombre ?? '',
      correo: s?.correo || s?.usuario || '',
      imagen: s?.imagen ?? '',
      iniciales: (s?.nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
      rol: s ? nombreRol(s.rol) : '',
      enLinea: true,
    };
  });

  protected readonly opcionesUsuario: OpcionUsuario[] = [
    { icono: 'fa-solid fa-user', etiqueta: 'Mi perfil', ruta: '/inicio/perfil' },
    { icono: 'fa-solid fa-gear', etiqueta: 'Configuración', ruta: '/inicio/configuracion' },
    {
      icono: 'fa-solid fa-right-from-bracket',
      etiqueta: 'Cerrar sesión',
      ruta: '/login',
      cerrarSesion: true,
    },
  ];

  protected alSeleccionar(opcion: OpcionUsuario): void {
    if (opcion.cerrarSesion) {
      this.auth.cerrarSesion();
    }
  }

  private leerBreadcrumb(): string[] {
    // Se lee del estado del router (no de ActivatedRoute): durante la primera
    // navegación el snapshot de ActivatedRoute todavía no existe.
    let actual = this.router.routerState.snapshot.root;
    while (actual.firstChild) {
      actual = actual.firstChild;
    }
    return (actual.data['breadcrumb'] as string[] | undefined) ?? [];
  }
}
