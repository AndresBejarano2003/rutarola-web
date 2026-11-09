import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService, nombreRol } from 'src/app/core/auth';
import { contrasenasIguales } from 'src/app/personas/compartido/acceso';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { AutenticacionRepositorio, PerfilUsuario } from '../autenticacion-repositorio';
import { CampoFoto } from 'src/app/shared/foto/campo-foto';
import { inicialesDe } from 'src/app/shared/foto/foto';

/**
 * "Mi cuenta" de cualquier tipo de usuario (administrador, conductor/monitora, acudiente, plataforma): sus
 * datos (foto de perfil, teléfono, correo y, el administrador, su nombre) y el cambio de contraseña. Con el API,
 * cambiarla cierra las sesiones de los otros dispositivos. Nombre, documento y usuario de empleados y acudientes
 * los edita el administrador en Personas. La foto nueva se ve al instante en la barra superior.
 */
@Component({
  selector: 'app-cuenta-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Campo, CampoFoto],
  templateUrl: './cuenta-page.html',
})
export default class CuentaPage implements OnInit {
  private readonly repositorio = inject(AutenticacionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly auth = inject(AuthService);
  protected readonly sesion = this.auth.sesion;
  protected readonly modoLocal = esFuenteLocal(this.repositorio);

  protected readonly rol = computed(() => {
    const s = this.sesion();
    return s ? nombreRol(s.rol) : '';
  });
  protected readonly inicio = computed(() => {
    const s = this.sesion();
    return s ? new Date(s.inicio).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '';
  });
  protected readonly perfil = signal<PerfilUsuario | null>(null);
  protected readonly cargandoPerfil = signal(true);
  protected readonly guardandoDatos = signal(false);
  protected readonly iniciales = computed(() => inicialesDe(this.sesion()?.nombre ?? ''));
  protected readonly guardando = signal(false);
  protected readonly visible = signal(false);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly datos = this.fb.group({
    foto: [''],
    nombre: ['', Validators.maxLength(150)],
    telefono: ['', [Validators.maxLength(20), Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    correo: ['', [Validators.email, Validators.maxLength(150)]],
  });

  protected readonly form = this.fb.group(
    {
      actual: ['', Validators.required],
      contrasena: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(200)]],
      confirmarContrasena: ['', Validators.required],
    },
    { validators: contrasenasIguales },
  );

  ngOnInit(): void {
    void this.cargarPerfil();
  }

  private async cargarPerfil(): Promise<void> {
    this.cargandoPerfil.set(true);
    try {
      const p = await firstValueFrom(this.repositorio.perfil());
      this.perfil.set(p);
      this.datos.reset({ foto: p.foto, nombre: p.nombre, telefono: p.telefono, correo: p.correo });
      // Requisitos según el tipo de usuario: el administrador su nombre; las personas su teléfono.
      this.datos.controls.nombre.setValidators(p.editaNombre ? [Validators.required, Validators.maxLength(150)] : Validators.maxLength(150));
      this.datos.controls.telefono.addValidators(p.editaNombre ? [] : Validators.required);
      this.datos.updateValueAndValidity();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.cargandoPerfil.set(false);
    }
  }

  protected errorDato(campo: 'nombre' | 'telefono' | 'correo'): string | null {
    const control = this.datos.controls[campo];
    if (campo === 'telefono' && control.hasError('pattern') && control.touched) return 'Ingresa un teléfono válido (solo números, 7 a 20).';
    return mensajeError(control);
  }

  protected async guardarDatos(): Promise<void> {
    if (this.datos.invalid) {
      this.datos.markAllAsTouched();
      return;
    }
    this.guardandoDatos.set(true);
    try {
      const cambios = await firstValueFrom(this.repositorio.actualizarPerfil(this.datos.getRawValue()));
      this.auth.actualizarSesion(cambios);
      this.datos.markAsPristine();
      this.avisos.exito('Tus datos quedaron guardados.');
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardandoDatos.set(false);
    }
  }

  protected error(campo: 'actual' | 'contrasena' | 'confirmarContrasena'): string | null {
    const control = this.form.controls[campo];
    if (control.hasError('noCoincide') && (control.touched || control.dirty)) return 'Las contraseñas no coinciden.';
    return mensajeError(control);
  }

  protected async cambiar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { actual, contrasena } = this.form.getRawValue();
    this.guardando.set(true);
    try {
      await firstValueFrom(this.repositorio.cambiarContrasena(actual, contrasena), { defaultValue: undefined });
      this.form.reset();
      this.avisos.exito(this.modoLocal ? 'Contraseña actualizada.' : 'Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.');
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
