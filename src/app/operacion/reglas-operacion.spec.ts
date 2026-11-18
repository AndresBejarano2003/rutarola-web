import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { Asignacion, asignacionVigente, seCruzan } from './asignaciones/asignacion';
import { AsignacionesRepositorio } from './asignaciones/asignaciones-repositorio';
import { cursosDeJornada, generarCursos, rangoCursos } from './colegios/colegio';
import { ColegiosRepositorio } from './colegios/colegios-repositorio';
import { FILTROS_CONDUCTOR_VACIOS } from './conductores/conductor';
import { ConductoresRepositorio } from './conductores/conductores-repositorio';
import { Ruta } from './rutas/ruta';
import { RutasRepositorio } from './rutas/rutas-repositorio';

const TODOS = { pagina: 1, tamano: 100 };

describe('Reglas de negocio de Operación', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
  });

  it('"Agregar cursos" llena desde Jardín hasta el curso elegido con el horario indicado', () => {
    const cursos = generarCursos([], '3°', '06:30', '12:00');
    expect(cursos.map((c) => c.grado)).toEqual(['Jardín', 'Transición', '1°', '2°', '3°']);
    expect(cursos.every((c) => c.horaEntrada === '06:30' && c.horaSalida === '12:00' && c.estado === 'ACTIVO')).toBe(true);

    // Volver a generar hasta un curso mayor actualiza el horario y agrega los faltantes.
    const ampliados = generarCursos(cursos, '5°', '07:00', '13:00');
    expect(ampliados.length).toBe(7);
    expect(ampliados.every((c) => c.horaEntrada === '07:00')).toBe(true);
  });

  it('agrega un curso suelto y el mismo grado en otra jornada con otro horario', () => {
    const manana = generarCursos([], '3°', '06:30', '12:00', 'Mañana', '3°');
    expect(manana).toEqual([{ grado: '3°', jornada: 'Mañana', horaEntrada: '06:30', horaSalida: '12:00', estado: 'ACTIVO' }]);

    const ambas = generarCursos(manana, '3°', '12:30', '18:00', 'Tarde', '3°');
    expect(ambas.map((c) => `${c.grado} ${c.jornada} ${c.horaEntrada}`)).toEqual(['3° Mañana 06:30', '3° Tarde 12:30']);
    expect(cursosDeJornada(ambas, 'Tarde').map((c) => c.grado)).toEqual(['3°']);
    expect(rangoCursos(ambas)).toBe('3° · Mañana, 3° · Tarde');
  });

  it('no permite eliminar un colegio con estudiantes', async () => {
    const colegios = TestBed.inject(ColegiosRepositorio);
    expect(await firstValueFrom(colegios.motivoNoEliminar('col-1'))).toContain('estudiante');
    await expect(firstValueFrom(colegios.eliminar('col-1'))).rejects.toMatchObject({ codigo: 'EN_USO' });
  });

  it('no permite que un estudiante esté en dos rutas activas de la misma jornada', async () => {
    const rutas = TestBed.inject(RutasRepositorio);
    const nueva: DatosRegistro<Ruta> = {
      codigo: 'R-99',
      nombre: 'Prueba',
      colegioId: 'col-5',
      jornada: 'Mañana',
      sector: 'Centro',
      estudianteIds: ['est-1'],
      estado: 'ACTIVO',
      observaciones: '',
    };
    await expect(firstValueFrom(rutas.crear(nueva))).rejects.toMatchObject({ codigo: 'VALIDACION' });
  });

  it('el código de la ruta es un consecutivo del sistema que no cambia al editar', async () => {
    const rutas = TestBed.inject(RutasRepositorio);
    const datos: DatosRegistro<Ruta> = {
      codigo: 'R-01',
      nombre: 'Nueva',
      colegioId: 'col-5',
      jornada: 'Mañana',
      sector: 'Centro',
      estudianteIds: [],
      estado: 'ACTIVO',
      observaciones: '',
    };
    const creada = await firstValueFrom(rutas.crear(datos));
    expect(creada.codigo).toBe('R-05');
    const editada = await firstValueFrom(rutas.actualizar(creada.id, { ...datos, codigo: 'X-1' }));
    expect(editada.codigo).toBe('R-05');
  });

  it('no permite asignaciones de la misma ruta que se crucen ni usar un vehículo con documentos vencidos', async () => {
    const asignaciones = TestBed.inject(AsignacionesRepositorio);
    const base: DatosRegistro<Asignacion> = {
      rutaId: 'rut-1',
      vehiculoId: 'veh-1',
      conductorId: 'emp-1',
      monitoraId: 'emp-6',
      fechaInicio: '2026-01-15',
      fechaFin: '',
      horaInicio: '',
      horaFin: '',
      estado: 'ACTIVO',
      observaciones: '',
    };
    await expect(firstValueFrom(asignaciones.crear(base))).rejects.toThrow(/ya tiene una asignación activa desde el 2026-02-02 que se cruza/);
    // veh-4 tiene el SOAT vencido.
    await expect(firstValueFrom(asignaciones.crear({ ...base, rutaId: 'rut-4', vehiculoId: 'veh-4' }))).rejects.toMatchObject({
      codigo: 'VALIDACION',
    });
    // Una monitora no puede ir como conductor.
    await expect(firstValueFrom(asignaciones.crear({ ...base, rutaId: 'rut-4', conductorId: 'emp-6' }))).rejects.toThrow(/no es conductor/);
  });

  it('las asignaciones se cruzan por fechas y horario; sin horario ocupan la jornada de la ruta', () => {
    const p = (fechaInicio: string, fechaFin: string, horaInicio = '', horaFin = '') => ({ fechaInicio, fechaFin, horaInicio, horaFin });
    // Semanas distintas: no se cruzan.
    expect(seCruzan(p('2026-11-02', '2026-11-08'), 'Mañana', p('2026-11-09', '2026-11-15'), 'Mañana')).toBe(false);
    // Indefinida desde antes: se cruza.
    expect(seCruzan(p('2026-11-02', ''), 'Mañana', p('2026-12-01', '2026-12-05'), 'Mañana')).toBe(true);
    // Mismas fechas, horas distintas: no; horas que se tocan: sí.
    expect(seCruzan(p('2026-11-02', '2026-11-08', '05:30', '08:00'), 'Mañana', p('2026-11-02', '2026-11-08', '08:00', '10:00'), 'Mañana')).toBe(false);
    expect(seCruzan(p('2026-11-02', '2026-11-08', '05:30', '08:00'), 'Mañana', p('2026-11-03', '2026-11-03', '07:00', '09:00'), 'Mañana')).toBe(true);
    // Sin horario: cuenta la jornada.
    expect(seCruzan(p('2026-11-02', ''), 'Mañana', p('2026-11-02', ''), 'Tarde')).toBe(false);
    expect(seCruzan(p('2026-11-02', '', '06:00', '09:00'), 'Mañana', p('2026-11-02', ''), 'Mañana')).toBe(true);

    // Con dos turnos el mismo día, la vigente es la del turno en curso (o la siguiente).
    const a = (id: string, horaInicio: string, horaFin: string) =>
      ({ id, rutaId: 'r', estado: 'ACTIVO' as const, ...p('2026-11-02', '2026-11-08', horaInicio, horaFin) });
    const turnos = [a('tarde', '12:00', '14:00'), a('manana', '05:30', '08:00')];
    expect(asignacionVigente(turnos, 'r', '2026-11-03', '06:00')?.id).toBe('manana');
    expect(asignacionVigente(turnos, 'r', '2026-11-03', '10:00')?.id).toBe('tarde');
    expect(asignacionVigente(turnos, 'r', '2026-11-03')?.id).toBe('manana');
    expect(asignacionVigente(turnos, 'r', '2026-11-20')).toBeUndefined();
  });

  it('crea una segunda asignación de la ruta en otra semana con otro equipo', async () => {
    const asignaciones = TestBed.inject(AsignacionesRepositorio);
    // rut-4 no tiene asignación; dos semanas seguidas con vehículos y conductores distintos.
    const semana = (fechaInicio: string, fechaFin: string, vehiculoId: string, conductorId: string): DatosRegistro<Asignacion> => ({
      rutaId: 'rut-4', vehiculoId, conductorId, monitoraId: '', fechaInicio, fechaFin, horaInicio: '', horaFin: '',
      estado: 'ACTIVO', observaciones: '',
    });
    await firstValueFrom(asignaciones.crear(semana('2027-01-04', '2027-01-10', 'veh-3', 'emp-4')));
    await firstValueFrom(asignaciones.crear(semana('2027-01-11', '2027-01-17', 'veh-3', 'emp-4')));
    await expect(firstValueFrom(asignaciones.crear(semana('2027-01-10', '2027-01-12', 'veh-3', 'emp-4')))).rejects.toMatchObject({
      codigo: 'DUPLICADO',
    });
  });

  it('no permite eliminar un vehículo o empleado con asignaciones y lista los conductores con su ruta', async () => {
    const asignaciones = TestBed.inject(AsignacionesRepositorio);
    expect(await firstValueFrom(asignaciones.opciones({ vehiculoId: 'veh-1' }))).toHaveLength(1);

    const conductores = await firstValueFrom(TestBed.inject(ConductoresRepositorio).listar(FILTROS_CONDUCTOR_VACIOS, TODOS));
    expect(conductores.total).toBe(5);
    expect(conductores.items.filter((c) => c.asignacion).length).toBe(3);
  });
});
