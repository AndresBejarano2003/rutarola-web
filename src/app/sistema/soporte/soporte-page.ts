import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ArchivoAdjunto, ArchivosAdjuntosCampo } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import {
  MANUALES,
  Manual,
  PREGUNTAS_FRECUENTES,
  TUTORIALES,
  Tutorial,
  coincideBusqueda,
  modulosDelMenu,
} from './contenido-ayuda';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { MisSolicitudes } from './mis-solicitudes/mis-solicitudes';
import { PRIORIDADES_SOLICITUD, PrioridadSolicitud, TIPOS_SOLICITUD, TipoSolicitud } from './solicitudes-soporte';
import { TicketsRepositorio } from './tickets/tickets-repositorio';

const WHATSAPP_SOPORTE = '573202871272';
const CORREO_SOPORTE = 'soporte@rutarola.com';
const ASUNTO_MAXIMO = 120;
const DESCRIPCION_MAXIMA = 2000;

type Seccion = 'tutoriales' | 'documentacion' | 'preguntas' | 'solicitud';

@Component({
  selector: 'app-soporte-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Campo, TituloSeccion, SelectorBusqueda, ArchivosAdjuntosCampo, MisSolicitudes],
  templateUrl: './soporte-page.html',
})
export default class SoportePage {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly tickets = inject(TicketsRepositorio);
  private readonly misSolicitudes = viewChild.required(MisSolicitudes);
  protected readonly enviando = signal(false);

  protected readonly correoSoporte = CORREO_SOPORTE;
  protected readonly asuntoMaximo = ASUNTO_MAXIMO;
  protected readonly descripcionMaxima = DESCRIPCION_MAXIMA;

  // Búsqueda en todo el contenido de ayuda
  protected readonly busqueda = signal('');
  protected readonly tutoriales = computed(() =>
    TUTORIALES.filter((t) => coincideBusqueda(this.busqueda(), t.titulo, t.descripcion, t.modulo)),
  );
  protected readonly manuales = computed(() =>
    MANUALES.filter((m) => coincideBusqueda(this.busqueda(), m.nombre, m.descripcion)),
  );
  protected readonly preguntas = computed(() =>
    PREGUNTAS_FRECUENTES.filter((p) => coincideBusqueda(this.busqueda(), p.pregunta, p.respuesta, p.modulo)),
  );
  protected readonly sinResultados = computed(
    () => !this.tutoriales().length && !this.manuales().length && !this.preguntas().length,
  );

  // Visor de tutoriales
  protected readonly tutorialAbierto = signal(false);
  protected readonly tutorial = signal<Tutorial | null>(null);
  protected readonly urlVideo = computed<SafeResourceUrl | null>(() => {
    const t = this.tutorial();
    // videoId viene de las constantes de `contenido-ayuda.ts`, no del usuario.
    return t
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube-nocookie.com/embed/${t.videoId}?autoplay=1&rel=0`,
        )
      : null;
  });

  // Visor de manuales
  protected readonly manualAbierto = signal(false);
  protected readonly manual = signal<Manual | null>(null);
  protected readonly urlManual = computed<SafeResourceUrl | null>(() => {
    const m = this.manual();
    return m ? this.sanitizer.bypassSecurityTrustResourceUrl(m.archivo) : null;
  });

  // Solicitud de soporte
  protected readonly tiposSolicitud = TIPOS_SOLICITUD;
  protected readonly prioridades = PRIORIDADES_SOLICITUD;
  protected readonly modulos = modulosDelMenu();

  protected readonly form = this.fb.group({
    tipo: this.fb.control<TipoSolicitud | ''>('', Validators.required),
    modulo: ['', Validators.required],
    prioridad: this.fb.control<PrioridadSolicitud>('MEDIA'),
    asunto: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(ASUNTO_MAXIMO)]],
    descripcion: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(DESCRIPCION_MAXIMA)]],
    adjuntos: this.fb.control<ArchivoAdjunto[]>([]),
  });

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  constructor() {
    // `?tipo=&modulo=&asunto=&descripcion=` precargan la solicitud (p. ej. "Solicitar por Soporte" en Planes).
    const q = inject(ActivatedRoute, { optional: true })?.snapshot.queryParamMap;
    const asunto = q?.get('asunto');
    if (q && asunto) {
      const tipo = TIPOS_SOLICITUD.find((t) => t.id === q.get('tipo'))?.id ?? '';
      const modulo = this.modulos.find((m) => m.id === q.get('modulo'))?.id ?? '';
      this.form.patchValue({ tipo, modulo, asunto: asunto.slice(0, ASUNTO_MAXIMO), descripcion: (q.get('descripcion') ?? '').slice(0, DESCRIPCION_MAXIMA) });
      afterNextRender(() => this.irA('solicitud'));
    }
  }
  protected readonly guiaDescripcion = computed(
    () =>
      TIPOS_SOLICITUD.find((t) => t.id === this.valores().tipo)?.guia ??
      'Describe con detalle tu solicitud para poder ayudarte más rápido.',
  );
  protected readonly largoAsunto = computed(() => this.valores().asunto?.length ?? 0);
  protected readonly largoDescripcion = computed(() => this.valores().descripcion?.length ?? 0);

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected irA(seccion: Seccion): void {
    // Con `withHashLocation` un `href="#…"` cambiaría de ruta: se desplaza por código.
    document.getElementById(`soporte-${seccion}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected abrirTutorial(tutorial: Tutorial): void {
    this.tutorial.set(tutorial);
    this.tutorialAbierto.set(true);
  }

  protected abrirManual(manual: Manual): void {
    this.manual.set(manual);
    this.manualAbierto.set(true);
  }

  protected async enviarSolicitud(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notificaciones.error('Revisa los campos marcados antes de enviar.');
      return;
    }
    const { tipo, modulo, prioridad, asunto, descripcion, adjuntos } = this.form.getRawValue();
    if (!tipo) return;
    this.enviando.set(true);
    try {
      const ticket = await firstValueFrom(
        this.tickets.crear({ tipo, modulo, prioridad, asunto: asunto.trim(), descripcion: descripcion.trim(), adjuntos }),
      );
      this.notificaciones.exito(`Solicitud ${ticket.numero} enviada. Te avisaremos en la campana en cada avance.`);
      this.limpiar();
      await this.misSolicitudes().cargar();
    } catch (e) {
      this.notificaciones.error(`No se pudo enviar la solicitud: ${mensajeDeError(e)} Intenta de nuevo o escríbenos por WhatsApp.`);
    } finally {
      this.enviando.set(false);
    }
  }

  protected limpiar(): void {
    this.form.reset();
  }

  /** Abre WhatsApp con un mensaje que incluye lo que ya se escribió en el formulario. */
  protected abrirWhatsApp(): void {
    const { tipo, modulo, asunto, descripcion } = this.form.getRawValue();
    const lineas = [
      'Hola equipo RutaRola, necesito ayuda con el sistema.',
      '',
      `Tipo: ${TIPOS_SOLICITUD.find((t) => t.id === tipo)?.nombre ?? ''}`,
      `Módulo: ${modulo}`,
      `Asunto: ${asunto.trim()}`,
      `Descripción: ${descripcion.trim()}`,
    ];
    window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank', 'noopener');
  }
}
