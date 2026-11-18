import { ArchivoAdjunto } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { Entidad } from 'src/app/shared/crud/crud';
import { periodoDe } from 'src/app/shared/fechas/fechas';

/** Tipos de gasto del vehículo (`TipoGasto` del API). */
export type TipoGasto =
  | 'COMBUSTIBLE'
  | 'MANTENIMIENTO'
  | 'REPUESTO'
  | 'LLANTAS'
  | 'LAVADO'
  | 'PEAJE'
  | 'PARQUEADERO'
  | 'SEGURO'
  | 'IMPUESTO'
  | 'MULTA'
  | 'OTRO';

export const TIPOS_GASTO: readonly { id: TipoGasto; nombre: string; icono: string }[] = [
  { id: 'COMBUSTIBLE', nombre: 'Combustible (tanqueada)', icono: 'fa-gas-pump' },
  { id: 'MANTENIMIENTO', nombre: 'Mantenimiento', icono: 'fa-screwdriver-wrench' },
  { id: 'REPUESTO', nombre: 'Repuesto', icono: 'fa-gears' },
  { id: 'LLANTAS', nombre: 'Llantas', icono: 'fa-circle-dot' },
  { id: 'LAVADO', nombre: 'Lavado y aseo', icono: 'fa-soap' },
  { id: 'PEAJE', nombre: 'Peaje', icono: 'fa-road' },
  { id: 'PARQUEADERO', nombre: 'Parqueadero', icono: 'fa-square-parking' },
  { id: 'SEGURO', nombre: 'Seguro / póliza', icono: 'fa-shield-halved' },
  { id: 'IMPUESTO', nombre: 'Impuesto', icono: 'fa-landmark' },
  { id: 'MULTA', nombre: 'Multa / comparendo', icono: 'fa-file-circle-exclamation' },
  { id: 'OTRO', nombre: 'Otro', icono: 'fa-receipt' },
];

export function nombreTipoGasto(tipo: TipoGasto): string {
  return TIPOS_GASTO.find((t) => t.id === tipo)?.nombre ?? tipo;
}

export function iconoTipoGasto(tipo: TipoGasto): string {
  return TIPOS_GASTO.find((t) => t.id === tipo)?.icono ?? 'fa-receipt';
}

/**
 * Gasto de un vehículo (igual a `GastoVehiculoDto`). `cantidad` = galones en COMBUSTIBLE; `kilometraje` y `cantidad`
 * `null` = no se indicó. `vehiculo` = placa · interno (lo arma el servidor). En la lista el archivo llega con `url: ''`.
 */
export interface GastoVehiculo extends Entidad {
  vehiculoId: string;
  vehiculo: string;
  tipo: TipoGasto;
  /** `YYYY-MM-DD` */
  fecha: string;
  valor: number;
  descripcion: string;
  proveedor: string;
  /** Número de factura o comprobante. */
  referencia: string;
  kilometraje: number | null;
  cantidad: number | null;
  archivo: ArchivoAdjunto | null;
}

export interface FiltrosGasto {
  vehiculoId: string;
  tipo: TipoGasto | '';
  /** `YYYY-MM-DD` incluidas, `''` = sin límite. */
  desde: string;
  hasta: string;
  texto: string;
}

export const FILTROS_GASTO_VACIOS: FiltrosGasto = { vehiculoId: '', tipo: '', desde: '', hasta: '', texto: '' };

export interface GastoPorTipo {
  tipo: TipoGasto;
  total: number;
  cantidad: number;
}

export interface GastoPorMes {
  /** `YYYY-MM` */
  periodo: string;
  total: number;
  combustible: number;
}

export interface GastoPorVehiculo {
  vehiculoId: string;
  vehiculo: string;
  total: number;
  cantidad: number;
}

/**
 * Tablero de gastos (igual a `ResumenGastosDto`, `ReglasGastos.Resumir` en el API). `kilometrosRecorridos` = mayor −
 * menor kilometraje registrado de cada vehículo; `costoPorKilometro` y `kilometrosPorGalon` son `null` sin datos.
 */
export interface ResumenGastos {
  total: number;
  cantidad: number;
  promedioMensual: number;
  combustible: number;
  galones: number;
  kilometrosRecorridos: number | null;
  costoPorKilometro: number | null;
  kilometrosPorGalon: number | null;
  porTipo: GastoPorTipo[];
  porMes: GastoPorMes[];
  porVehiculo: GastoPorVehiculo[];
}

/** Meses calendario que abarca el rango (ambos incluidos): ene–mar = 3. */
export function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
}

