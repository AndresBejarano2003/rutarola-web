import { EstadoRegistro } from 'src/app/shared/crud/crud';

/** Empresa de transporte (`GET /empresas/actual`). El NIT y el estado solo los cambia la plataforma. */
export interface Empresa {
  id: string;
  nombre: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  email: string;
  logoUrl: string;
  estado: EstadoRegistro;
  fechaCreacion: string;
}

/** Lo que el administrador puede cambiar de su empresa (`PUT /empresas/actual`). */
export type DatosEmpresa = Pick<Empresa, 'nombre' | 'direccion' | 'ciudad' | 'telefono' | 'email' | 'logoUrl'>;

/** Parámetro numérico de la empresa (`configuracion_sistema`). */
export interface Parametro {
  clave: string;
  descripcion: string;
  valor: string;
  minimo: number;
  maximo: number;
}

export const DIA_LIMITE_PAGO = 'finanzas.dia_limite_pago';
export const DIAS_ALERTA_VENCIMIENTO = 'alertas.dias_vencimiento';
/** Sí/No (1/0): los acudientes ven en el portal la ubicación en vivo del vehículo. */
export const ACUDIENTES_VEN_UBICACION = 'gps.acudientes_ven_ubicacion';

/** Un parámetro con mínimo 0 y máximo 1 es un interruptor Sí/No. */
export function esInterruptor(p: Parametro): boolean {
  return p.minimo === 0 && p.maximo === 1;
}

/** Catálogo de parámetros (igual al del API: `CatalogoConfiguracion`). */
export const PARAMETROS_PREDETERMINADOS: Parametro[] = [
  {
    clave: DIA_LIMITE_PAGO,
    descripcion: 'Día del mes en que vence la cuota cuando la factura no tiene programación (por defecto 5).',
    valor: '5',
    minimo: 1,
    maximo: 31,
  },
  {
    clave: DIAS_ALERTA_VENCIMIENTO,
    descripcion: 'Días antes del vencimiento de documentos y licencias en que se avisa (por defecto 30).',
    valor: '30',
    minimo: 1,
    maximo: 120,
  },
  {
    clave: ACUDIENTES_VEN_UBICACION,
    descripcion:
      'Los acudientes ven en su portal la ubicación en vivo del vehículo mientras su ruta va en camino. Si se desactiva, solo ven el estado del estudiante y la hora en que inició el recorrido; el administrador sigue viendo el monitoreo completo.',
    valor: '1',
    minimo: 0,
    maximo: 1,
  },
];

/** Nombre corto de cada parámetro en el formulario. */
export const NOMBRES_PARAMETRO: Partial<Record<string, string>> = {
  [DIA_LIMITE_PAGO]: 'Día límite de pago',
  [DIAS_ALERTA_VENCIMIENTO]: 'Días de alerta de vencimiento',
  [ACUDIENTES_VEN_UBICACION]: 'Los acudientes ven la ubicación en vivo de la ruta',
};
