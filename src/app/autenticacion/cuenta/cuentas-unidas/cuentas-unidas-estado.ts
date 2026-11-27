import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { AutenticacionRepositorio, CuentaUnida } from '../../autenticacion-repositorio';

/**
 * Cuentas unidas del acudiente (otras empresas de transporte donde también tiene estudiantes). Provisto en
 * `portal.routes.ts`: lo comparten el selector de empresa del encabezado, el aviso del Inicio y Mi cuenta.
 * Entrar a otra cuenta guarda la sesión de esa empresa y recarga el portal (datos, tema y tiempo real de esa empresa).
 */
@Injectable()
export class CuentasUnidasEstado {
  private readonly repositorio = inject(AutenticacionRepositorio);
  private readonly auth = inject(AuthService);
  private readonly documento = inject(DOCUMENT);

  readonly modoLocal = esFuenteLocal(this.repositorio);
  readonly cuentas = signal<CuentaUnida[]>([]);
  readonly cargando = signal(false);
  /** Id de la cuenta a la que se está entrando. */
  readonly entrando = signal<string | null>(null);
  readonly otras = computed(() => this.cuentas().filter((c) => !c.actual));

  async cargar(): Promise<void> {
    if (this.auth.rol() !== 'ACUDIENTE') return;
    this.cargando.set(true);
    try {
      this.cuentas.set(await firstValueFrom(this.repositorio.cuentasUnidas()));
    } catch {
      // Sin cuentas unidas no se muestra nada; no interrumpe el portal.
      this.cuentas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  async unir(usuario: string, contrasena: string): Promise<void> {
    this.cuentas.set(await firstValueFrom(this.repositorio.unirCuenta(usuario, contrasena)));
  }

  async separar(idUsuario: string): Promise<void> {
    this.cuentas.set(await firstValueFrom(this.repositorio.separarCuenta(idUsuario)));
  }

  /** Lanza el error (con su mensaje) si no se pudo entrar. */
  async entrar(idUsuario: string): Promise<void> {
    this.entrando.set(idUsuario);
    try {
      const sesion = await firstValueFrom(this.repositorio.entrarACuenta(idUsuario));
      this.auth.cambiarSesion(sesion);
      const ventana = this.documento.defaultView;
      if (ventana) {
        ventana.location.hash = '#/portal';
        ventana.location.reload();
      }
    } catch (e) {
      this.entrando.set(null);
      throw new Error(mensajeDeError(e));
    }
  }
}
