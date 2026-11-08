import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Empresa } from 'src/app/inicio/configuracion/configuracion';
import { LONGITUD_MINIMA_CONTRASENA, PATRON_USUARIO } from 'src/app/personas/compartido/acceso';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario, mensajeDeError } from 'src/app/shared/crud/crud';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { emitirEnVivo, mensajeError, nit } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { FILTROS_EMPRESA_VACIOS, FiltrosEmpresa, SolicitudEmpresa } from './empresa';
import { EmpresasRepositorio } from './empresas-repositorio';
import { EmpresasStore } from './empresas-store';
import { AdministradoresEmpresa } from './administradores-empresa/administradores-empresa';
import { SuscripcionEmpresa } from './suscripcion-empresa/suscripcion-empresa';

/**
 * Plataforma › Empresas (SUPER_ADMIN): alta de empresas de transporte con su primer administrador
 * opcional, edición e inactivación (no se eliminan). Cada empresa ve solo sus datos. En el detalle, sus
 * administradores (`<app-administradores-empresa>`): restablecer la contraseña, editar, inactivar o agregar.
 */
@Component({
  selector: 'app-empresas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelFiltros,
    ReactiveFormsModule,
    SelectorBusqueda,
    EncabezadoListado,
    Paginacion,
    Modal,
    EstadoVacio,
    BadgeEstado,
    Campo,
    TituloSeccion,
    AccionesFormulario,
    AdministradoresEmpresa,
    SuscripcionEmpresa,
  ],
  providers: [EmpresasStore],
  templateUrl: './empresas-page.html',
})
export default class EmpresasPage implements OnInit {
  protected readonly store = inject(EmpresasStore);
  private readonly repositorio = inject(EmpresasRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly estados = ESTADOS_REGISTRO;

  protected readonly filtros = this.fb.group({
    texto: FILTROS_EMPRESA_VACIOS.texto,
    estado: FILTROS_EMPRESA_VACIOS.estado as EstadoRegistro | '',
  });

  protected readonly modalAbierto = signal(false);
  protected readonly modo = signal<ModoFormulario>('crear');
  protected readonly seleccionada = signal<Empresa | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    nit: ['', [Validators.required, nit]],
    direccion: ['', Validators.maxLength(200)],
    ciudad: ['', Validators.maxLength(100)],
    telefono: ['', Validators.maxLength(20)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    logoUrl: ['', Validators.maxLength(500)],
    estado: ['ACTIVO' as EstadoRegistro, Validators.required],
    conAdministrador: [true],
    administrador: this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      usuario: ['', [Validators.required, Validators.pattern(PATRON_USUARIO)]],
      email: ['', [Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(LONGITUD_MINIMA_CONTRASENA)]],
    }),
  });

  constructor() {
    emitirEnVivo<FiltrosEmpresa>(this.filtros, { emit: (f) => this.store.buscar(f) });
    this.form.controls.conAdministrador.valueChanges.pipe(takeUntilDestroyed()).subscribe((con) => this.ajustarAdministrador(con));
  }

  ngOnInit(): void {
    this.store.recargar();
  }

  private ajustarAdministrador(con: boolean): void {
    const admin = this.form.controls.administrador;
    if (con && this.modo() === 'crear') admin.enable({ emitEvent: false });
    else admin.disable({ emitEvent: false });
  }

  protected nueva(): void {
    this.seleccionada.set(null);
    this.modo.set('crear');
    this.form.reset();
    this.form.enable();
    this.ajustarAdministrador(true);
    this.modalAbierto.set(true);
  }

  protected abrir(e: Empresa, modo: 'consultar' | 'editar' = 'consultar'): void {
    this.seleccionada.set(e);
    this.modo.set(modo);
    this.form.reset({ ...e, conAdministrador: false });
    if (modo === 'consultar') this.form.disable();
    else this.form.enable();
    this.ajustarAdministrador(false);
    this.form.controls.conAdministrador.disable({ emitEvent: false });
    this.modalAbierto.set(true);
  }

  protected editar(): void {
    const e = this.seleccionada();
    if (e) this.abrir(e, 'editar');
  }

  protected error(campo: string): string | null {
    const control = this.form.get(campo);
    return control ? mensajeError(control) : null;
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const solicitud: SolicitudEmpresa = {
      nombre: v.nombre.trim(),
      nit: v.nit.trim(),
      direccion: v.direccion,
      ciudad: v.ciudad,
      telefono: v.telefono,
      email: v.email,
      logoUrl: v.logoUrl,
      estado: v.estado,
      administrador: this.modo() === 'crear' && v.conAdministrador ? v.administrador : null,
    };
    this.guardando.set(true);
    try {
      const e = this.seleccionada();
      if (this.modo() === 'crear') await firstValueFrom(this.repositorio.crear(solicitud));
      else if (e) await firstValueFrom(this.repositorio.actualizar(e.id, solicitud));
      this.avisos.exito(this.modo() === 'crear' ? 'Empresa registrada.' : 'Empresa actualizada.');
      this.modalAbierto.set(false);
      this.store.recargar();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  protected titulo(): string {
    return this.modo() === 'crear' ? 'Nueva empresa' : this.modo() === 'editar' ? 'Editar empresa' : 'Detalle de la empresa';
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'medium' });
  }
}
