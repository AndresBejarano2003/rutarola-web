import { Empresa } from 'src/app/inicio/configuracion/configuracion';
import { EstadoRegistro } from 'src/app/shared/crud/crud';

export interface FiltrosEmpresa {
  texto: string;
  estado: EstadoRegistro | '';
}

export const FILTROS_EMPRESA_VACIOS: FiltrosEmpresa = { texto: '', estado: '' };

/** Primer administrador de la empresa (opcional, solo al crearla). */
export interface AdministradorInicial {
  nombre: string;
  usuario: string;
  email: string;
  contrasena: string;
}

/** `POST /empresas` y `PUT /empresas/{id}`. */
export type SolicitudEmpresa = Pick<Empresa, 'nombre' | 'nit' | 'direccion' | 'ciudad' | 'telefono' | 'email' | 'logoUrl' | 'estado'> & {
  administrador?: AdministradorInicial | null;
};

/** Usuario ADMINISTRADOR de una empresa, como lo ve la plataforma. Nunca trae la contraseña. */
export interface AdministradorEmpresa {
  id: string;
  nombre: string;
  usuario: string;
  email: string;
  telefono: string;
  estado: EstadoRegistro;
  /** ISO, null si nunca ha entrado. */
  ultimoLogin: string | null;
  fechaCreacion: string;
}

/** `contrasena`: obligatoria al crear; al editar, vacía = se conserva. */
export type SolicitudAdministrador = Pick<AdministradorEmpresa, 'nombre' | 'usuario' | 'email' | 'telefono' | 'estado'> & { contrasena: string };
