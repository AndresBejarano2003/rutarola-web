import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { CuentaUnida } from '../../autenticacion-repositorio';
import { CuentasUnidasEstado } from './cuentas-unidas-estado';

/**
 * Mi cuenta › "Mis empresas de transporte" (solo acudientes): une la cuenta que le dio OTRA empresa escribiendo su
 * usuario y contraseña, entra a cualquiera sin volver a escribirla y la separa cuando quiera. Cada empresa sigue
 * viendo solo sus propios datos; el administrador puede no permitirlo (Configuración › Empresa y parámetros).
 */
@Component({
  selector: 'app-cuentas-unidas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Campo, DialogoConfirmacion],
  templateUrl: './cuentas-unidas.html',
})
export class CuentasUnidas implements OnInit {
  protected readonly estado = inject(CuentasUnidasEstado);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly uniendo = signal(false);
  protected readonly formularioAbierto = signal(false);
  protected readonly porSeparar = signal<CuentaUnida | null>(null);
  protected readonly separando = signal(false);

  protected readonly form = this.fb.group({
    usuario: ['', [Validators.required, Validators.maxLength(150)]],
    contrasena: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    void this.estado.cargar();
  }

  protected error(campo: 'usuario' | 'contrasena'): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected async unir(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { usuario, contrasena } = this.form.getRawValue();
    this.uniendo.set(true);
    try {
      await this.estado.unir(usuario, contrasena);
      this.form.reset();
      this.formularioAbierto.set(false);
      this.avisos.exito('Cuenta unida. Ya puedes cambiar de empresa desde el encabezado del portal.');
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.uniendo.set(false);
    }
  }

  protected async entrar(c: CuentaUnida): Promise<void> {
    try {
      await this.estado.entrar(c.idUsuario);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  protected async confirmarSeparar(): Promise<void> {
    const c = this.porSeparar();
    if (!c) return;
    this.separando.set(true);
    try {
      await this.estado.separar(c.idUsuario);
      this.avisos.exito(c.actual ? 'Tu cuenta quedó separada de las demás.' : `La cuenta de ${c.empresa} quedó separada.`);
      this.porSeparar.set(null);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.separando.set(false);
    }
  }
}
