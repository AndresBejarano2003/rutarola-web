import type * as L from 'leaflet';
import { leafletDe } from './mapa';

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