const redondear = (n: number, decimales = 0) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/** Cálculo puro del tablero (mismas reglas que `ReglasGastos.Resumir`). */
export function resumirGastos(gastos: readonly GastoVehiculo[]): ResumenGastos {
  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const combustible = gastos.filter((g) => g.tipo === 'COMBUSTIBLE');
  const galones = combustible.reduce((s, g) => s + (g.cantidad ?? 0), 0);

  const meses = new Map<string, GastoPorMes>();
  for (const g of gastos) {
    const periodo = g.fecha.slice(0, 7);
    const mes = meses.get(periodo) ?? { periodo, total: 0, combustible: 0 };
    mes.total += g.valor;
    if (g.tipo === 'COMBUSTIBLE') mes.combustible += g.valor;
    meses.set(periodo, mes);
  }
  const fechas = gastos.map((g) => g.fecha).sort();
  const numeroMeses = fechas.length ? mesesEntre(fechas[0], fechas[fechas.length - 1]) : 0;

  let kilometros = 0;
  let hayKilometros = false;
  let galonesConKm = 0;
  const porVehiculoKm = new Map<string, GastoVehiculo[]>();
  for (const g of gastos) {
    if (g.kilometraje === null) continue;
    porVehiculoKm.set(g.vehiculoId, [...(porVehiculoKm.get(g.vehiculoId) ?? []), g]);
  }
  for (const lecturas of porVehiculoKm.values()) {
    if (lecturas.length < 2) continue;
    const orden = [...lecturas].sort((a, b) => (a.kilometraje ?? 0) - (b.kilometraje ?? 0));
    const recorrido = (orden[orden.length - 1].kilometraje ?? 0) - (orden[0].kilometraje ?? 0);
    if (recorrido <= 0) continue;
    hayKilometros = true;
    kilometros += recorrido;
    galonesConKm += orden.slice(1).filter((g) => g.tipo === 'COMBUSTIBLE').reduce((s, g) => s + (g.cantidad ?? 0), 0);
  }

  const porTipo = new Map<TipoGasto, GastoPorTipo>();
  const porVehiculo = new Map<string, GastoPorVehiculo>();
  for (const g of gastos) {
    const t = porTipo.get(g.tipo) ?? { tipo: g.tipo, total: 0, cantidad: 0 };
    t.total += g.valor;
    t.cantidad++;
    porTipo.set(g.tipo, t);
    const v = porVehiculo.get(g.vehiculoId) ?? { vehiculoId: g.vehiculoId, vehiculo: g.vehiculo, total: 0, cantidad: 0 };
    v.total += g.valor;
    v.cantidad++;
    porVehiculo.set(g.vehiculoId, v);
  }

  return {
    total,
    cantidad: gastos.length,
    promedioMensual: numeroMeses ? redondear(total / numeroMeses) : 0,
    combustible: combustible.reduce((s, g) => s + g.valor, 0),
    galones,
    kilometrosRecorridos: hayKilometros ? kilometros : null,
    costoPorKilometro: hayKilometros ? redondear(total / kilometros) : null,
    kilometrosPorGalon: hayKilometros && galonesConKm > 0 ? redondear(kilometros / galonesConKm, 1) : null,
    porTipo: [...porTipo.values()].sort((a, b) => b.total - a.total),
    porMes: [...meses.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    porVehiculo: [...porVehiculo.values()].sort((a, b) => b.total - a.total),
  };
}

/** Rangos rápidos del tablero (fechas `YYYY-MM-DD`). */
export type RangoGastos = 'MES' | 'TRES_MESES' | 'SEIS_MESES' | 'ANIO' | 'TODO';

export const RANGOS_GASTOS: readonly { id: RangoGastos; nombre: string }[] = [
  { id: 'MES', nombre: 'Este mes' },
  { id: 'TRES_MESES', nombre: 'Últimos 3 meses' },
  { id: 'SEIS_MESES', nombre: 'Últimos 6 meses' },
  { id: 'ANIO', nombre: 'Este año' },
  { id: 'TODO', nombre: 'Todo el historial' },
];

export function fechasDeRango(rango: RangoGastos, hoy = new Date()): { desde: string; hasta: string } {
  const periodo = periodoDe(hoy);
  const [anio, mes] = periodo.split('-').map(Number);
  const inicioMes = (atras: number) => {
    const d = new Date(anio, mes - 1 - atras, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  switch (rango) {
    case 'MES':
      return { desde: inicioMes(0), hasta: '' };
    case 'TRES_MESES':
      return { desde: inicioMes(2), hasta: '' };
    case 'SEIS_MESES':
      return { desde: inicioMes(5), hasta: '' };
    case 'ANIO':
      return { desde: `${anio}-01-01`, hasta: '' };
    default:
      return { desde: '', hasta: '' };
  }
}
