import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DatosRegistro, ErrorCrud } from 'src/app/shared/crud/crud';
import { Estudiante, FILTROS_ESTUDIANTE_VACIOS } from './estudiante';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { EstudiantesRepositorio } from './estudiantes-repositorio';

const NUEVO: DatosRegistro<Estudiante> = {
  tipoDocumento: 'TI',
  numeroDocumento: '9999999999',
  primerNombre: 'Ana',
  segundoNombre: '',
  primerApellido: 'Zúñiga',
  segundoApellido: '',
  foto: '',
  fechaNacimiento: '2014-01-01',
  direccion: 'Calle 1',
  acudienteId: 'acu-1',
  colegioId: 'col-1',
  grado: '6°',
  jornada: 'Mañana',
  estado: 'ACTIVO',
  observaciones: '',
};

describe('EstudiantesLocal', () => {
  let repo: EstudiantesRepositorio;
  const todos = { pagina: 1, tamano: 100 };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
    repo = TestBed.inject(EstudiantesRepositorio);
  });

  it('carga los datos de ejemplo y pagina', async () => {
    const pagina = await firstValueFrom(repo.listar(FILTROS_ESTUDIANTE_VACIOS, { pagina: 2, tamano: 5 }));
    expect(pagina.total).toBe(12);
    expect(pagina.items.length).toBe(5);
  });

  it('filtra por texto sin importar tildes ni mayúsculas', async () => {
    const pagina = await firstValueFrom(repo.listar({ ...FILTROS_ESTUDIANTE_VACIOS, texto: 'SEBASTIAN perez' }, todos));
    expect(pagina.items.map((e) => e.id)).toEqual(['est-1']);
  });

  it('crea, actualiza y elimina persistiendo en localStorage', async () => {
    const creado = await firstValueFrom(repo.crear(NUEVO));
    expect(creado.id).toBeTruthy();
    expect(localStorage.getItem('rutarola.estudiantes')).toContain('9999999999');

    const actualizado = await firstValueFrom(repo.actualizar(creado.id, { ...NUEVO, grado: '7°' }));
    expect(actualizado.grado).toBe('7°');
    expect(actualizado.fechaCreacion).toBe(creado.fechaCreacion);

    await firstValueFrom(repo.eliminar(creado.id));
    await expect(firstValueFrom(repo.obtener(creado.id))).rejects.toBeInstanceOf(ErrorCrud);
  });

  it('rechaza documentos duplicados', async () => {
    await expect(
      firstValueFrom(repo.crear({ ...NUEVO, tipoDocumento: 'TI', numeroDocumento: '1020304050' })),
    ).rejects.toThrow(/Ya existe un estudiante/);
  });

  it('permite guardar un registro sin cambiar su propio documento', async () => {
    const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = await firstValueFrom(repo.obtener('est-1'));
    await expect(firstValueFrom(repo.actualizar('est-1', { ...datos, grado: '8°' }))).resolves.toMatchObject({ grado: '8°' });
  });
});
