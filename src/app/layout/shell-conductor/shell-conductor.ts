import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService, nombreRol } from 'src/app/core/auth';
import { ContenedorNotificaciones } from 'src/app/shared/notificaciones/contenedor-notificaciones';
import { Avatar } from 'src/app/shared/foto/avatar';
import { inicialesDe } from 'src/app/shared/foto/foto';

/**
 * Layout de la app del conductor/monitora: pensado para el celular dentro del vehículo
 * (una columna, botones grandes, sin menú lateral ni módulos administrativos).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shell-conductor',
  imports: [Avatar, RouterOutlet, RouterLink, ContenedorNotificaciones],
  templateUrl: './shell-conductor.html',
})
export default class ShellConductor {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sesion = this.auth.sesion;
  protected readonly inicialesDe = inicialesDe;
  protected readonly rol = computed(() => {
    const s = this.sesion();
    return s ? nombreRol(s.rol) : '';
  });

  protected salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigate(['/login']);
  }
}
