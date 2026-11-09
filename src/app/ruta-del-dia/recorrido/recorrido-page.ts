import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
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
import { Sonidos } from '../sonidos';
import { Avatar } from 'src/app/shared/foto/avatar';
import { inicialesDe } from 'src/app/shared/foto/foto';

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
/** Desplazamiento máximo por cuadro (px) al arrastrar cerca del borde. */
const VELOCIDAD_DESPLAZAMIENTO = 14;
/** Mantener presionada una fila este tiempo (ms) la levanta para arrastrarla. */
const PRESION_LARGA_MS = 350;
/** Si el dedo se mueve más que esto (px) antes de la presión larga, es desplazamiento de la página. */
const TOLERANCIA_PRESION = 8;

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
  imports: [RouterLink, FormsModule, NgTemplateOutlet, Avatar],
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
  protected readonly sonidos = inject(Sonidos);
  protected readonly haceCuanto = haceCuanto;

  protected readonly estados = ESTADOS_PARADA;
  protected readonly enlaceMapa = enlaceMapa;

  protected readonly recorrido = signal<Recorrido | null>(null);
  /** Fotos de los estudiantes (`estudianteId → data URL`), una sola descarga por pantalla. */
  protected readonly fotos = signal<Map<string, string>>(new Map());
  protected readonly inicialesDe = inicialesDe;
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
  private readonly listaOrden = viewChild<ElementRef<HTMLOListElement>>('listaOrden');
  /** Quita los oyentes globales del arrastre o de la presión larga en curso. */
  private terminarGesto: (() => void) | null = null;
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
    this.destroyRef.onDestroy(() => this.terminarGesto?.());
  }

  ngOnInit(): void {
    void this.cargar().then(() => this.sincronizar());
    // Sin fotos el recorrido funciona igual (iniciales): un fallo aquí no se muestra.
    this.repositorio.fotos(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (f) => this.fotos.set(f), error: () => undefined });
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
          this.sonidos.cambioOrden();
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

  /**
   * Arrastre con puntero (dedo o mouse) desde la manija ⠿: empieza de inmediato. Los oyentes van en la ventana
   * (no en la manija), porque al reordenar la vista previa Angular mueve la fila en el DOM y el navegador
   * suelta la captura del puntero: así el arrastre sigue hasta soltar aunque la fila cambie de lugar.
   */
  protected iniciarArrastre(evento: PointerEvent, indice: number, p: Parada): void {
    if (this.procesando() || evento.button > 0 || evento.isPrimary === false) return;
    evento.preventDefault();
    evento.stopPropagation();
    this.empezarArrastre(indice, p, evento.clientY);
  }

  /**
   * Presión larga sobre la fila (fuera de sus botones): la levanta para arrastrarla. Si el dedo se mueve antes,
   * es desplazamiento normal de la página y no se hace nada.
   */
  protected presionarFila(evento: PointerEvent, indice: number, p: Parada): void {
    if (this.procesando() || this.arrastre() || evento.button > 0 || evento.isPrimary === false) return;
    if ((evento.target as HTMLElement).closest('button, a, input, textarea')) return;
    this.terminarGesto?.();
    const inicioY = evento.clientY;
    const inicioX = evento.clientX;
    const temporizador = setTimeout(() => {
      limpiar();
      this.empezarArrastre(indice, p, inicioY);
    }, PRESION_LARGA_MS);
    const mover = (e: PointerEvent) => {
      if (Math.abs(e.clientY - inicioY) > TOLERANCIA_PRESION || Math.abs(e.clientX - inicioX) > TOLERANCIA_PRESION) limpiar();
    };
    const limpiar = () => {
      clearTimeout(temporizador);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', limpiar);
      window.removeEventListener('pointercancel', limpiar);
      if (this.terminarGesto === limpiar) this.terminarGesto = null;
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', limpiar);
    window.addEventListener('pointercancel', limpiar);
    this.terminarGesto = limpiar;
  }

  private empezarArrastre(indice: number, p: Parada, y: number): void {
    this.terminarGesto?.();
    this.arrastre.set({ estudianteId: p.estudianteId, desde: indice, hasta: indice });
    navigator.vibrate?.(25);
    let ultimaY = y;
    let cuadro = 0;
    // Desplaza la página mientras el dedo esté cerca del borde (también sin moverlo) y recalcula la posición.
    const desplazar = () => {
      const alto = window.innerHeight;
      const paso =
        ultimaY < MARGEN_DESPLAZAMIENTO
          ? -VELOCIDAD_DESPLAZAMIENTO * (1 - ultimaY / MARGEN_DESPLAZAMIENTO)
          : ultimaY > alto - MARGEN_DESPLAZAMIENTO
            ? VELOCIDAD_DESPLAZAMIENTO * (1 - (alto - ultimaY) / MARGEN_DESPLAZAMIENTO)
            : 0;
      if (paso) {
        window.scrollBy(0, Math.round(paso));
        this.ubicar(ultimaY);
      }
      cuadro = requestAnimationFrame(desplazar);
    };
    const mover = (e: PointerEvent) => {
      if (e.isPrimary === false) return;
      e.preventDefault();
      ultimaY = e.clientY;
      this.ubicar(ultimaY);
    };
    // Evita que el navegador desplace la página con el dedo mientras se arrastra (requiere passive: false).
    const bloquearDesplazamiento = (e: TouchEvent) => e.cancelable && e.preventDefault();
    const soltar = () => {
      limpiar();
      this.soltar();
    };
    const cancelar = () => {
      limpiar();
      this.arrastre.set(null);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cancelar();
    const limpiar = () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', cancelar);
      window.removeEventListener('touchmove', bloquearDesplazamiento);
      window.removeEventListener('keydown', tecla);
      if (this.terminarGesto === cancelar) this.terminarGesto = null;
    };
    window.addEventListener('pointermove', mover, { passive: false });
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', cancelar);
    window.addEventListener('touchmove', bloquearDesplazamiento, { passive: false });
    window.addEventListener('keydown', tecla);
    this.terminarGesto = cancelar;
    cuadro = requestAnimationFrame(desplazar);
  }

  /** Nueva posición = cuántos de los OTROS estudiantes por visitar quedan por encima del dedo. */
  private ubicar(y: number): void {
    const a = this.arrastre();
    const lista = this.listaOrden()?.nativeElement;
    if (!a || !lista) return;
    let hasta = 0;
    for (const fila of Array.from(lista.querySelectorAll<HTMLElement>('[data-por-visitar]'))) {
      if (fila.dataset['porVisitar'] === a.estudianteId) continue;
      const caja = fila.getBoundingClientRect();
      if (y > caja.top + caja.height / 2) hasta++;
    }
    if (hasta !== a.hasta) {
      this.arrastre.set({ ...a, hasta });
      navigator.vibrate?.(8);
    }
  }

  private soltar(): void {
    const a = this.arrastre();
    if (!a) return;
    const ids = this.lista().pendientes.map((p) => p.estudianteId);
    this.arrastre.set(null);
    if (a.desde !== a.hasta) void this.guardarOrden(ids, a.estudianteId, a.hasta);
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
      this.sonidos.ordenGuardado();
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
