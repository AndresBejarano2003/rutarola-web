import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Entidad, ErrorCrud } from 'src/app/shared/crud/crud';
import { normalizar } from 'src/app/shared/formularios/formularios';

/** Datos de identificación comunes a estudiantes, acudientes y empleados. */
export interface DatosPersona {
  tipoDocumento: string;
  numeroDocumento: string;
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  /** Foto de perfil: data URL JPG de 256 px (`shared/foto`); `''` = se muestran las iniciales. */
  foto: string;
}

export function nombreCompleto(p: DatosPersona): string {
  return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(' ');
}

export function iniciales(p: DatosPersona): string {
  return `${p.primerNombre.charAt(0)}${p.primerApellido.charAt(0)}`.toUpperCase();
}

/** Búsqueda por nombre completo o número de documento (sin tildes ni mayúsculas). */
export function coincideTexto(p: DatosPersona, texto: string): boolean {
  const consulta = normalizar(texto);
  return !consulta || normalizar(`${nombreCompleto(p)} ${p.numeroDocumento}`).includes(consulta);
}

/** Regla de negocio: no puede haber dos registros con el mismo tipo y número de documento. */
export function validarDocumentoUnico(
  datos: DatosPersona,
  idActual: string | null,
  registros: (Entidad & DatosPersona)[],
  entidad: string,
): void {
  const duplicado = registros.some(
    (r) => r.id !== idActual && r.tipoDocumento === datos.tipoDocumento && r.numeroDocumento === datos.numeroDocumento,
  );
  if (duplicado) {
    throw new ErrorCrud(
      `Ya existe ${entidad} con el documento ${datos.tipoDocumento} ${datos.numeroDocumento}.`,
      'DUPLICADO',
    );
  }
}

/** Orden alfabético por primer apellido y primer nombre. */
export function compararPorApellido(a: DatosPersona, b: DatosPersona): number {
  return `${a.primerApellido} ${a.primerNombre}`.localeCompare(`${b.primerApellido} ${b.primerNombre}`, 'es');
}

const NOMBRE = [Validators.required, Validators.maxLength(50)];

/** Controles (con validaciones) de identificación para un `FormGroup`. Se usan con `<app-campos-persona>`. */
export function controlesPersona(fb: NonNullableFormBuilder) {
  return {
    tipoDocumento: fb.control('', Validators.required),
    numeroDocumento: fb.control('', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{5,15}$/)]),
    primerNombre: fb.control('', NOMBRE),
    segundoNombre: fb.control('', Validators.maxLength(50)),
    primerApellido: fb.control('', NOMBRE),
    segundoApellido: fb.control('', Validators.maxLength(50)),
    foto: fb.control(''),
  };
}

/** Quita espacios sobrantes de los datos de identificación antes de guardar. */
export function limpiarPersona<T extends DatosPersona>(datos: T): T {
  return {
    ...datos,
    numeroDocumento: datos.numeroDocumento.trim(),
    primerNombre: datos.primerNombre.trim(),
    segundoNombre: datos.segundoNombre.trim(),
    primerApellido: datos.primerApellido.trim(),
    segundoApellido: datos.segundoApellido.trim(),
  };
}
