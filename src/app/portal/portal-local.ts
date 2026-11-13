import { Injectable, inject } from '@angular/core';
import { Observable, defer, filter, forkJoin, fromEvent, interval, map, merge } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { FILTROS_COTIZACION_VACIOS } from 'src/app/finanzas/cotizaciones/cotizacion';
import { CotizacionesRepositorio } from 'src/app/finanzas/cotizaciones/cotizaciones-repositorio';
import { FILTROS_FACTURA_VACIOS } from 'src/app/finanzas/facturas/factura';
import { FacturasRepositorio } from 'src/app/finanzas/facturas/facturas-repositorio';
import { FILTROS_PROGRAMACION_VACIOS } from 'src/app/finanzas/programacion/programacion';
import { ProgramacionesRepositorio } from 'src/app/finanzas/programacion/programaciones-repositorio';
import { FILTROS_RECIBO_VACIOS } from 'src/app/finanzas/recibos/recibo';
import { RecibosRepositorio } from 'src/app/finanzas/recibos/recibos-repositorio';
import { FILTROS_ASIGNACION_VACIOS } from 'src/app/operacion/asignaciones/asignacion';
import { AsignacionesRepositorio } from 'src/app/operacion/asignaciones/asignaciones-repositorio';
import { FILTROS_COLEGIO_VACIOS } from 'src/app/operacion/colegios/colegio';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { FILTROS_RECORRIDO_VACIOS } from 'src/app/operacion/recorridos/historial-recorridos';
import { HistorialRecorridosRepositorio } from 'src/app/operacion/recorridos/historial-recorridos-repositorio';
import { FILTROS_RUTA_VACIOS, etiquetaRuta } from 'src/app/operacion/rutas/ruta';
import { RutasRepositorio } from 'src/app/operacion/rutas/rutas-repositorio';
import { FILTROS_VEHICULO_VACIOS } from 'src/app/operacion/vehiculos/vehiculo';
import { VehiculosRepositorio } from 'src/app/operacion/vehiculos/vehiculos-repositorio';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { iniciales, nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { FILTROS_ESTUDIANTE_VACIOS } from 'src/app/personas/estudiantes/estudiante';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { CLAVE_RECORRIDOS, vigenteEn } from 'src/app/ruta-del-dia/recorridos-local';
import {
  AvisoAusencia,
  AvisoGuardado,
  CLAVE_AVISOS_AUSENCIA,
  DIAS_MAXIMOS_AVISO,
  SolicitudAvisoAusencia,
  escribirAvisos,
  leerAvisos,
  ordenarAvisos,
  publico,
} from 'src/app/ruta-del-dia/avisos-ausencia';
import { Recorrido } from 'src/app/ruta-del-dia/recorrido';
import { LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { sumarDias } from 'src/app/shared/fechas/fechas';
import { GRADOS } from 'src/app/shared/catalogos/catalogos';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { calcularEstadoCuenta } from './estado-cuenta';
import { EstudiantePortal, PortalAcudiente, RecorridoHoy } from './portal';
import { PortalRepositorio } from './portal-repositorio';
import { ACUDIENTES_VEN_UBICACION } from 'src/app/inicio/configuracion/configuracion';
import { ConfiguracionRepositorio } from 'src/app/inicio/configuracion/configuracion-repositorio';

/** Arma el portal cruzando los datos locales de todos los módulos (lo que hará `GET /portal`). */
@Injectable()
export class PortalLocal extends PortalRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly auth = inject(AuthService);
  private readonly acudientes = inject(AcudientesRepositorio);
  private readonly estudiantes = inject(EstudiantesRepositorio);
  private readonly colegios = inject(ColegiosRepositorio);
  private readonly rutas = inject(RutasRepositorio);
  private readonly asignaciones = inject(AsignacionesRepositorio);
  private readonly vehiculos = inject(VehiculosRepositorio);
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly facturas = inject(FacturasRepositorio);
  private readonly recibos = inject(RecibosRepositorio);
  private readonly programaciones = inject(ProgramacionesRepositorio);
  private readonly cotizaciones = inject(CotizacionesRepositorio);
  private readonly recorridos = inject(HistorialRecorridosRepositorio);
  private readonly configuracion = inject(ConfiguracionRepositorio);
  private readonly latenciaMs = inject(LATENCIA_LOCAL);

  obtener(): Observable<PortalAcudiente> {
    return defer(() => {
      const acudienteId = this.auth.sesion()?.acudienteId;
      if (!acudienteId) throw new ErrorCrud('Inicia sesión como acudiente para ver tu portal.', 'VALIDACION');
      const hoy = fechaIso();
      return forkJoin({
        acudiente: this.acudientes.obtener(acudienteId),
        estudiantes: this.estudiantes.listar({ ...FILTROS_ESTUDIANTE_VACIOS, acudienteId }, SIN_PAGINAR),
        colegios: this.colegios.listar(FILTROS_COLEGIO_VACIOS, SIN_PAGINAR),
        rutas: this.rutas.listar({ ...FILTROS_RUTA_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
        asignaciones: this.asignaciones.listar({ ...FILTROS_ASIGNACION_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
        vehiculos: this.vehiculos.listar(FILTROS_VEHICULO_VACIOS, SIN_PAGINAR),
        empleados: this.empleados.listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR),
        facturas: this.facturas.listar({ ...FILTROS_FACTURA_VACIOS, acudienteId }, SIN_PAGINAR),
        recibos: this.recibos.listar(FILTROS_RECIBO_VACIOS, SIN_PAGINAR),
        programaciones: this.programaciones.listar(FILTROS_PROGRAMACION_VACIOS, SIN_PAGINAR),
        cotizaciones: this.cotizaciones.listar(FILTROS_COTIZACION_VACIOS, SIN_PAGINAR),
        recorridos: this.recorridos.listar({ ...FILTROS_RECORRIDO_VACIOS, desde: hoy, hasta: hoy }, SIN_PAGINAR),
        parametros: this.configuracion.parametros(),
      }).pipe(
        map((d): PortalAcudiente => {
          const colegioPorId = new Map(d.colegios.items.map((c) => [c.id, c]));
          const vehiculoPorId = new Map(d.vehiculos.items.map((v) => [v.id, v]));
          const empleadoPorId = new Map(d.empleados.items.map((e) => [e.id, e]));

          const avisos = leerAvisos().filter((a) => a.fecha >= hoy);
          const estudiantes = d.estudiantes.items.map((e): EstudiantePortal => {
            const colegio = colegioPorId.get(e.colegioId);
            const curso = colegio?.cursos.find((c) => c.grado === e.grado);
            const ruta = d.rutas.items.find((r) => r.estudianteIds.includes(e.id));
            const asignacion = ruta ? d.asignaciones.items.find((a) => a.rutaId === ruta.id && vigenteEn(a, hoy)) : undefined;
            const conductor = asignacion ? empleadoPorId.get(asignacion.conductorId) : undefined;
            const monitora = asignacion?.monitoraId ? empleadoPorId.get(asignacion.monitoraId) : undefined;
            const hoyRecorridos = d.recorridos.items
              .flatMap((r): RecorridoHoy[] => {
                const parada = r.paradas.find((p) => p.estudianteId === e.id);
                return parada
                  ? [{ recorridoId: r.id, trayecto: r.trayecto, enCurso: r.estado === 'EN_CURSO', estado: parada.estado, horaAbordo: parada.horaAbordo, horaEntrega: parada.horaEntrega, motivoAusencia: parada.motivoAusencia ?? '', horaInicio: r.inicio || null }]
                  : [];
              })
              .sort((a, b) => a.trayecto.localeCompare(b.trayecto)).reverse(); // RECOGIDA antes que ENTREGA
            return {
              id: e.id,
              nombre: nombreCompleto(e),
              iniciales: iniciales(e),
              foto: e.foto ?? '',
              grado: GRADOS.find((g) => g.id === e.grado)?.nombre ?? e.grado,
              jornada: e.jornada,
              direccion: e.direccion,
              colegio: colegio?.razonSocial ?? '',
              direccionColegio: colegio?.direccion ?? '',
              horario: curso ? { entrada: curso.horaEntrada, salida: curso.horaSalida } : null,
              estado: e.estado,
              transporte: ruta
                ? {
                    ruta: etiquetaRuta(ruta),
                    jornada: ruta.jornada,
                    sector: ruta.sector,
                    vehiculo: asignacion ? (vehiculoPorId.get(asignacion.vehiculoId)?.placa ?? '') : '',
                    conductor: conductor ? nombreCompleto(conductor) : '',
                    telefonoConductor: conductor?.telefono ?? '',
                    monitora: monitora ? nombreCompleto(monitora) : '',
                    telefonoMonitora: monitora?.telefono ?? '',
                    fotoConductor: conductor?.foto ?? '',
                    fotoMonitora: monitora?.foto ?? '',
                  }
                : null,
              hoy: hoyRecorridos,
              avisos: ordenarAvisos(avisos.filter((a) => a.estudianteId === e.id).map(publico)),
            };
          });

          const diaLimite = new Map(d.programaciones.items.map((p) => [p.facturaId, p.diaLimitePago]));
          const cuenta = calcularEstadoCuenta(d.facturas.items, d.recibos.items, diaLimite);
          const a = d.acudiente;
          return {
            acudiente: { nombre: nombreCompleto(a), telefono: a.telefono, correo: a.correo, direccion: a.direccion },
            estudiantes: estudiantes.sort((x, y) => x.estado.localeCompare(y.estado) || x.nombre.localeCompare(y.nombre)),
            ...cuenta,
            ubicacionEnVivo: d.parametros.find((p) => p.clave === ACUDIENTES_VEN_UBICACION)?.valor !== '0',
            cotizaciones: d.cotizaciones.items
              .filter((c) => c.acudienteId === acudienteId)
              .sort((x, y) => y.fecha.localeCompare(x.fecha))
              .map((c) => ({
                id: c.id,
                numero: c.numero,
                fecha: c.fecha,
                estudiantes: c.estudiantes.map((e) => e.nombre),
                valorPorEstudiante: c.valorPorEstudiante,
                valorTotal: c.valorTotal,
                estado: c.estado,
              })),
          };
        }),
      );
    });
  }

  /** Otra pestaña cambió los recorridos (la Ruta del día) o los avisos, o pasó el intervalo de consulta. */
  observarCambios(): Observable<unknown> {
    return merge(
      fromEvent<StorageEvent>(window, 'storage').pipe(filter((e) => e.key === CLAVE_RECORRIDOS || e.key === CLAVE_AVISOS_AUSENCIA)),
      interval(30_000),
    );
  }

  /** Mismas reglas que `ServicioAvisosAusencia.CrearAsync`. */
  crearAviso(s: SolicitudAvisoAusencia): Observable<AvisoAusencia> {
    return defer(() => {
      const acudienteId = this.auth.sesion()?.acudienteId;
      if (!acudienteId) throw new ErrorCrud('Inicia sesión como acudiente para avisar una ausencia.', 'VALIDACION');
      return forkJoin({
        acudiente: this.acudientes.obtener(acudienteId),
        estudiantes: this.estudiantes.listar({ ...FILTROS_ESTUDIANTE_VACIOS, acudienteId }, SIN_PAGINAR),
        rutas: this.rutas.listar({ ...FILTROS_RUTA_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
      }).pipe(
        map(({ acudiente, estudiantes, rutas }) => {
          const estudiante = estudiantes.items.find((e) => e.id === s.estudianteId);
          if (!estudiante) throw new ErrorCrud('El estudiante no existe.', 'NO_ENCONTRADO');
          const hoy = fechaIso();
          if (!s.fecha || s.fecha < hoy || s.fecha > sumarDias(hoy, DIAS_MAXIMOS_AVISO)) {
            throw new ErrorCrud(`Puedes avisar desde hoy y hasta ${DIAS_MAXIMOS_AVISO} días adelante.`, 'VALIDACION');
          }
          if (s.nota.length > 300) throw new ErrorCrud('La nota admite máximo 300 caracteres.', 'VALIDACION');
          const trayecto = s.motivo === 'NO_ASISTE' ? '' : (s.trayecto ?? '');
          const todos = leerAvisos();
          if (todos.some((a) => a.estudianteId === s.estudianteId && a.fecha === s.fecha && (!a.trayecto || !trayecto || a.trayecto === trayecto))) {
            throw new ErrorCrud('Ya hay un aviso para ese día. Cancélalo si quieres cambiarlo.', 'DUPLICADO');
          }
          const terminados = new Set(
            this.recorridosGuardados()
              .filter((r) => r.fecha === s.fecha && r.estado === 'FINALIZADO' && (!trayecto || r.trayecto === trayecto) && r.paradas.some((p) => p.estudianteId === s.estudianteId))
              .map((r) => r.trayecto),
          );
          if (trayecto ? terminados.size > 0 : terminados.size >= 2) {
            throw new ErrorCrud('Ese recorrido ya terminó: no se puede avisar.', 'VALIDACION');
          }
          const ruta = rutas.items.find((r) => r.estudianteIds.includes(estudiante.id));
          const nuevo: AvisoGuardado = {
            id: crypto.randomUUID(),
            estudianteId: estudiante.id,
            estudiante: nombreCompleto(estudiante),
            fecha: s.fecha,
            trayecto,
            motivo: s.motivo,
            nota: s.nota.trim(),
            acudienteId,
            acudiente: nombreCompleto(acudiente),
            telefonoAcudiente: acudiente.telefono,
            ruta: ruta ? etiquetaRuta(ruta) : '',
            confirmado: false,
            confirmadoPorId: '',
            confirmadoPor: '',
            fechaConfirmacion: null,
            fechaCreacion: new Date().toISOString(),
          };
          escribirAvisos([...todos, nuevo]);
          return publico(nuevo);
        }),
      );
    });
  }

  cancelarAviso(id: string): Observable<void> {
    return defer(() =>
      responderLocal(() => {
        const acudienteId = this.auth.sesion()?.acudienteId;
        const todos = leerAvisos();
        const aviso = todos.find((a) => a.id === id && a.acudienteId === acudienteId);
        if (!aviso) throw new ErrorCrud('El aviso no existe.', 'NO_ENCONTRADO');
        if (aviso.confirmado) throw new ErrorCrud('La ruta ya confirmó este aviso. Si sí viaja, llama a la monitora o al conductor.', 'VALIDACION');
        if (aviso.fecha < fechaIso()) throw new ErrorCrud('Ese aviso es de un día que ya pasó.', 'VALIDACION');
        escribirAvisos(todos.filter((a) => a.id !== id));
      }, this.latenciaMs),
    );
  }

  private recorridosGuardados(): Recorrido[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_RECORRIDOS) ?? '[]') as Recorrido[];
    } catch {
      return [];
    }
  }
}
