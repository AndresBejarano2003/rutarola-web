import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { DatosEmpresa, Empresa, NOMBRES_PARAMETRO, Parametro, esInterruptor } from './configuracion';
import { ConfiguracionRepositorio } from './configuracion-repositorio';

type CampoEmpresa = keyof DatosEmpresa;

/**
 * Configuración de la empresa (administrador): datos de contacto (el NIT y el estado los cambia la
 * plataforma) y parámetros del sistema (día límite de pago, días de alerta de vencimiento y si los acudientes
 * ven la ubicación en vivo de la ruta, como interruptor Sí/No).
 * Un solo botón guarda todo; solo se envían los parámetros que cambiaron.
 */
@Component({
  selector: 'app-configuracion-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Campo, TituloSeccion],
  templateUrl: './configuracion-page.html',
})
export default class ConfiguracionPage implements OnInit {
  private readonly repositorio = inject(ConfiguracionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly cambios = inject(CambiosDatos);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly nombres = NOMBRES_PARAMETRO;
  protected readonly esInterruptor = esInterruptor;

  protected readonly empresa = signal<Empresa | null>(null);
  protected readonly parametros = signal<Parametro[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    direccion: ['', Validators.maxLength(200)],
    ciudad: ['', Validators.maxLength(100)],
    telefono: ['', Validators.maxLength(20)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    logoUrl: ['', Validators.maxLength(500)],
  });
  /** Un control por parámetro (clave → valor numérico). */
  protected readonly valores = this.fb.record<number>({});
  protected readonly todo = this.fb.group({ empresa: this.form, parametros: this.valores });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const { empresa, parametros } = await firstValueFrom(
        forkJoin({ empresa: this.repositorio.empresa(), parametros: this.repositorio.parametros() }),
      );
      this.aplicar(empresa, parametros);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private aplicar(empresa: Empresa, parametros: Parametro[]): void {
    this.empresa.set(empresa);
    this.parametros.set(parametros);
    this.form.reset({
      nombre: empresa.nombre,
      direccion: empresa.direccion,
      ciudad: empresa.ciudad,
      telefono: empresa.telefono,
      email: empresa.email,
      logoUrl: empresa.logoUrl,
    });
    for (const clave of Object.keys(this.valores.controls)) this.valores.removeControl(clave);
    for (const p of parametros) {
      this.valores.addControl(
        p.clave,
        new FormControl(Number(p.valor), {
          nonNullable: true,
          validators: [Validators.required, Validators.min(p.minimo), Validators.max(p.maximo), Validators.pattern(/^\d+$/)],
        }),
      );
    }
  }

  protected alternar(clave: string, evento: Event): void {
    const control = this.valores.controls[clave];
    control?.setValue((evento.target as HTMLInputElement).checked ? 1 : 0);
    control?.markAsDirty();
  }

  protected errorCampo(campo: CampoEmpresa): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected errorParametro(clave: string): string | null {
    const control = this.valores.controls[clave];
    return control ? mensajeError(control) : null;
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid || this.valores.invalid) {
      this.form.markAllAsTouched();
      this.valores.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      const datos = this.form.getRawValue();
      const empresa = this.form.dirty ? await firstValueFrom(this.repositorio.guardarEmpresa(datos)) : this.empresa()!;
      const parametros: Parametro[] = [];
      for (const p of this.parametros()) {
        const valor = String(this.valores.controls[p.clave]?.value ?? p.valor);
        parametros.push(valor === p.valor ? p : await firstValueFrom(this.repositorio.guardarParametro(p.clave, valor)));
      }
      this.aplicar(empresa, parametros);
      this.cambios.notificar();
      this.avisos.exito('Configuración guardada.');
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
