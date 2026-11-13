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
import { DIAS_PRUEBA_POR_DEFECTO, PLANES, PeriodoPago } from 'src/app/sistema/membresias/suscripcion';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AutenticacionRepositorio } from '../autenticacion-repositorio';

/**
 * Registro público de una empresa de transporte (`/registro`): datos de la empresa y de su administrador.
 * El servidor crea la empresa con los días de prueba del plan Profesional que fije la plataforma (`GET /suscripcion/condiciones`)
 * y deja la sesión iniciada. Con "Pagar ahora" no hay prueba: la empresa empieza en Gratis y se abre el pago del plan elegido.
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
  private readonly suscripciones = inject(SuscripcionRepositorio);
  protected readonly diasPrueba = signal(DIAS_PRUEBA_POR_DEFECTO);
  protected readonly planesPago = PLANES.filter((p) => p.precioMensual > 0);
  /** `PRUEBA` = días gratis del plan Profesional; `PAGAR` = paga de una vez el plan elegido. */
  protected readonly comienzo = signal<'PRUEBA' | 'PAGAR'>('PRUEBA');
  protected readonly planElegido = signal('PROFESIONAL');
  protected readonly periodo = signal<PeriodoPago>('MENSUAL');
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

  constructor() {
    this.suscripciones
      .condiciones()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (c) => this.diasPrueba.set(c.diasPrueba), error: () => undefined });
    // Desde Planes y precios (`/registro?plan=ESENCIAL&periodo=ANUAL`): llega con "Pagar ahora" y ese plan.
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const plan = q.get('plan');
    if (plan && this.planesPago.some((p) => p.id === plan)) {
      this.comienzo.set('PAGAR');
      this.planElegido.set(plan);
    }
    if (q.get('periodo') === 'ANUAL') this.periodo.set('ANUAL');
  }

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
          pagarAhora: this.comienzo() === 'PAGAR',
        }),
      );
      this.auth.abrirSesion(sesion, true);
      if (this.comienzo() === 'PAGAR') {
        await this.router.navigate(['/sistema/membership'], { queryParams: { plan: this.planElegido(), periodo: this.periodo() } });
      } else {
        await this.router.navigateByUrl(rutaInicio(sesion.rol));
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
