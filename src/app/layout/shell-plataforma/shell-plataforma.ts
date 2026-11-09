import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from 'src/app/core/auth';
import { ContenedorNotificaciones } from 'src/app/shared/notificaciones/contenedor-notificaciones';
import { Avatar } from 'src/app/shared/foto/avatar';
import { inicialesDe } from 'src/app/shared/foto/foto';

/** Layout de la plataforma (SUPER_ADMIN): sin módulos de una empresa, solo la administración de empresas. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shell-plataforma',
  imports: [Avatar, RouterOutlet, RouterLink, RouterLinkActive, ContenedorNotificaciones],
  templateUrl: './shell-plataforma.html',
})
export default class ShellPlataforma {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sesion = this.auth.sesion;
  protected readonly inicialesDe = inicialesDe;

  protected salir(): void {
    this.auth.cerrarSesion();
    void this.router.navigate(['/login']);
  }
}
