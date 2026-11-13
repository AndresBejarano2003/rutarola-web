import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, map, of } from 'rxjs';
import { AuthService, RolUsuario, nombreRol, rutaInicio } from 'src/app/core/auth';
import { rutaInternaSegura } from 'src/app/core/guardias';
import { FILTROS_ASIGNACION_VACIOS } from 'src/app/operacion/asignaciones/asignacion';
import { AsignacionesRepositorio } from 'src/app/operacion/asignaciones/asignaciones-repositorio';
import { FILTROS_FACTURA_VACIOS } from 'src/app/finanzas/facturas/factura';
import { FacturasRepositorio } from 'src/app/finanzas/facturas/facturas-repositorio';
import { FILTROS_ACUDIENTE_VACIOS } from 'src/app/personas/acudientes/acudiente';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { SIN_PAGINAR, esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { AutenticacionRepositorio } from '../autenticacion-repositorio';
import { ADMIN_LOCAL, CONTRASENA_DEMO } from '../credenciales-local';
import { Presentacion } from './presentacion/presentacion';

interface AccesoDemo {
  rol: RolUsuario;
  nombre: string;
  usuario: string;
  contrasena: string;
  icono: string;
}

const CARACTERISTICAS = [
  { icono: 'fa-users text-info', titulo: 'Gestión completa', texto: 'Estudiantes, acudientes, empleados y toda tu operación.' },
  { icono: 'fa-route text-success', titulo: 'Rutas eficientes', texto: 'Organiza rutas y asigna vehículos y conductores.' },
  { icono: 'fa-file-invoice-dollar text-primary', titulo: 'Facturación inteligente', texto: 'Facturas, recibos y reportes financieros en segundos.' },
  { icono: 'fa-bus text-warning', titulo: 'Ruta del día', texto: 'El conductor ve a quién recoger y entregar, paso a paso.' },
];

/**
 * Inicio de sesión. El ROL de la sesión decide el sistema: administrador → `/inicio`,
 * conductor/monitora → `/ruta-del-dia` (o la URL protegida que pidió, si es de su rol).
 */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Presentacion, ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export default class LoginPage {
  private readonly repositorio = inject(AutenticacionRepositorio);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly asignaciones = inject(AsignacionesRepositorio);
  private readonly acudientes = inject(AcudientesRepositorio);
  private readonly facturas = inject(FacturasRepositorio);

  protected readonly caracteristicas = CARACTERISTICAS;
  protected readonly anioActual = new Date().getFullYear();
  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  /** Animación de RutaRola antes de mostrar el login (cada vez que se abre). */
  protected readonly presentando = signal(true);
  protected readonly mostrarContrasena = signal(false);
  private readonly campoContrasena = viewChild<ElementRef<HTMLInputElement>>('campoContrasena');
  protected readonly ingresando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    usuario: ['', Validators.required],
    contrasena: ['', Validators.required],
    recordar: [false],
  });

  /** Modo local: un usuario de cada tipo, tomado de los datos actuales (empleados con ruta, acudiente con facturas). */
  protected readonly accesosDemo = toSignal(
    this.modoLocal
      ? forkJoin([
          this.empleados.listar({ ...FILTROS_EMPLEADO_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
          this.asignaciones.listar({ ...FILTROS_ASIGNACION_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
          this.acudientes.listar({ ...FILTROS_ACUDIENTE_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
          this.facturas.listar({ ...FILTROS_FACTURA_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
        ]).pipe(
          map(([empleados, asignaciones, acudientes, facturas]) => {
            const conRuta = new Set(asignaciones.items.flatMap((a) => [a.conductorId, a.monitoraId]));
            const conUsuario = empleados.items.filter((e) => e.usuario);
            const elegir = (tipo: RolUsuario) =>
              conUsuario.find((e) => e.tipoEmpleado === tipo && conRuta.has(e.id)) ?? conUsuario.find((e) => e.tipoEmpleado === tipo);
            const accesos: AccesoDemo[] = [
              { rol: 'ADMINISTRADOR', nombre: 'Administrador', ...ADMIN_LOCAL, icono: 'fa-solid fa-user-tie' },
            ];
            for (const [rol, icono] of [['CONDUCTOR', 'fa-solid fa-bus'], ['MONITORA', 'fa-solid fa-person-chalkboard']] as const) {
              const e = elegir(rol);
              // Contraseña de los datos de ejemplo: si el administrador la cambió, el acceso falla como cualquier login.
              if (e) accesos.push({ rol, nombre: nombreCompleto(e), usuario: e.usuario, contrasena: CONTRASENA_DEMO, icono });
            }
            const facturasDe = (id: string) => facturas.items.filter((f) => f.acudienteId === id).length;
            const acudiente = acudientes.items.filter((a) => a.usuario).sort((a, b) => facturasDe(b.id) - facturasDe(a.id))[0];
            if (acudiente) {
              accesos.push({ rol: 'ACUDIENTE', nombre: nombreCompleto(acudiente), usuario: acudiente.usuario, contrasena: CONTRASENA_DEMO, icono: 'fa-solid fa-people-roof' });
            }
            return accesos;
          }),
        )
      : of<AccesoDemo[]>([]),
    { initialValue: [] },
  );

  protected readonly nombreRol = nombreRol;
  protected readonly contrasenaDemo = CONTRASENA_DEMO;

  protected async iniciarSesion(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Ingresa tu usuario y tu contraseña.');
      return;
    }
    const { usuario, contrasena, recordar } = this.form.getRawValue();
    this.ingresando.set(true);
    this.error.set(null);
    try {
      const sesion = await firstValueFrom(this.repositorio.iniciarSesion({ usuario, contrasena }));
      this.auth.abrirSesion(sesion, recordar);
      // Si pidió una URL protegida vuelve a ella; el guard la cambia por su inicio si es de otro rol.
      const volver = rutaInternaSegura(this.ruta.snapshot.queryParamMap.get('volver'));
      await this.router.navigateByUrl(volver ?? rutaInicio(sesion.rol));
    } catch (error) {
      this.error.set(mensajeDeError(error));
      // Se vacía la contraseña: si el navegador la había autocompletado (oculta tras los puntos),
      // lo que se escriba después no se suma a ese texto.
      this.form.controls.contrasena.reset('');
      this.campoContrasena()?.nativeElement.focus();
    } finally {
      this.ingresando.set(false);
    }
  }

  protected entrarComo(acceso: AccesoDemo): void {
    this.form.patchValue({ usuario: acceso.usuario, contrasena: acceso.contrasena });
    void this.iniciarSesion();
  }

  protected alternarContrasena(): void {
    this.mostrarContrasena.update((visible) => !visible);
  }
}
