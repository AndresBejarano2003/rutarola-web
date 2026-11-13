import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, map, of } from 'rxjs';
import { ArchivoAdjunto, ArchivosAdjuntosCampo } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Campo } from 'src/app/shared/campo/campo';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { emitirEnVivo, mensajeError } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { DetalleTicket } from 'src/app/sistema/soporte/tickets/detalle-ticket/detalle-ticket';
import {
  ESTADOS_TICKET,
  EstadoReunion,
  EstadoTicket,
  FiltrosTicket,
  MAXIMO_ADJUNTOS_TICKET,
  MODALIDADES_REUNION,
  ModalidadReunion,
  PRIORIDADES_TICKET,
  PrioridadTicket,
  ResumenTickets,
  ReunionTicket,
  TAMANO_MAXIMO_ADJUNTO_MB,
  TIPOS_TICKET,
  Ticket,
  TicketResumen,
  badgePrioridad,
  nombreEstado,
  nombrePrioridad,
  nombreTipo,
  opcionesEstado,
  requiereComentario,
} from 'src/app/sistema/soporte/tickets/tickets';
import { TicketsRepositorio } from 'src/app/sistema/soporte/tickets/tickets-repositorio';
import { EmpresasRepositorio } from '../empresas/empresas-repositorio';
import { FILTROS_EMPRESA_VACIOS } from '../empresas/empresa';
import { BandejaTicketsStore, FILTROS_BANDEJA_INICIALES } from './bandeja-tickets-store';

type Pestana = 'avanzar' | 'responder' | 'asignar' | 'reunion';

/** Tarjetas del resumen: cada una filtra la bandeja. */
interface Indicador {
  titulo: string;
  valor: number;
  icono: string;
  color: string;
  filtros: Partial<FiltrosTicket>;
}

/**
 * Plataforma › Soporte (SUPER_ADMIN): bandeja de los tickets de todas las empresas. En el detalle se avanza
 * por las etapas (revisión → proceso → QA → pruebas → validación de la empresa → resuelto), se responde o se
 * deja una nota interna, se asigna responsable y prioridad (recalcula el tiempo objetivo) y se agendan y
 * registran reuniones. `?ticket=<id>` (enlace del correo al equipo) abre ese ticket.
 */
