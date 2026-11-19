import type * as L from 'leaflet';
import { duracionAnimacion, leafletDe } from './mapa';

describe('Mapa: carga de Leaflet', () => {
  const leaflet = { map: () => null } as unknown as typeof L;

  it('acepta el módulo con export default (compilación de producción) y con nombres sueltos (desarrollo)', () => {
    expect(leafletDe({ default: leaflet } as unknown as typeof L & { default: typeof L })).toBe(leaflet);
    expect(leafletDe(leaflet)).toBe(leaflet);
  });

  it('falla con un mensaje claro si el módulo no trae Leaflet', () => {
    expect(() => leafletDe({} as typeof L)).toThrow('Leaflet no se cargó correctamente');
  });
});

describe('Mapa: movimiento fluido de los vehículos', () => {
  it('desliza el vehículo durante lo que tardó en llegar la posición, dentro de 0,6–4,5 s', () => {
    expect(duracionAnimacion(60, 5_000)).toBe(4_500);
    expect(duracionAnimacion(60, 2_000)).toBe(2_000);
    expect(duracionAnimacion(5, 100)).toBe(600);
  });

  it('un salto largo (tras un rato sin señal) se recorre rápido', () => {
    expect(duracionAnimacion(5_000, 300_000)).toBe(1_200);
  });
});
