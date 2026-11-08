import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  LONGITUD_MAXIMA_CONTRASENA,
  LONGITUD_MINIMA_CONTRASENA,
  PATRON_USUARIO,
  ajustarContrasena,
  contrasenasIguales,
} from 'src/app/personas/compartido/acceso';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { Campo } from 'src/app/shared/campo/campo';
import { ESTADOS_REGISTRO, EstadoRegistro, mensajeDeError } from 'src/app/shared/crud/crud';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { AdministradorEmpresa } from '../empresa';
import { EmpresasRepositorio } from '../empresas-repositorio';

/** Qué panel está abierto debajo de la lista (uno a la vez). */
type Panel = { tipo: 'contrasena'; admin: AdministradorEmpresa } | { tipo: 'crear' } | { tipo: 'editar'; admin: AdministradorEmpresa } | null;

/** Contraseña aleatoria legible (sin 0/O ni 1/l) para restablecer y compartir por un canal seguro. */
export function generarContrasena(longitud = 12): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const azar = crypto.getRandomValues(new Uint32Array(longitud));
  return Array.from(azar, (n) => caracteres[n % caracteres.length]).join('');
}

/**
 * Administradores de UNA empresa en el detalle de Plataforma › Empresas: quiénes son, cuándo entraron por
 * última vez, y restablecer su contraseña (cierra sus sesiones), editarlos, inactivarlos o agregar otro.
 * Va FUERA del `<form>` de la empresa (no se anidan formularios).
 */
@Component({
  selector: 'app-administradores-empresa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgTemplateOutlet, BadgeEstado, Campo, SelectorBusqueda],
  templateUrl: './administradores-empresa.html',
})
export class AdministradoresEmpresa {
  readonly empresaId = input.required<string>();

  private readonly repositorio = inject(EmpresasRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly estados = ESTADOS_REGISTRO;

  protected readonly lista = signal<AdministradorEmpresa[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly panel = signal<Panel>(null);
  protected readonly guardando = signal(false);
  protected readonly verContrasena = signal(false);

  protected readonly formContrasena = this.fb.group(
    {
      contrasena: ['', [Validators.required, Validators.minLength(LONGITUD_MINIMA_CONTRASENA), Validators.maxLength(LONGITUD_MAXIMA_CONTRASENA)]],
      confirmarContrasena: ['', Validators.required],
    },
    { validators: contrasenasIguales },
  );

  protected readonly formAdmin = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      usuario: ['', [Validators.required, Validators.pattern(PATRON_USUARIO)]],
      email: ['', [Validators.email, Validators.maxLength(150)]],
      telefono: ['', Validators.maxLength(20)],
      estado: ['ACTIVO' as EstadoRegistro, Validators.required],
      contrasena: [''],
      confirmarContrasena: [''],
    },
    { validators: contrasenasIguales },
  );

  constructor() {
    effect(() => {
      const id = this.empresaId();
      untracked(() => void this.cargar(id));
    });
  }

  protected async cargar(id = this.empresaId()): Promise<void> {
    this.cargando.set(true);
    try {
      this.lista.set(await firstValueFrom(this.repositorio.administradores(id)));
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrirContrasena(admin: AdministradorEmpresa): void {
    this.formContrasena.reset();
    this.verContrasena.set(false);
    this.panel.set({ tipo: 'contrasena', admin });
  }

  protected generar(): void {
    const clave = generarContrasena();
    this.formContrasena.setValue({ contrasena: clave, confirmarContrasena: clave });
    this.verContrasena.set(true);
  }

  protected abrirAdmin(admin?: AdministradorEmpresa): void {
    this.formAdmin.reset(admin ? { ...admin, contrasena: '', confirmarContrasena: '' } : undefined);
    ajustarContrasena(this.formAdmin, !admin);
    this.panel.set(admin ? { tipo: 'editar', admin } : { tipo: 'crear' });
  }

  protected cerrarPanel(): void {
    this.panel.set(null);
  }

  protected errorDe(form: 'contrasena' | 'admin', campo: string): string | null {
    const control = form === 'contrasena' ? this.formContrasena.get(campo) : this.formAdmin.get(campo);
    if (!control) return null;
    if (control.touched && control.hasError('noCoincide')) return 'Las contraseñas no coinciden.';
    return mensajeError(control);
  }

  protected async guardarContrasena(): Promise<void> {
    const p = this.panel();
    if (p?.tipo !== 'contrasena') return;
    if (this.formContrasena.invalid) {
      this.formContrasena.markAllAsTouched();
      return;
    }
    await this.ejecutar(async () => {
      await firstValueFrom(this.repositorio.cambiarContrasenaAdministrador(this.empresaId(), p.admin.id, this.formContrasena.getRawValue().contrasena));
      this.avisos.exito(`Contraseña de ${p.admin.nombre} actualizada. Se cerraron sus sesiones abiertas.`);
    });
  }

  protected async guardarAdmin(): Promise<void> {
    const p = this.panel();
    if (p?.tipo !== 'crear' && p?.tipo !== 'editar') return;
    if (this.formAdmin.invalid) {
      this.formAdmin.markAllAsTouched();
      return;
    }
    const { confirmarContrasena: _, ...v } = this.formAdmin.getRawValue();
    const solicitud = { ...v, nombre: v.nombre.trim(), usuario: v.usuario.trim(), email: v.email.trim(), telefono: v.telefono.trim() };
    await this.ejecutar(async () => {
      if (p.tipo === 'crear') {
        await firstValueFrom(this.repositorio.crearAdministrador(this.empresaId(), solicitud));
        this.avisos.exito('Administrador creado.');
      } else {
        await firstValueFrom(this.repositorio.actualizarAdministrador(this.empresaId(), p.admin.id, solicitud));
        this.avisos.exito('Administrador actualizado.');
      }
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    try {
      await accion();
      this.panel.set(null);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected ultimoIngreso(a: AdministradorEmpresa): string {
    return a.ultimoLogin
      ? `Último ingreso: ${new Date(a.ultimoLogin).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`
      : 'Aún no ha ingresado';
  }
}