@Component({
  selector: 'app-soporte-plataforma-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    PanelFiltros,
    SelectorBusqueda,
    EncabezadoListado,
    Paginacion,
    EstadoVacio,
    Modal,
    Campo,
    ArchivosAdjuntosCampo,
    DetalleTicket,
  ],
  providers: [BandejaTicketsStore],
  templateUrl: './soporte-plataforma-page.html',
})
export default class SoportePlataformaPage implements OnInit {
  protected readonly store = inject(BandejaTicketsStore);
  private readonly repositorio = inject(TicketsRepositorio);
  private readonly empresas = inject(EmpresasRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  protected readonly opcionesEstado = opcionesEstado();
  protected readonly prioridades = PRIORIDADES_TICKET;
  protected readonly tipos = TIPOS_TICKET;
  protected readonly modalidades = MODALIDADES_REUNION;
  protected readonly maximoAdjuntos = MAXIMO_ADJUNTOS_TICKET;
  protected readonly tamanoMaximoMb = TAMANO_MAXIMO_ADJUNTO_MB;
  protected readonly nombrePrioridad = nombrePrioridad;
  protected readonly badgePrioridad = badgePrioridad;
  protected readonly nombreTipo = nombreTipo;

  protected readonly opcionesEmpresa = toSignal(
    this.empresas.listar(FILTROS_EMPRESA_VACIOS, { pagina: 1, tamano: 1000 }).pipe(
      map((p) => p.items.map((e) => ({ id: e.id, nombre: e.nombre }))),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
  private readonly responsables = toSignal(this.repositorio.responsables().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly opcionesResponsable = computed(() => [{ id: 'SIN_ASIGNAR', nombre: 'Sin asignar' }, ...this.responsables()]);
  protected readonly opcionesAsignar = computed(() => [{ id: '', nombre: 'Sin asignar' }, ...this.responsables()]);

  protected readonly resumen = signal<ResumenTickets | null>(null);
  protected readonly indicadores = computed<Indicador[]>(() => {
    const r = this.resumen();
    if (!r) return [];
    const e = r.porEstado;
    return [
      { titulo: 'Abiertos', valor: r.abiertos, icono: 'fa-solid fa-inbox', color: 'text-info', filtros: { estado: 'ABIERTOS' } },
      { titulo: 'Nuevos', valor: e.NUEVO, icono: 'fa-solid fa-bell', color: 'text-primary', filtros: { estado: 'NUEVO' } },
      { titulo: 'Sin asignar', valor: r.sinAsignar, icono: 'fa-solid fa-user-slash', color: 'text-warning', filtros: { estado: 'ABIERTOS', responsableId: 'SIN_ASIGNAR' } },
      { titulo: 'Fuera de tiempo', valor: r.vencidos, icono: 'fa-solid fa-clock', color: 'text-error', filtros: { vencidos: true } },
      { titulo: 'En QA / pruebas', valor: e.EN_QA + e.EN_PRUEBAS, icono: 'fa-solid fa-vial', color: 'text-secondary', filtros: { estado: 'EN_QA' } },
      { titulo: 'Esperando empresa', valor: e.ESPERANDO_CLIENTE + e.VALIDACION_CLIENTE, icono: 'fa-solid fa-hourglass-half', color: 'text-warning', filtros: { estado: 'ESPERANDO_CLIENTE' } },
      { titulo: 'Reuniones (7 días)', valor: r.reunionesProximas, icono: 'fa-solid fa-calendar-day', color: 'text-info', filtros: { estado: 'ABIERTOS' } },
      { titulo: 'Resueltos sin confirmar', valor: e.RESUELTO, icono: 'fa-solid fa-circle-check', color: 'text-success', filtros: { estado: 'RESUELTO' } },
    ];
  });

  protected readonly filtros = this.fb.group({
    texto: FILTROS_BANDEJA_INICIALES.texto,
    estado: FILTROS_BANDEJA_INICIALES.estado,
    prioridad: '',
    tipo: '',
    empresaId: '',
    responsableId: '',
    vencidos: false,
  });

  // --- Detalle ---
  protected readonly modalAbierto = signal(false);
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly pestana = signal<Pestana>('avanzar');
  protected readonly guardando = signal(false);
  /** Estado elegido en "Avanzar". */
  protected readonly destino = signal<EstadoTicket | null>(null);
  protected readonly comentarioObligatorio = computed(() => {
    const t = this.ticket();
    const d = this.destino();
    return !!t && !!d && requiereComentario(t.estado, d);
  });
  protected readonly reunionesPendientes = computed(() => this.ticket()?.reuniones.filter((r) => r.estado === 'PROGRAMADA') ?? []);
  /** Reunión que se está registrando (realizada / cancelada). */
  protected readonly registrando = signal<ReunionTicket | null>(null);

  protected readonly formEstado = this.fb.group({ comentario: ['', Validators.maxLength(2000)] });
  protected readonly formRespuesta = this.fb.group({
    texto: ['', [Validators.required, Validators.maxLength(2000)]],
    interno: [false],
    adjuntos: this.fb.control<ArchivoAdjunto[]>([]),
  });
  protected readonly formAsignacion = this.fb.group({
    responsableId: [''],
    prioridad: this.fb.control<PrioridadTicket>('MEDIA', Validators.required),
  });
  protected readonly formReunion = this.fb.group({
    fecha: ['', Validators.required],
    duracionMinutos: [30, [Validators.required, Validators.min(15), Validators.max(480)]],
    modalidad: this.fb.control<ModalidadReunion>('VIRTUAL', Validators.required),
    enlace: ['', Validators.maxLength(500)],
    motivo: ['', [Validators.required, Validators.maxLength(300)]],
  });
  protected readonly formRegistro = this.fb.group({
    estado: this.fb.control<Exclude<EstadoReunion, 'PROGRAMADA'>>('REALIZADA'),
    notas: ['', [Validators.required, Validators.maxLength(2000)]],
  });
  private readonly modalidad = toSignal(this.formReunion.controls.modalidad.valueChanges, { initialValue: this.formReunion.controls.modalidad.value });
  protected readonly enlaceObligatorio = computed(() => this.modalidad() === 'VIRTUAL');

  constructor() {
    emitirEnVivo<FiltrosTicket>(this.filtros, { emit: (f) => this.store.buscar(f) });
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((p) => {
        const id = p.get('ticket');
        if (id) void this.abrir(id);
      });
  }

  ngOnInit(): void {
    this.store.recargar();
    void this.cargarResumen();
  }

  private async cargarResumen(): Promise<void> {
    try {
      this.resumen.set(await firstValueFrom(this.repositorio.resumen()));
    } catch {
      this.resumen.set(null);
    }
  }

  protected aplicar(i: Indicador): void {
    this.filtros.reset({ ...FILTROS_BANDEJA_INICIALES, estado: '', ...i.filtros });
  }

  protected limpiarFiltros(): void {
    this.filtros.reset(FILTROS_BANDEJA_INICIALES);
  }

  protected nombreEstado(e: EstadoTicket): string {
    return nombreEstado(e);
  }

  protected badgeEstado(e: EstadoTicket): string {
    return ESTADOS_TICKET[e].badge;
  }

  protected accionDe(e: EstadoTicket): string {
    return ESTADOS_TICKET[e].accion;
  }

  protected iconoDe(e: EstadoTicket): string {
    return ESTADOS_TICKET[e].icono;
  }

  // --- Detalle -------------------------------------------------------------------------------------

  protected async abrir(id: string): Promise<void> {
    try {
      this.mostrar(await firstValueFrom(this.repositorio.detallePlataforma(id)));
      this.pestana.set('avanzar');
      this.modalAbierto.set(true);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  protected cerrar(): void {
    this.modalAbierto.set(false);
    void this.router.navigate([], { queryParams: { ticket: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    this.registrando.set(null);
  }

  protected elegirDestino(e: EstadoTicket): void {
    this.destino.set(e);
    const t = this.ticket();
    const comentario = this.formEstado.controls.comentario;
    comentario.setValidators(t && requiereComentario(t.estado, e) ? [Validators.required, Validators.maxLength(2000)] : [Validators.maxLength(2000)]);
    comentario.updateValueAndValidity();
  }

  protected elegirRegistro(r: ReunionTicket | null): void {
    this.formRegistro.reset({ estado: 'REALIZADA', notas: '' });
    this.registrando.set(r);
  }

  protected error(control: Parameters<typeof mensajeError>[0]): string | null {
    return mensajeError(control);
  }

  /** Id del formulario que envía el botón principal del pie según la pestaña. */
  protected readonly formularioActivo = computed(() => {
    if (this.registrando()) return 'form-registro-reunion';
    return { avanzar: 'form-estado-ticket', responder: 'form-respuesta-ticket', asignar: 'form-asignacion-ticket', reunion: 'form-reunion-ticket' }[
      this.pestana()
    ];
  });

  protected readonly textoGuardar = computed(() => {
    if (this.registrando()) return 'Registrar reunión';
    switch (this.pestana()) {
      case 'avanzar': {
        const d = this.destino();
        return d ? this.accionDe(d) : 'Elige el siguiente paso';
      }
      case 'responder':
        return 'Enviar';
      case 'asignar':
        return 'Guardar asignación';
      default:
        return 'Agendar reunión';
    }
  });

  protected avanzar(): Promise<void> {
    const destino = this.destino();
    if (!destino) {
      this.avisos.error('Elige a qué etapa pasa el ticket.');
      return Promise.resolve();
    }
    if (!this.valido(this.formEstado)) return Promise.resolve();
    return this.ejecutar(
      (t) => this.repositorio.cambiarEstado(t.id, destino, this.formEstado.getRawValue().comentario.trim()),
      `Ticket en «${nombreEstado(destino)}». La empresa recibió el aviso.`,
    );
  }

  protected responder(): Promise<void> {
    if (!this.valido(this.formRespuesta)) return Promise.resolve();
    const { texto, interno, adjuntos } = this.formRespuesta.getRawValue();
    return this.ejecutar(
      (t) => this.repositorio.responder(t.id, texto.trim(), interno, adjuntos),
      interno ? 'Nota interna guardada (la empresa no la ve).' : 'Respuesta enviada a la empresa.',
    );
  }

  protected asignar(): Promise<void> {
    if (!this.valido(this.formAsignacion)) return Promise.resolve();
    const { responsableId, prioridad } = this.formAsignacion.getRawValue();
    return this.ejecutar((t) => this.repositorio.asignar(t.id, responsableId, prioridad), 'Asignación actualizada.');
  }

  protected agendar(): Promise<void> {
    const enlace = this.formReunion.controls.enlace;
    enlace.setValidators(this.enlaceObligatorio() ? [Validators.required, Validators.maxLength(500)] : [Validators.maxLength(500)]);
    enlace.updateValueAndValidity();
    if (!this.valido(this.formReunion)) return Promise.resolve();
    const v = this.formReunion.getRawValue();
    return this.ejecutar(
      (t) =>
        this.repositorio.programarReunion(t.id, {
          fecha: new Date(v.fecha).toISOString(),
          duracionMinutos: v.duracionMinutos,
          modalidad: v.modalidad,
          enlace: v.enlace.trim(),
          motivo: v.motivo.trim(),
        }),
      'Reunión agendada. La empresa recibió la invitación.',
    );
  }

  protected registrarReunion(): Promise<void> {
    const r = this.registrando();
    if (!r || !this.valido(this.formRegistro)) return Promise.resolve();
    const { estado, notas } = this.formRegistro.getRawValue();
    return this.ejecutar(
      (t) => this.repositorio.actualizarReunion(t.id, r.id, estado, notas.trim()),
      estado === 'REALIZADA' ? 'Reunión registrada con su acta.' : 'Reunión cancelada.',
    );
  }

  private valido(form: { invalid: boolean; markAllAsTouched(): void }): boolean {
    if (form.invalid) form.markAllAsTouched();
    return !form.invalid;
  }

  private async ejecutar(operacion: (t: Ticket) => Observable<Ticket>, mensaje: string): Promise<void> {
    const actual = this.ticket();
    if (!actual) return;
    this.guardando.set(true);
    try {
      this.mostrar(await firstValueFrom(operacion(actual)));
      this.avisos.exito(mensaje);
      this.store.recargar();
      void this.cargarResumen();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Muestra el ticket y deja los formularios listos para el siguiente paso. */
  private mostrar(t: Ticket): void {
    this.ticket.set(t);
    this.destino.set(null);
    this.registrando.set(null);
    this.formEstado.reset({ comentario: '' });
    this.formRespuesta.reset({ texto: '', interno: false, adjuntos: [] });
    this.formAsignacion.reset({ responsableId: t.responsableId, prioridad: t.prioridad });
    this.formReunion.reset({ fecha: '', duracionMinutos: 30, modalidad: 'VIRTUAL', enlace: '', motivo: '' });
    // El primero es el avance natural (revisar → proceso → QA → …).
    if (t.siguientesEstados.length) this.elegirDestino(t.siguientesEstados[0]);
  }

  protected fila(t: TicketResumen): string {
    return t.vencido ? 'text-error' : 'text-base-content/70';
  }
}
