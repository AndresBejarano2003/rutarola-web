import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

/** La fecha (`YYYY-MM-DD`) no puede ser posterior a hoy. */
export const fechaNoFutura: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null => {
  const valor = control.value;
  if (!valor) {
    return null;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  return valor > hoy ? { fechaFutura: true } : null;
};

/** Teléfono fijo o celular colombiano: 7 a 10 dígitos (se ignoran espacios, guiones y +57). */
export const telefono: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null => {
  const valor = (control.value ?? '').replace(/[\s-]/g, '').replace(/^\+?57/, '');
  if (!valor) {
    return null;
  }
  return /^\d{7,10}$/.test(valor) ? null : { telefono: true };
};

/** NIT colombiano: 6 a 10 dígitos con dígito de verificación opcional (`900123456-7`). */
export const nit: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null => {
  const valor = (control.value ?? '').replace(/[\s.]/g, '');
  return !valor || /^\d{6,10}(-\d)?$/.test(valor) ? null : { nit: true };
};

/** Placa de vehículo colombiano: 3 letras y 3 números (`ABC123`). */
export const placa: ValidatorFn = (control: AbstractControl<string>): ValidationErrors | null => {
  const valor = (control.value ?? '').replace(/[\s-]/g, '').toUpperCase();
  return !valor || /^[A-Z]{3}\d{3}$/.test(valor) ? null : { placa: true };
};

/**
 * Valida en un grupo que `fin` sea posterior a `inicio` (horas `HH:mm`, fechas o meses ISO; con
 * `permitirIgual`, también igual). El error queda en el control `fin`.
 */
export function posteriorA(inicio: string, fin: string, error = 'rango', permitirIgual = false): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const desde = grupo.get(inicio)?.value as string | undefined;
    const control = grupo.get(fin);
    const hasta = control?.value as string | undefined;
    if (!control) return null;
    const { [error]: _previo, ...otros } = control.errors ?? {};
    const invalido = !!desde && !!hasta && (permitirIgual ? hasta < desde : hasta <= desde);
    const errores = invalido ? { ...otros, [error]: true } : otros;
    control.setErrors(Object.keys(errores).length ? errores : null);
    return null;
  };
}

/**
 * Emite los filtros 300 ms después de que el usuario deja de escribir (sin
 * repetir valores). Llamar en el constructor del componente de filtros.
 */
export function emitirEnVivo<T>(form: FormGroup, destino: { emit(valor: T): void }): void {
  form.valueChanges
    .pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      takeUntilDestroyed(),
    )
    .subscribe(() => destino.emit(form.getRawValue() as T));
}

/** Mensaje de error para mostrar debajo de un campo, o `null` si no aplica. */
export function mensajeError(control: AbstractControl): string | null {
  if (!control.errors || !(control.touched || control.dirty)) {
    return null;
  }
  const e = control.errors;
  if (e['required']) return 'Este campo es obligatorio.';
  if (e['email']) return 'Ingresa un correo válido.';
  if (e['minlength']) return `Mínimo ${(e['minlength'] as { requiredLength: number }).requiredLength} caracteres.`;
  if (e['maxlength']) return `Máximo ${(e['maxlength'] as { requiredLength: number }).requiredLength} caracteres.`;
  if (e['min']) return `El valor mínimo es ${(e['min'] as { min: number }).min}.`;
  if (e['max']) return `El valor máximo es ${(e['max'] as { max: number }).max}.`;
  if (e['telefono']) return 'Ingresa un teléfono válido (7 a 10 dígitos).';
  if (e['nit']) return 'Ingresa un NIT válido (ej. 900123456-7).';
  if (e['placa']) return 'Ingresa una placa válida (ej. ABC123).';
  if (e['rango']) return 'Debe ser posterior al valor inicial.';
  if (e['incompleto']) return 'Completa las dos horas o deja ambas vacías.';
  if (e['duplicado']) return 'Este valor ya está en la lista.';
  if (e['pattern']) return 'El formato no es válido.';
  if (e['fechaFutura']) return 'La fecha no puede ser futura.';
  return 'Valor no válido.';
}

/** Normaliza texto para búsquedas: minúsculas y sin tildes. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
