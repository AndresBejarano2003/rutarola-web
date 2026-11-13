import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import {
  COLOR_DOCUMENTOS_POR_DEFECTO,
  DatosFormatoDocumentos,
  FORMATO_VACIO,
  FormatoDocumentos,
  TipoDocumentoPdf,
  contenidoDeEjemplo,
  htmlDocumento,
  imprimirHtml,
} from 'src/app/shared/documentos-pdf/documentos-pdf';
import { GeneradorPdf } from 'src/app/shared/documentos-pdf/generador-pdf';
import { reducirLogo } from 'src/app/shared/documentos-pdf/logo';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { ConfiguracionRepositorio } from '../configuracion-repositorio';

/**
 * Configuración › Documentos PDF: logo, nombre comercial, eslogan, NIT, contacto, color, pie de página y una nota por
 * tipo de documento. La vista previa muestra una factura, un recibo o una cotización de ejemplo con el formato.
 */
@Component({
  selector: 'app-formato-documentos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Campo, TituloSeccion],
  template: `
    @if (cargando()) {
      <div class="skeleton bg-base-300 h-64 w-full"></div>
    } @else if (error()) {
      <div role="alert" class="alert alert-error alert-soft">
        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>{{ error() }}</span>
        <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="cargar()">Reintentar</button>
      </div>
    } @else {
      <div class="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <form class="grid grid-cols-1 md:grid-cols-2 gap-4 content-start" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
          @if (!personalizado()) {
            <p class="md:col-span-2 text-sm text-base-content/70">
              <i class="fa-solid fa-circle-info text-info" aria-hidden="true"></i>
              Aún no has personalizado tus documentos: tomamos los datos de contacto de tu empresa. Ajusta lo que quieras y guarda.
            </p>
          }
          <app-titulo-seccion>Encabezado</app-titulo-seccion>
          <div class="md:col-span-2 flex flex-wrap items-center gap-4">
            <div class="w-40 h-20 rounded-box border border-base-300 bg-white grid place-items-center overflow-hidden shrink-0">
              @if (form.controls.logo.value) {
                <img [src]="form.controls.logo.value" alt="Logo de la empresa" class="max-w-full max-h-full object-contain" />
              } @else {
                <span class="text-xs text-[#4b5563]">Sin logo</span>
              }
            </div>
            <div class="flex flex-col gap-2 min-w-0">
              <span class="label-text text-base-content/90">Logo</span>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" [disabled]="procesandoLogo()" (click)="archivo.click()">
                  @if (procesandoLogo()) { <span class="loading loading-spinner loading-xs" aria-hidden="true"></span> } @else { <i class="fa-solid fa-image" aria-hidden="true"></i> }
                  {{ form.controls.logo.value ? 'Cambiar logo' : 'Subir logo' }}
                </button>
                @if (form.controls.logo.value) {
                  <button type="button" class="btn btn-sm btn-ghost text-error" (click)="quitarLogo()">
                    <i class="fa-solid fa-trash-can" aria-hidden="true"></i> Quitar
                  </button>
                }
              </div>
              <span class="text-xs text-base-content/70">PNG, JPG, WebP o SVG. Se ajusta a 600 × 240 px.</span>
              @if (errorLogo()) { <span class="text-xs text-error" role="alert">{{ errorLogo() }}</span> }
              <input #archivo type="file" class="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="elegirLogo($event)" aria-label="Logo" />
            </div>
          </div>
          <label app-campo etiqueta="Nombre en los documentos" requerido [error]="err('nombreComercial')">
            <input formControlName="nombreComercial" class="input input-bordered bg-base-100 border-neutral w-full" [class.input-error]="!!err('nombreComercial')" />
          </label>
          <label app-campo etiqueta="Eslogan" [error]="err('eslogan')">
            <input formControlName="eslogan" class="input input-bordered bg-base-100 border-neutral w-full" placeholder="Ej. Llevamos lo que más quieres" />
          </label>
          <label app-campo etiqueta="NIT" [error]="err('nit')">
            <input formControlName="nit" class="input input-bordered bg-base-100 border-neutral w-full font-mono" />
          </label>
          <label app-campo etiqueta="Color principal" [error]="err('colorPrincipal')">
            <div class="flex items-center gap-2">
              <input type="color" formControlName="colorPrincipal" class="h-10 w-14 rounded border border-neutral bg-base-100 cursor-pointer" aria-label="Color principal" />
              <input formControlName="colorPrincipal" class="input input-bordered bg-base-100 border-neutral w-full font-mono uppercase" maxlength="7" />
            </div>
          </label>

          <app-titulo-seccion>Contacto</app-titulo-seccion>
          <label app-campo etiqueta="Dirección" [error]="err('direccion')">
            <input formControlName="direccion" class="input input-bordered bg-base-100 border-neutral w-full" />
          </label>
          <label app-campo etiqueta="Ciudad" [error]="err('ciudad')">
            <input formControlName="ciudad" class="input input-bordered bg-base-100 border-neutral w-full" />
          </label>
          <label app-campo etiqueta="Teléfono" [error]="err('telefono')">
            <input formControlName="telefono" class="input input-bordered bg-base-100 border-neutral w-full" />
          </label>
          <label app-campo etiqueta="Correo" [error]="err('correo')">
            <input formControlName="correo" type="email" class="input input-bordered bg-base-100 border-neutral w-full" [class.input-error]="!!err('correo')" />
          </label>
          <label app-campo class="md:col-span-2" etiqueta="Sitio web o redes" [error]="err('sitioWeb')">
            <input formControlName="sitioWeb" class="input input-bordered bg-base-100 border-neutral w-full" placeholder="www.miempresa.com · @miempresa" />
          </label>

          <app-titulo-seccion>Notas y pie de página</app-titulo-seccion>
          <label app-campo class="md:col-span-2" etiqueta="Nota en las facturas" [error]="err('notaFactura')" ayuda="Ej. cuenta para consignar, condiciones de pago.">
            <textarea formControlName="notaFactura" rows="2" class="textarea textarea-bordered bg-base-100 border-neutral w-full"></textarea>
          </label>
          <label app-campo class="md:col-span-2" etiqueta="Nota en los recibos" [error]="err('notaRecibo')">
            <textarea formControlName="notaRecibo" rows="2" class="textarea textarea-bordered bg-base-100 border-neutral w-full"></textarea>
          </label>
          <label app-campo class="md:col-span-2" etiqueta="Nota en las cotizaciones" [error]="err('notaCotizacion')" ayuda="Ej. vigencia de la cotización.">
            <textarea formControlName="notaCotizacion" rows="2" class="textarea textarea-bordered bg-base-100 border-neutral w-full"></textarea>
          </label>
          <label app-campo class="md:col-span-2" etiqueta="Pie de página" [error]="err('piePagina')">
            <textarea formControlName="piePagina" rows="2" class="textarea textarea-bordered bg-base-100 border-neutral w-full"
              placeholder="Ej. Gracias por confiar en nosotros. Resolución de habilitación No. …"></textarea>
          </label>

          <div class="md:col-span-2 flex flex-wrap justify-end gap-2">
            <button type="submit" class="btn btn-primary" [disabled]="guardando()">
              @if (guardando()) { <span class="loading loading-spinner loading-sm" aria-hidden="true"></span> } @else { <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> }
              Guardar formato
            </button>
          </div>
        </form>

        <section class="flex flex-col gap-3 min-w-0" aria-label="Vista previa">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Documento de ejemplo" class="join">
              @for (t of tipos; track t.id) {
                <button type="button" role="tab" class="btn btn-sm join-item" [attr.aria-selected]="vista() === t.id"
                  [class.btn-secondary]="vista() === t.id" [class.bg-base-300]="vista() !== t.id" (click)="vista.set(t.id)">{{ t.nombre }}</button>
              }
            </div>
            <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral" (click)="probar()">
              <i class="fa-solid fa-file-pdf text-error" aria-hidden="true"></i> Probar PDF
            </button>
          </div>
          <iframe class="w-full h-[36rem] rounded-box border border-base-300 bg-white" [attr.srcdoc]="vistaPrevia()" title="Vista previa del documento"
            sandbox=""></iframe>
        </section>
      </div>
    }
  `,
})
export class FormatoDocumentosConfig implements OnInit {
  private readonly repositorio = inject(ConfiguracionRepositorio);
  private readonly generador = inject(GeneradorPdf);
  private readonly avisos = inject(NotificacionesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tipos: { id: TipoDocumentoPdf; nombre: string }[] = [
    { id: 'FACTURA', nombre: 'Factura' },
    { id: 'RECIBO', nombre: 'Recibo' },
    { id: 'COTIZACION', nombre: 'Cotización' },
  ];
  protected readonly vista = signal<TipoDocumentoPdf>('FACTURA');
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly procesandoLogo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorLogo = signal<string | null>(null);
  protected readonly personalizado = signal(false);

  protected readonly form = this.fb.group({
    logo: [''],
    nombreComercial: ['', [Validators.required, Validators.maxLength(150)]],
    eslogan: ['', Validators.maxLength(150)],
    nit: ['', Validators.maxLength(30)],
    direccion: ['', Validators.maxLength(200)],
    ciudad: ['', Validators.maxLength(100)],
    telefono: ['', Validators.maxLength(60)],
    correo: ['', [Validators.email, Validators.maxLength(150)]],
    sitioWeb: ['', Validators.maxLength(150)],
    colorPrincipal: [COLOR_DOCUMENTOS_POR_DEFECTO, [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    piePagina: ['', Validators.maxLength(500)],
    notaFactura: ['', Validators.maxLength(500)],
    notaRecibo: ['', Validators.maxLength(500)],
    notaCotizacion: ['', Validators.maxLength(500)],
  });

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** HTML del ejemplo con lo que se está escribiendo (iframe aislado con `sandbox`). */
  protected readonly vistaPrevia = computed(() => {
    const formato: FormatoDocumentos = { ...FORMATO_VACIO, ...this.form.getRawValue(), ...this.valores() };
    return this.sanitizer.bypassSecurityTrustHtml(htmlDocumento(formato, contenidoDeEjemplo(this.vista())));
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const f = await firstValueFrom(this.repositorio.formatoDocumentos());
      this.aplicar(f);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private aplicar(f: FormatoDocumentos): void {
    const { personalizado, ...datos } = f;
    this.personalizado.set(!!personalizado);
    this.form.reset({ ...datos, colorPrincipal: datos.colorPrincipal || COLOR_DOCUMENTOS_POR_DEFECTO });
  }

  protected err(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected async elegirLogo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.procesandoLogo.set(true);
    this.errorLogo.set(null);
    try {
      this.form.controls.logo.setValue(await reducirLogo(archivo));
      this.form.markAsDirty();
    } catch (e) {
      this.errorLogo.set((e as Error).message);
    } finally {
      this.procesandoLogo.set(false);
    }
  }

  protected quitarLogo(): void {
    this.form.controls.logo.setValue('');
    this.form.markAsDirty();
  }

  protected probar(): void {
    imprimirHtml(htmlDocumento({ ...FORMATO_VACIO, ...this.form.getRawValue() }, contenidoDeEjemplo(this.vista())));
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      const v = this.form.getRawValue();
      const datos: DatosFormatoDocumentos = { ...v, colorPrincipal: v.colorPrincipal.toUpperCase() };
      const guardado = await firstValueFrom(this.repositorio.guardarFormatoDocumentos(datos));
      this.aplicar(guardado);
      this.generador.establecer(guardado);
      this.avisos.exito('Formato de documentos guardado. Tus próximos PDF ya lo usan.');
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
