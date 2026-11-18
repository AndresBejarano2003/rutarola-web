import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { FILTROS_ESTUDIANTE_VACIOS } from 'src/app/personas/estudiantes/estudiante';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { ESTADOS_PARADA, Recorrido, Trayecto, contarParadas, nombreAusencia } from 'src/app/ruta-del-dia/recorrido';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { Modal } from 'src/app/shared/modal/modal';
import { FILTROS_RECORRIDO_VACIOS } from '../../recorridos/historial-recorridos';
import { HistorialRecorridosRepositorio } from '../../recorridos/historial-recorridos-repositorio';
import { RutasRepositorio } from '../../rutas/rutas-repositorio';
import { AusenciaCronograma, ESTADOS_TRAYECTO, RutaCronograma } from '../cronograma';

interface DatosRuta {
  sector: string;
  /** Estudiantes programados en la ruta (en su orden). */
  estudiantes: { id: string; nombre: string; grado: string; direccion: string }[];
  recorridos: Recorrido[];
}

const VACIO: DatosRuta = { sector: '', estudiantes: [], recorridos: [] };

/**
 * Detalle de una ruta en un día del Cronograma: datos de la ruta y su asignación, cada trayecto (recogida / entrega)
 * con su estado, horas y, si ya se hizo, cada estudiante con su estado y horas; si aún no, los estudiantes
 * programados. Muestra los avisos de ausencia de los acudientes para esa ruta y accesos a las pantallas relacionadas.
 */
@Component({
  selector: 'app-detalle-ruta-dia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Modal, RouterLink],
  templateUrl: './detalle-ruta-dia.html',
})
export class DetalleRutaDia {
  readonly abierto = model(false);
  readonly ruta = input<RutaCronograma | null>(null);
  readonly fecha = input.required<string>();
  /** Avisos de ausencia del día (se filtran los de esta ruta). */
  readonly ausencias = input<AusenciaCronograma[]>([]);

  private readonly rutas = inject(RutasRepositorio);
  private readonly estudiantes = inject(EstudiantesRepositorio);
  private readonly historial = inject(HistorialRecorridosRepositorio);

  protected readonly estadosTrayecto = ESTADOS_TRAYECTO;
  protected readonly estadosParada = ESTADOS_PARADA;
  protected readonly nombreAusencia = nombreAusencia;
  protected readonly trayectoActivo = signal<Trayecto>('RECOGIDA');

  private readonly consulta = computed(() => {
    const r = this.ruta();
    return this.abierto() && r ? { rutaId: r.rutaId, fecha: this.fecha() } : null;
  });
  protected readonly cargando = signal(false);
  protected readonly datos = toSignal(
    toObservable(this.consulta).pipe(
      switchMap((c) => {
        if (!c) return of(VACIO);
        this.cargando.set(true);
        return forkJoin([
          this.rutas.obtener(c.rutaId).pipe(catchError(() => of(null))),
          this.estudiantes.listar({ ...FILTROS_ESTUDIANTE_VACIOS }, SIN_PAGINAR).pipe(
            map((p) => p.items),
            catchError(() => of([])),
          ),
          this.historial
            .listar({ ...FILTROS_RECORRIDO_VACIOS, rutaId: c.rutaId, desde: c.fecha, hasta: c.fecha }, SIN_PAGINAR)
            .pipe(
              map((p) => p.items),
              catchError(() => of<Recorrido[]>([])),
            ),
        ]).pipe(
          map(([ruta, todos, recorridos]): DatosRuta => {
            const porId = new Map(todos.map((e) => [e.id, e]));
            return {
              sector: ruta?.sector ?? '',
              estudiantes: (ruta?.estudianteIds ?? []).flatMap((id) => {
                const e = porId.get(id);
                return e && e.estado === 'ACTIVO' ? [{ id, nombre: nombreCompleto(e), grado: e.grado, direccion: e.direccion }] : [];
              }),
              recorridos,
            };
          }),
          catchError(() => of(VACIO)),
          map((d) => {
            this.cargando.set(false);
            return d;
          }),
        );
      }),
    ),
    { initialValue: VACIO },
  );

  /** Avisos de los acudientes para esta ruta (`ruta` trae los códigos de las rutas del estudiante). */
  protected readonly avisos = computed(() => {
    const codigo = this.ruta()?.codigo;
    return codigo ? this.ausencias().filter((a) => a.ruta.split(/[,·\s]+/).includes(codigo)) : [];
  });

  protected readonly trayecto = computed(() => this.ruta()?.trayectos.find((t) => t.trayecto === this.trayectoActivo()) ?? null);
  protected readonly recorrido = computed(() => {
    const t = this.trayecto();
    const lista = this.datos().recorridos.filter((r) => r.trayecto === this.trayectoActivo());
    return lista.find((r) => r.id === t?.recorridoId) ?? lista[0] ?? null;
  });
  protected readonly conteo = computed(() => {
    const r = this.recorrido();
    return r ? contarParadas(r.paradas) : null;
  });

  protected readonly enCurso = (t: { estado: string }) => t.estado === 'EN_CURSO';

  /** Aviso del acudiente para un estudiante en el trayecto elegido. */
  protected avisoDe(nombre: string) {
    const trayecto = this.trayectoActivo();
    return this.avisos().find((a) => a.estudiante === nombre && (!a.trayecto || a.trayecto === trayecto)) ?? null;
  }

  protected textoAviso(a: AusenciaCronograma): string {
    if (a.motivo === 'NO_ASISTE') return 'No asiste al colegio';
    return a.trayecto === 'RECOGIDA' ? 'Va al colegio por su cuenta' : a.trayecto === 'ENTREGA' ? 'No viaja de regreso' : 'Va y vuelve por su cuenta';
  }
}
