import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { ArchivoAdjunto, ArchivosAdjuntosCampo } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { DetalleTicket } from '../tickets/detalle-ticket/detalle-ticket';
import {
  ESTADOS_TICKET,
  FILTROS_TICKET_VACIOS,
  MAXIMO_ADJUNTOS_TICKET,
  TAMANO_MAXIMO_ADJUNTO_MB,
  Ticket,
  TicketResumen,
  nombreEstado,
  nombreTipo,
} from '../tickets/tickets';
import { TicketsRepositorio } from '../tickets/tickets-repositorio';

/** Lo que la empresa está escribiendo en el detalle. */
type Accion = 'comentar' | 'rechazar' | 'confirmar' | 'reabrir' | 'cancelar';
type Vista = 'ABIERTOS' | '';

const POR_PAGINA = 5;

const TEXTOS: Record<Accion, { titulo: string; etiqueta: string; boton: string; ayuda: string }> = {
  comentar: {
    titulo: 'Responder al equipo de soporte',
    etiqueta: 'Mensaje',
    boton: 'Enviar respuesta',
    ayuda: 'Agrega detalles, responde una pregunta o adjunta una captura.',
  },
  rechazar: {
    titulo: 'La solución no funciona',
    etiqueta: '¿Qué sigue fallando?',
    boton: 'Devolver al equipo',
    ayuda: 'El ticket vuelve a desarrollo con tu comentario.',
  },
  confirmar: {
    titulo: 'Confirmar y cerrar',
    etiqueta: 'Comentario (opcional)',
    boton: 'Confirmar y cerrar',
    ayuda: 'Califica la atención: nos ayuda a mejorar.',
  },
  reabrir: {
    titulo: 'Reabrir la solicitud',
    etiqueta: 'Motivo',
    boton: 'Reabrir',
    ayuda: 'Cuéntanos qué quedó pendiente.',
  },
  cancelar: {
    titulo: 'Cancelar la solicitud',
    etiqueta: 'Motivo',
    boton: 'Cancelar solicitud',
    ayuda: 'El equipo dejará de trabajar en ella.',
  },
};

/**
 * "Mis solicitudes" del Centro de Ayuda: los tickets de la empresa, su detalle con el historial y lo que la
 * empresa puede hacer en cada estado (responder, validar la solución, confirmar con calificación, reabrir,
 * cancelar). `?ticket=<id>` (enlace de los correos y la campana) abre ese ticket.
 */
@Component({
  selector: 'app-mis-solicitudes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, Modal, Campo, ArchivosAdjuntosCampo, DetalleTicket],
  templateUrl: './mis-solicitudes.html',
})
export class MisSolicitudes {
  private readonly repositorio = inject(TicketsRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly maximoAdjuntos = MAXIMO_ADJUNTOS_TICKET;
  protected readonly tamanoMaximoMb = TAMANO_MAXIMO_ADJUNTO_MB;
  protected readonly nombreTipo = nombreTipo;

  protected readonly vista = signal<Vista>('ABIERTOS');
  protected readonly lista = signal<TicketResumen[]>([]);
  protected readonly total = signal(0);
  private readonly cantidad = signal(POR_PAGINA);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly hayMas = computed(() => this.lista().length < this.total());

  protected readonly modalAbierto = signal(false);
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly accion = signal<Accion | null>(null);
  protected readonly guardando = signal(false);
  protected readonly textos = computed(() => {
    const a = this.accion();
    return a ? TEXTOS[a] : null;
  });

  protected readonly form = this.fb.group({
    texto: ['', [Validators.maxLength(2000)]],
    calificacion: [0],
    adjuntos: this.fb.control<ArchivoAdjunto[]>([]),
  });

  constructor() {
    void this.cargar();
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((p) => {
        const id = p.get('ticket');
        if (id) void this.abrir(id);
      });
  }

  /** Recarga la lista (p. ej. después de crear un ticket desde el formulario). */
  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const pagina = await firstValueFrom(
        this.repositorio.listar({ ...FILTROS_TICKET_VACIOS, estado: this.vista() }, { pagina: 1, tamano: this.cantidad() }),
      );
      this.lista.set(pagina.items);
      this.total.set(pagina.total);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    this.cantidad.set(POR_PAGINA);
    void this.cargar();
  }

  protected verMas(): void {
    this.cantidad.update((n) => n + POR_PAGINA);
    void this.cargar();
  }

  async abrir(id: string): Promise<void> {
    try {
      const t = await firstValueFrom(this.repositorio.obtener(id));
      this.mostrar(t);
      this.modalAbierto.set(true);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  protected cerrar(): void {
    this.modalAbierto.set(false);
    // Quita `?ticket=` para que recargar la página no lo vuelva a abrir.
    void this.router.navigate([], { queryParams: { ticket: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected elegir(accion: Accion | null): void {
    this.form.reset({ texto: '', calificacion: accion === 'confirmar' ? 5 : 0, adjuntos: [] });
    const texto = this.form.controls.texto;
    texto.setValidators(
      accion === 'confirmar' || accion === null ? [Validators.maxLength(2000)] : [Validators.required, Validators.maxLength(2000)],
    );
    texto.updateValueAndValidity();
    this.accion.set(accion);
  }

  protected error$(): string | null {
    return mensajeError(this.form.controls.texto);
  }

  protected estado(t: TicketResumen): string {
    return nombreEstado(t.estado, true);
  }

  protected badge(t: TicketResumen): string {
    return ESTADOS_TICKET[t.estado].badge;
  }

  protected aprobar(): Promise<void> {
    return this.ejecutar(
      (t) => this.repositorio.validar(t.id, true, ''),
      '¡Gracias! Marcamos la solicitud como resuelta. Confírmala para cerrarla.',
    );
  }

  protected enviar(): Promise<void> {
    const accion = this.accion();
    if (!accion) return Promise.resolve();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return Promise.resolve();
    }
    const { texto, calificacion, adjuntos } = this.form.getRawValue();
    const limpio = texto.trim();
    switch (accion) {
      case 'comentar':
        return this.ejecutar((t) => this.repositorio.comentar(t.id, limpio, adjuntos), 'Respuesta enviada al equipo de soporte.');
      case 'rechazar':
        return this.ejecutar((t) => this.repositorio.validar(t.id, false, limpio), 'Devolvimos la solicitud al equipo con tu comentario.');
      case 'confirmar':
        return this.ejecutar((t) => this.repositorio.confirmar(t.id, calificacion, limpio), 'Solicitud cerrada. ¡Gracias por calificarnos!');
      case 'reabrir':
        return this.ejecutar((t) => this.repositorio.reabrir(t.id, limpio), 'Reabrimos la solicitud.');
      case 'cancelar':
        return this.ejecutar((t) => this.repositorio.cancelar(t.id, limpio), 'Solicitud cancelada.');
    }
  }

  private async ejecutar(operacion: (t: Ticket) => Observable<Ticket>, mensaje: string): Promise<void> {
    const actual = this.ticket();
    if (!actual) return;
    this.guardando.set(true);
    try {
      this.mostrar(await firstValueFrom(operacion(actual)));
      this.avisos.exito(mensaje);
      void this.cargar();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrar(t: Ticket): void {
    this.ticket.set(t);
    this.elegir(t.acciones.confirmar ? 'confirmar' : t.acciones.comentar ? 'comentar' : null);
  }
}
