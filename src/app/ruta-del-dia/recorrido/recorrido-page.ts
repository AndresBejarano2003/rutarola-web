import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import {
  CambioOrden,
  ESTADOS_PARADA,
  EstadoParada,
  MotivoAusencia,
  Parada,
  Recorrido,
  TRAYECTOS,
  avance,
  contarParadas,
  enlaceMapa,
  enlaceWhatsapp,
  moverEnLista,
  nombreAusencia,
  paradasEnOrden,
  puedeReordenar,
  reportaUbicacion,
  siguientePaso,
} from '../recorrido';
import { RecorridosRepositorio } from '../recorridos-repositorio';
import { EmisorGps } from '../gps/emisor-gps';
import { haceCuanto } from '../gps/gps';

/** Estado al que vuelve cada uno con "Deshacer". */
const DESHACER: Partial<Record<EstadoParada, EstadoParada>> = { A_BORDO: 'PENDIENTE', ENTREGADO: 'A_BORDO', AUSENTE: 'PENDIENTE' };

/** Arrastre en curso de un estudiante por visitar (índices dentro de la lista de pendientes). */
interface Arrastre {
  estudianteId: string;
  desde: number;
  hasta: number;
}

/** Margen (px) del borde de la pantalla en el que el arrastre desplaza la página. */
const MARGEN_DESPLAZAMIENTO = 72;

/**
 * Recorrido en curso: muestra SIEMPRE el siguiente paso (a quién recoger o entregar),
 * con acceso a la dirección y al acudiente, y la lista completa para marcar fuera de orden o deshacer.
 * La monitora (o el conductor si la ruta no tiene monitora) cambia el orden de los que faltan
 * arrastrándolos; el compañero ve el cambio al instante (`observar`) con un aviso.
 * Mientras está EN CURSO, los teléfonos del conductor Y de la monitora comparten la ubicación (`EmisorGps`),
 * así sigue al día aunque uno cierre la app o se quede sin batería; el servidor descarta las lecturas casi
 * simultáneas de los dos para que el mapa no salte.
 */
