import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { VehiculosRepositorio } from '../vehiculos-repositorio';
import { DocumentosVehiculoRepositorio } from './documentos-vehiculo-repositorio';

describe('Historial de documentos del vehículo', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
  });

  it('parte de los vencimientos del vehículo y cada renovación actualiza su fecha', async () => {
    const documentos = TestBed.inject(DocumentosVehiculoRepositorio);
    const vehiculos = TestBed.inject(VehiculosRepositorio);
    const antes = await firstValueFrom(vehiculos.obtener('veh-1'));

    const iniciales = await firstValueFrom(documentos.listar('veh-1'));
    expect(iniciales.map((d) => d.tipo).sort()).toEqual(['POLIZAS', 'SOAT', 'TARJETA_OPERACION', 'TECNOMECANICA']);
    expect(iniciales.every((d) => d.vigente)).toBe(true);

    const nuevo = await firstValueFrom(
      documentos.crear('veh-1', {
        tipo: 'SOAT', numero: '123', entidad: 'Aseguradora', fechaExpedicion: '2030-01-01', fechaVencimiento: '2031-01-01', observaciones: '',
        archivo: { nombre: 'soat.pdf', tipo: 'application/pdf', tamano: 10, url: 'data:application/pdf;base64,AAAA' },
      }),
    );
    expect(nuevo.vigente).toBe(true);
    expect((await firstValueFrom(vehiculos.obtener('veh-1'))).vencimientoSoat).toBe('2031-01-01');
    const lista = await firstValueFrom(documentos.listar('veh-1'));
    expect(lista.filter((d) => d.tipo === 'SOAT').map((d) => d.vigente)).toEqual([true, false]);
    // La lista no trae el contenido; el detalle sí.
    expect(lista[0].archivo?.url ?? '').toBe('');
    expect((await firstValueFrom(documentos.obtener('veh-1', nuevo.id))).archivo?.url).toContain('data:application/pdf');

    await firstValueFrom(documentos.eliminar('veh-1', nuevo.id));
    expect((await firstValueFrom(vehiculos.obtener('veh-1'))).vencimientoSoat).toBe(antes.vencimientoSoat);
  });

  it('valida que el vencimiento sea posterior a la expedición', async () => {
    const documentos = TestBed.inject(DocumentosVehiculoRepositorio);
    await expect(
      firstValueFrom(
        documentos.crear('veh-1', { tipo: 'OTRO', numero: '', entidad: '', fechaExpedicion: '2030-02-01', fechaVencimiento: '2030-01-01', observaciones: '', archivo: null }),
      ),
    ).rejects.toThrow('posterior a la expedición');
  });
});
