import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, rutaInicio } from 'src/app/core/auth';
import { LONGITUD_MAXIMA_CONTRASENA, LONGITUD_MINIMA_CONTRASENA, PATRON_USUARIO, contrasenasIguales } from 'src/app/personas/compartido/acceso';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { mensajeError, nit } from 'src/app/shared/formularios/formularios';
import { MESES_PRUEBA } from 'src/app/sistema/membresias/suscripcion';
import { AutenticacionRepositorio } from '../autenticacion-repositorio';

/**
 * Registro público de una empresa de transporte (`/registro`): datos de la empresa y de su administrador.
 * El servidor crea la empresa con {@link MESES_PRUEBA} meses del plan Profesional y deja la sesión iniciada.
 */
@Component({
  selector: 'app-registro-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Campo, TituloSeccion],
  templateUrl: './registro-page.html',
})
export default class RegistroPage {
  private readonly repositorio = inject(AutenticacionRepositorio);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly mesesPrueba = MESES_PRUEBA;
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly verContrasena = signal(false);

  protected readonly form = this.fb.group(
    {
      empresa: this.fb.group({
        nombre: ['', [Validators.required, Validators.maxLength(150)]],
        nit: ['', [Validators.required, nit]],
        ciudad: ['', [Validators.required, Validators.maxLength(100)]],
        telefono: ['', [Validators.required, Validators.maxLength(20)]],
      }),
      administrador: this.fb.group({
        nombre: ['', [Validators.required, Validators.maxLength(150)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
        usuario: ['', [Validators.required, Validators.pattern(PATRON_USUARIO)]],
      }),
      contrasena: ['', [Validators.required, Validators.minLength(LONGITUD_MINIMA_CONTRASENA), Validators.maxLength(LONGITUD_MAXIMA_CONTRASENA)]],
      confirmarContrasena: ['', Validators.required],
      aceptaTerminos: [false, Validators.requiredTrue],
    },
    { validators: contrasenasIguales },
  );

  protected campo(ruta: string): string | null {
    const control = this.form.get(ruta);
    if (!control) return null;
    if (ruta === 'confirmarContrasena' && control.touched && this.form.hasError('noCoincide')) return 'Las contraseñas no coinciden.';
    if (ruta === 'aceptaTerminos') return control.touched && control.invalid ? 'Debes aceptar los términos para continuar.' : null;
    return mensajeError(control);
  }

  protected async registrar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    try {
      const sesion = await firstValueFrom(
        this.repositorio.registrarEmpresa({
          empresa: { nombre: v.empresa.nombre.trim(), nit: v.empresa.nit.trim(), ciudad: v.empresa.ciudad.trim(), telefono: v.empresa.telefono.trim() },
          administrador: { nombre: v.administrador.nombre.trim(), email: v.administrador.email.trim(), usuario: v.administrador.usuario.trim(), contrasena: v.contrasena },
          aceptaTerminos: v.aceptaTerminos,
        }),
      );
      this.auth.abrirSesion(sesion, true);
      await this.router.navigateByUrl(rutaInicio(sesion.rol));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