@Component({
  selector: 'app-recorrido-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, NgTemplateOutlet],
  providers: [EmisorGps],
  templateUrl: './recorrido-page.html',
})
export default class RecorridoPage implements OnInit {
  private readonly repositorio = inject(RecorridosRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly sesion = inject(AuthService).sesion;
  private readonly destroyRef = inject(DestroyRef);
  protected readonly gps = inject(EmisorGps);
  protected readonly haceCuanto = haceCuanto;

  protected readonly estados = ESTADOS_PARADA;
  protected readonly enlaceMapa = enlaceMapa;

  protected readonly recorrido = signal<Recorrido | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal(false);
  protected observaciones = '';

  protected readonly trayecto = computed(() => TRAYECTOS.find((t) => t.id === this.recorrido()?.trayecto) ?? TRAYECTOS[0]);
  protected readonly conteo = computed(() => contarParadas(this.recorrido()?.paradas ?? []));
  protected readonly avance = computed(() => avance(this.conteo()));
  protected readonly paso = computed(() => {
    const r = this.recorrido();
    return r && r.estado === 'EN_CURSO' ? siguientePaso(r) : null;
  });
  protected readonly enCurso = computed(() => this.recorrido()?.estado === 'EN_CURSO');
  protected readonly esRecogida = computed(() => this.recorrido()?.trayecto === 'RECOGIDA');
  /** ¿El usuario de la sesión puede cambiar el orden de visita? */
  protected readonly ordenable = computed(() => {
    const r = this.recorrido();
    return !!r && puedeReordenar(r, this.sesion()?.empleadoId);
  });
  protected readonly arrastre = signal<Arrastre | null>(null);
  /** Lista en pantalla: visitadas y luego las que faltan (con la vista previa del arrastre). */
  protected readonly lista = computed(() => {
    const r = this.recorrido();
    if (!r) return { visitadas: [], pendientes: [] };
    const { visitadas, pendientes } = paradasEnOrden(r);
    const a = this.arrastre();
    return { visitadas, pendientes: a ? moverEnLista(pendientes, a.desde, a.hasta) : pendientes };
  });
  /** El compañero cambió el orden mientras este usuario tenía abierto el recorrido. */
  protected readonly avisoOrden = signal<CambioOrden | null>(null);
  protected readonly anuncio = signal('');

  /** Este teléfono comparte la ubicación del vehículo (conductor o monitora del recorrido). */
  protected readonly reportaUbicacion = computed(() => {
    const r = this.recorrido();
    return !!r && reportaUbicacion(r, this.sesion()?.empleadoId);
  });
  /** Nombre del compañero que también comparte (para la línea de estado). */
  protected readonly companero = computed(() => {
    const r = this.recorrido();
    if (!r) return '';
    const yo = this.sesion()?.empleadoId;
    return yo === r.conductorId ? r.monitora : r.conductor;
  });

  constructor() {
    effect(() => {
      const r = this.recorrido();
      if (!r) return;
      const reporta = r.estado === 'EN_CURSO' && this.reportaUbicacion();
      untracked(() => (reporta ? this.gps.iniciar(r.id) : void this.gps.detenerYEnviar()));
    });
  }

  ngOnInit(): void {
    void this.cargar().then(() => this.sincronizar());
  }

  /** Recibe los cambios del compañero (marcas y orden) mientras el recorrido está en curso. */
  private sincronizar(): void {
    if (!this.enCurso()) return;
    this.repositorio
      .observar(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((nuevo) => {
        // No se interrumpe al usuario mientras arrastra o guarda: su propia respuesta trae lo último.
        if (this.arrastre() || this.procesando()) return;
        const antes = this.recorrido()?.ordenActualizado?.hora;
        const cambio = nuevo.ordenActualizado;
        if (cambio && cambio.hora !== antes && cambio.empleadoId !== this.sesion()?.empleadoId) {
          this.avisoOrden.set(cambio);
          navigator.vibrate?.(200);
        }
        this.recorrido.set(nuevo);
      });
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.recorrido.set(await firstValueFrom(this.repositorio.obtener(this.id)));
      this.error.set(null);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Sin toast: el cambio se ve en el siguiente paso y en la lista (solo se avisan errores y el cierre). */
  protected marcar(estudianteIds: string[], estado: EstadoParada, motivo?: MotivoAusencia): Promise<void> {
    return this.ejecutar(this.repositorio.marcar(this.id, estudianteIds, estado, motivo));
  }

  protected deshacer(p: Parada): Promise<void> {
    const anterior = DESHACER[p.estado];
    return anterior ? this.marcar([p.estudianteId], anterior) : Promise.resolve();
  }

  protected puedeDeshacer(p: Parada): boolean {
    return p.estado !== 'PENDIENTE';
  }

  protected idsCon(estado: EstadoParada): string[] {
    return (this.recorrido()?.paradas ?? []).filter((p) => p.estado === estado).map((p) => p.estudianteId);
  }

  // --- Orden de visita -------------------------------------------------------------------------

  /** Arrastre con puntero (dedo o mouse) desde la manija ⠿ de un estudiante por visitar. */
  protected iniciarArrastre(evento: PointerEvent, indice: number, p: Parada): void {
    if (this.procesando() || evento.button > 0) return;
    evento.preventDefault();
    (evento.currentTarget as HTMLElement).setPointerCapture?.(evento.pointerId);
    this.arrastre.set({ estudianteId: p.estudianteId, desde: indice, hasta: indice });
  }

  protected moverArrastre(evento: PointerEvent): void {
    const a = this.arrastre();
    if (!a) return;
    const lista = (evento.currentTarget as HTMLElement).closest('ol');
    if (!lista) return;
    // Nueva posición = cuántos de los OTROS estudiantes quedan por encima del dedo.
    let hasta = 0;
    for (const fila of Array.from(lista.querySelectorAll<HTMLElement>('[data-por-visitar]'))) {
      if (fila.dataset['porVisitar'] === a.estudianteId) continue;
      const caja = fila.getBoundingClientRect();
      if (evento.clientY > caja.top + caja.height / 2) hasta++;
    }
    if (hasta !== a.hasta) this.arrastre.set({ ...a, hasta });
    if (evento.clientY < MARGEN_DESPLAZAMIENTO) window.scrollBy(0, -12);
    else if (evento.clientY > window.innerHeight - MARGEN_DESPLAZAMIENTO) window.scrollBy(0, 12);
  }

  protected soltar(): void {
    const a = this.arrastre();
    if (!a) return;
    const ids = this.lista().pendientes.map((p) => p.estudianteId);
    this.arrastre.set(null);
    if (a.desde !== a.hasta) void this.guardarOrden(ids, a.estudianteId, a.hasta);
  }

  protected cancelarArrastre(): void {
    this.arrastre.set(null);
  }

  /** Alternativa sin arrastre (teclado y lectores de pantalla): subir o bajar una posición. */
  protected mover(indice: number, delta: -1 | 1): void {
    const pendientes = this.lista().pendientes;
    const hasta = indice + delta;
    if (hasta < 0 || hasta >= pendientes.length) return;
    const ids = moverEnLista(pendientes, indice, hasta).map((p) => p.estudianteId);
    void this.guardarOrden(ids, pendientes[indice].estudianteId, hasta);
  }

  private async guardarOrden(ids: string[], movidoId: string, hasta: number): Promise<void> {
    const r = this.recorrido();
    if (!r) return;
    const movido = r.paradas.find((p) => p.estudianteId === movidoId);
    // Se muestra el nuevo orden de inmediato; si el servidor lo rechaza se recarga el recorrido.
    const { visitadas } = paradasEnOrden(r);
    const porId = new Map(r.paradas.map((p) => [p.estudianteId, p]));
    this.recorrido.set({ ...r, paradas: [...visitadas, ...ids.map((id) => porId.get(id) as Parada)] });
    this.procesando.set(true);
    try {
      this.recorrido.set(await firstValueFrom(this.repositorio.reordenar(this.id, ids)));
      this.anuncio.set(`${movido?.estudiante ?? 'Estudiante'} quedó de ${hasta + 1} entre los que faltan.`);
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
      this.procesando.set(false);
      await this.cargar();
    } finally {
      this.procesando.set(false);
    }
  }

  protected cerrarAvisoOrden(): void {
    this.avisoOrden.set(null);
  }

  protected finalizar(): Promise<void> {
    return this.ejecutar(this.repositorio.finalizar(this.id, this.observaciones), 'Recorrido finalizado. ¡Buen trabajo!');
  }

  private async ejecutar(operacion: Observable<Recorrido>, mensaje?: string): Promise<void> {
    this.procesando.set(true);
    try {
      this.recorrido.set(await firstValueFrom(operacion));
      if (mensaje) this.avisos.exito(mensaje);
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.procesando.set(false);
    }
  }

  protected hora(iso: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  protected telefono(numero: string): string {
    return `tel:${numero.replace(/\D/g, '')}`;
  }

  /** Mensaje de WhatsApp al acudiente según el momento del recorrido. */
  protected whatsapp(p: Parada): string {
    const r = this.recorrido();
    const quien = `${this.sesion()?.nombre ?? ''}, de la ruta ${r?.ruta ?? ''} de RutaRola`;
    const texto =
      r?.trayecto === 'RECOGIDA'
        ? `Hola, ${p.acudiente}. Soy ${quien}. Vamos en camino a recoger a ${p.estudiante}.`
        : `Hola, ${p.acudiente}. Soy ${quien}. Vamos en camino a entregar a ${p.estudiante}.`;
    return enlaceWhatsapp(p.telefonoAcudiente, texto);
  }

  protected estadoDe(p: Parada): (typeof ESTADOS_PARADA)[EstadoParada] {
    return this.estados[p.estado];
  }

  protected momento(p: Parada): string {
    if (p.estado === 'ENTREGADO') return `Entregado ${this.hora(p.horaEntrega)}`;
    if (p.estado === 'A_BORDO') return `A bordo desde ${this.hora(p.horaAbordo)}`;
    if (p.estado === 'AUSENTE') return nombreAusencia(p.motivoAusencia, this.recorrido()?.trayecto ?? 'RECOGIDA');
    return this.estados[p.estado].nombre;
  }
}
