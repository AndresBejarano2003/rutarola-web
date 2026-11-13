import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth';

/** Tema de la aplicación por empresa (`Empresa.Tema`): oscuro por defecto. */
export type TemaApariencia = 'OSCURO' | 'CLARO';

/** Nombre del tema de DaisyUI (`styles.css`) de cada opción. */
export const TEMAS_DAISY: Record<TemaApariencia, string> = { OSCURO: 'rutarola', CLARO: 'rutarola-claro' };

/** Último tema usado en este navegador: se aplica antes de iniciar sesión (login) y en modo local. */
export const CLAVE_TEMA = 'rutarola.tema';

export function temaGuardado(): TemaApariencia {
  try {
    return localStorage.getItem(CLAVE_TEMA) === 'CLARO' ? 'CLARO' : 'OSCURO';
  } catch {
    return 'OSCURO';
  }
}

export function aplicarTema(tema: TemaApariencia): void {
  document.documentElement.dataset['theme'] = TEMAS_DAISY[tema];
  document.documentElement.style.colorScheme = tema === 'CLARO' ? 'light' : 'dark';
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento: el tema se aplica solo en esta pestaña.
  }
}

/**
 * Aplica el tema de la empresa de la sesión (`Sesion.empresa.tema`, lo envía el servidor a todos sus usuarios) o, sin
 * él, el último usado en el navegador. Se inicia en `App`.
 */
@Injectable({ providedIn: 'root' })
export class TemaApp {
  private readonly auth = inject(AuthService);
  private readonly _tema = signal<TemaApariencia>(temaGuardado());
  readonly tema = this._tema.asReadonly();

  constructor() {
    aplicarTema(this._tema());
    effect(() => {
      const delaEmpresa = this.auth.sesion()?.empresa?.tema;
      if (delaEmpresa && delaEmpresa !== this._tema()) this.establecer(delaEmpresa);
    });
  }

  /** Cambia el tema (la configuración ya lo guardó para la empresa) y lo deja en la sesión. */
  establecer(tema: TemaApariencia): void {
    this._tema.set(tema);
    aplicarTema(tema);
    this.auth.actualizarEmpresa({ tema });
  }
}
